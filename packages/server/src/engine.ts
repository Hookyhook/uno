import {
  buildDeck,
  canPlay,
  cardPoints,
  shuffle,
  COLORS,
  HAND_SIZE,
  TURN_SECONDS,
  type Card,
  type Color,
  type GameResult,
  type GameView,
} from "@uno/shared";

export interface EnginePlayer {
  id: string;
  name: string;
  hand: Card[];
  unoCalled: boolean;
}

export interface EngineState {
  players: EnginePlayer[];
  currentIndex: number;
  direction: 1 | -1;
  drawPile: Card[];
  discard: Card[];
  activeColor: Color;
  hasDrawnThisTurn: boolean;
  drawnCardId: string | null;
  pendingUnoPlayerId: string | null;
  winnerId: string | null;
  turnEndsAt: number;
  lastEvent: string | null;
}

export class EngineError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface EngineDeps {
  random?: () => number;
  now?: () => number;
}

export function createGame(seats: { id: string; name: string }[], deps: EngineDeps = {}): EngineState {
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  let drawPile = shuffle(buildDeck(), random);

  const players: EnginePlayer[] = seats.map((s) => ({ id: s.id, name: s.name, hand: [], unoCalled: false }));
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of players) p.hand.push(drawPile.pop()!);
  }

  let first = drawPile.pop()!;
  while (first.value === "wild4") {
    drawPile = shuffle([...drawPile, first], random);
    first = drawPile.pop()!;
  }

  const state: EngineState = {
    players,
    currentIndex: 0,
    direction: 1,
    drawPile,
    discard: [first],
    activeColor: first.color === "wild" ? COLORS[Math.floor(random() * COLORS.length)]! : first.color,
    hasDrawnThisTurn: false,
    drawnCardId: null,
    pendingUnoPlayerId: null,
    winnerId: null,
    turnEndsAt: now() + TURN_SECONDS * 1000,
    lastEvent: null,
  };

  const steps = applyCardEffect(state, first, true);
  state.currentIndex = nextIndex(state, steps - 1);
  return state;
}

function top(state: EngineState): Card {
  return state.discard[state.discard.length - 1]!;
}

function current(state: EngineState): EnginePlayer {
  return state.players[state.currentIndex]!;
}

function findPlayer(state: EngineState, id: string): EnginePlayer {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new EngineError("unknown_player", "Unknown player");
  return p;
}

function requireTurn(state: EngineState, playerId: string): EnginePlayer {
  if (state.winnerId) throw new EngineError("game_over", "The game is over");
  const p = current(state);
  if (p.id !== playerId) throw new EngineError("not_your_turn", "It's not your turn");
  return p;
}

function nextIndex(state: EngineState, steps = 1): number {
  const n = state.players.length;
  return (((state.currentIndex + state.direction * steps) % n) + n) % n;
}

function drawFromPile(state: EngineState, player: EnginePlayer, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) reshuffleDiscard(state);
    const card = state.drawPile.pop();
    if (!card) break;
    player.hand.push(card);
    drawn.push(card);
  }
  if (player.hand.length !== 1) player.unoCalled = false;
  return drawn;
}

function reshuffleDiscard(state: EngineState): void {
  if (state.discard.length <= 1) return;
  const keep = state.discard.pop()!;
  state.drawPile = shuffle(state.discard);
  state.discard = [keep];
}

function endTurn(state: EngineState, steps: number, now: number): void {
  state.currentIndex = nextIndex(state, steps);
  state.hasDrawnThisTurn = false;
  state.drawnCardId = null;
  state.turnEndsAt = now + TURN_SECONDS * 1000;
}

function applyCardEffect(state: EngineState, card: Card, isOpening: boolean): number {
  const n = state.players.length;
  switch (card.value) {
    case "skip":
      return 2;
    case "reverse":
      state.direction = state.direction === 1 ? -1 : 1;
      if (n === 2) return 2;
      if (isOpening) state.currentIndex = n - 1;
      return 1;
    case "draw2": {
      const victim = state.players[nextIndex(state, 1)]!;
      drawFromPile(state, victim, 2);
      return 2;
    }
    case "wild4": {
      const victim = state.players[nextIndex(state, 1)]!;
      drawFromPile(state, victim, 4);
      return 2;
    }
    default:
      return 1;
  }
}

export function playCard(
  state: EngineState,
  playerId: string,
  cardId: string,
  chosenColor: Color | undefined,
  deps: EngineDeps = {},
): EngineState {
  const now = deps.now ?? Date.now;
  const s = structuredClone(state);
  const player = requireTurn(s, playerId);
  clearPendingUnoIfOther(s, playerId);
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new EngineError("no_such_card", "You don't have that card");
  const card = player.hand[idx]!;

  if (s.hasDrawnThisTurn && s.drawnCardId !== cardId) {
    throw new EngineError("must_play_drawn", "After drawing you may only play the drawn card");
  }
  if (!canPlay(card, top(s), s.activeColor)) {
    throw new EngineError("illegal_card", "That card can't be played now");
  }
  if (card.color === "wild") {
    if (!chosenColor) throw new EngineError("color_required", "Choose a color for the wild card");
    s.activeColor = chosenColor;
  } else {
    s.activeColor = card.color;
  }

  player.hand.splice(idx, 1);
  s.discard.push(card);
  s.lastEvent = `${player.name} played ${describe(card, s.activeColor)}`;

  if (player.hand.length === 0) {
    s.winnerId = player.id;
    s.pendingUnoPlayerId = null;
    s.lastEvent = `${player.name} wins!`;
    return s;
  }

  if (player.hand.length === 1) {
    s.pendingUnoPlayerId = player.unoCalled ? null : player.id;
  } else {
    player.unoCalled = false;
  }

  const steps = applyCardEffect(s, card, false);
  endTurn(s, steps, now());
  return s;
}

