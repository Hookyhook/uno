# Uno

Small multiplayer Uno you can play in the browser with friends. Rooms are joined by a 5-letter code, 2–6 players, standard rules including skip/reverse/+2/wild/+4, calling UNO and catching players who forgot.

Built as a single Next.js app so it deploys to Vercel with no servers to run. Clients poll the API about once per second instead of holding a WebSocket, because serverless functions cannot keep a connection or any memory between requests. Room state lives in Upstash Redis.

## Stack

- Next.js 15 (App Router), React 19, Zustand
- Game engine is pure TypeScript in `lib/engine.ts`, unit tested with Vitest
- `lib/room.ts` is the pure room state machine, `lib/service.ts` handles load/apply/save
- Upstash Redis for room state, with optimistic concurrency (compare-and-set on a version key)

## Run locally

```bash
npm install
npm run dev
```

Without Upstash env vars it falls back to an in-memory store, which is fine for local play but only works in a single process. Open two tabs to play against yourself.

```bash
npm test
npm run build && npm start
```

## Deploy to Vercel

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com).
2. Import this repo at [vercel.com/new](https://vercel.com/new).
3. Add two environment variables in the Vercel project settings, copied from the Upstash dashboard:

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

4. Deploy. Every push to `main` redeploys.

The app refuses to start in production without those two variables, so a misconfigured deploy fails loudly instead of silently losing games.

## How polling works

- Clients `GET /api/rooms/[code]` every 1.5 s with their session token and get back only their own hand plus public info about everyone else.
- Actions are `POST` to the same route and return the updated view immediately, so the acting player sees their own move without waiting for the next poll.
- Turn timeouts are applied lazily: any request that arrives after the turn clock expired applies the timeout first. No background timers needed.
- Presence is derived from the last poll. A player who has not polled for 10 s shows as offline; after 2 minutes they are removed from the room.

Rough free-tier usage: four players in a one-hour game make about 10k function invocations and 10k Redis commands, against monthly caps of 1M and 500k.

## Rules implemented

- 108-card deck, 7 cards each, first card is never a Wild +4
- Play on matching color, matching value, or a wild; wild +4 has no challenge rule
- Draw one card per turn; if it's playable you may play it, otherwise the turn passes automatically
- Reverse with two players acts as skip
- With one card left you must press UNO before the next player acts; anyone can catch you for +2
- 45 s turn timer, after which the server draws and passes for you
