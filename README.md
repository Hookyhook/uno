# Uno

Small multiplayer Uno you can play in the browser with friends. Rooms are joined by a 5-letter code, 2–6 players, standard rules including skip/reverse/+2/wild/+4, calling UNO and catching players who forgot.

Everything lives in one Node process: a Fastify server serves the built React app and runs the game over a WebSocket. Rooms are in memory only, so a restart or redeploy drops running games.

## Stack

- TypeScript monorepo (npm workspaces)
- `packages/shared`: card types, rules, zod wire protocol
- `packages/server`: Fastify + `ws`, pure game engine with tests
- `packages/client`: Vite + React + Zustand

## Run locally

```bash
npm install
npm run dev
```

Client on http://localhost:5173 (proxies `/ws` to the server on 8080). Open two tabs to play against yourself.

```bash
npm test
npm run build && npm start   # production build on http://localhost:8080
```

## Deploy to Fly.io

```bash
fly launch --no-deploy --copy-config   # once; pick an app name if uno-game is taken
fly deploy
```

`fly.toml` keeps one machine running permanently because game state is in memory. Any other Docker host works too:

```bash
docker build -t uno . && docker run -p 8080:8080 uno
```

## Rules implemented

- 108-card deck, 7 cards each, first card is never a Wild +4
- Play on matching color, matching value, or a wild; wild +4 has no challenge rule
- Draw one card per turn; if it's playable you may play it, otherwise the turn passes automatically
- Reverse with two players acts as skip
- With one card left you must press UNO before the next player acts; anyone can catch you for +2
- 45 s turn timer, after which the server draws and passes for you
- Disconnected players get 2 minutes to reconnect (token in localStorage), then are removed