export function drawCard(state: EngineState, playerId: string, deps: EngineDeps = {}): EngineState {
  const now = deps.now ?? Date.now;
  const s = structuredClone(state);
  const player = requireTurn(s, playerId);
  if (s.hasDrawnThisTurn) throw new EngineError("already_drew", "You already drew this turn");

  clearPendingUnoIfOther(s, playerId);
  const [card] = drawFromPile(s, player, 1);
  s.hasDrawnThisTurn = true;
  s.drawnCardId = card?.id ?? null;
  s.lastEvent = `${player.name} drew a card`;

  if (!card || !canPlay(card, top(s), s.activeColor)) endTurn(s, 1, now());
  return s;
}

export function passTurn(state: EngineState, playerId: string, deps: EngineDeps = {}): EngineState {
  const now = deps.now ?? Date.now;
  const s = structuredClone(state);
  const player = requireTurn(s, playerId);
  if (!s.hasDrawnThisTurn) throw new EngineError("must_draw", "Draw a card before passing");
  s.lastEvent = `${player.name} passed`;
  endTurn(s, 1, now());
  return s;
}

export function timeoutTurn(state: EngineState, deps: EngineDeps = {}): EngineState {
  const now = deps.now ?? Date.now;
  const s = structuredClone(state);
  if (s.winnerId) return s;
  const player = current(s);
  if (!s.hasDrawnThisTurn) drawFromPile(s, player, 1);
  s.lastEvent = `${player.name} ran out of time`;
  endTurn(s, 1, now());
  return s;
}

export function callUno(state: EngineState, playerId: string): EngineState {
  const s = structuredClone(state);
  const player = findPlayer(s, playerId);
  const isTurnWithTwo = current(s).id === playerId && player.hand.length === 2;
  if (player.hand.length !== 1 && !isTurnWithTwo) {
    throw new EngineError("cannot_call_uno", "You can only call Uno with one card left");
  }
  player.unoCalled = true;
  if (s.pendingUnoPlayerId === playerId) s.pendingUnoPlayerId = null;
  s.lastEvent = `${player.name} called UNO!`;
  return s;
}

export function catchUno(state: EngineState, callerId: string, targetId: string): EngineState {
  const s = structuredClone(state);
  const caller = findPlayer(s, callerId);
  const target = findPlayer(s, targetId);
  if (callerId === targetId) throw new EngineError("cannot_catch_self", "You can't catch yourself");
  if (s.pendingUnoPlayerId !== targetId) {
    throw new EngineError("nothing_to_catch", `${target.name} can't be caught right now`);
  }
  drawFromPile(s, target, 2);
  s.pendingUnoPlayerId = null;
  s.lastEvent = `${caller.name} caught ${target.name} without calling UNO (+2)`;
  return s;
}

function clearPendingUnoIfOther(s: EngineState, actingPlayerId: string): void {
  if (s.pendingUnoPlayerId && s.pendingUnoPlayerId !== actingPlayerId) s.pendingUnoPlayerId = null;
}

function describe(card: Card, activeColor: Color): string {
  if (card.color === "wild") return `${card.value === "wild4" ? "Wild +4" : "Wild"} (${activeColor})`;
  return `${card.color} ${card.value === "draw2" ? "+2" : card.value}`;
}

export function viewFor(state: EngineState, playerId: string): GameView {
  const me = findPlayer(state, playerId);
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      connected: true,
      unoCalled: p.unoCalled,
    })),
    currentPlayerId: current(state).id,
    direction: state.direction,
    topCard: top(state),
    activeColor: state.activeColor,
    drawPileCount: state.drawPile.length,
    hand: me.hand,
    hasDrawnThisTurn: state.hasDrawnThisTurn,
    turnEndsAt: state.turnEndsAt,
    lastEvent: state.lastEvent,
  };
}

export function result(state: EngineState): GameResult {
  if (!state.winnerId) throw new EngineError("not_finished", "Game not finished");
  return {
    winnerId: state.winnerId,
    scores: state.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      points: p.hand.reduce((sum, c) => sum + cardPoints(c), 0),
    })),
  };
}

export function removePlayer(state: EngineState, playerId: string, deps: EngineDeps = {}): EngineState {
  const now = deps.now ?? Date.now;
  const s = structuredClone(state);
  const idx = s.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return s;
  const [gone] = s.players.splice(idx, 1);
  s.drawPile.unshift(...gone!.hand);
  if (s.pendingUnoPlayerId === playerId) s.pendingUnoPlayerId = null;
  s.lastEvent = `${gone!.name} left the game`;

  if (s.players.length < 2) {
    s.winnerId = s.players[0]?.id ?? null;
    s.currentIndex = 0;
    return s;
  }
  const wasCurrent = idx === s.currentIndex;
  if (idx < s.currentIndex) s.currentIndex -= 1;
  s.currentIndex %= s.players.length;
  if (wasCurrent) {
    if (s.direction === -1) s.currentIndex = (s.currentIndex - 1 + s.players.length) % s.players.length;
    s.hasDrawnThisTurn = false;
    s.drawnCardId = null;
    s.turnEndsAt = now() + TURN_SECONDS * 1000;
  }
  return s;
}
