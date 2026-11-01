# Bridge Puzzles

Train bridge declarer play and defence on curated puzzles — on the web and on your phone — with an Elo rating for both players and puzzles.

| Part | Path | Stack |
|---|---|---|
| Backend | [`backend/`](backend) | Node.js, Express 5, Supabase (PostgreSQL) |
| Web app | [`web/`](web) | React 18, TypeScript, Vite, Tailwind CSS |
| Mobile app | [`mobile/`](mobile) | Expo, React Native, TypeScript |

## Features

- **Interactive play** driven by a JSON solution tree: every card leads to the next state, automatic defender replies and feedback.
- **Elo rating** for players and puzzles, settled once per puzzle (`UNIQUE (user_id, puzzle_id)` acts as the settlement gate).
- **Accounts with a guest mode**: play a configurable number of puzzles without an account; on sign-up the anonymous profile is linked to the new account, so progress is kept.
- **Polish and English** UI and puzzle content (typed dictionary, no i18n library); the API picks the language from an `X-Lang` header.
- **Puzzle import pipeline** (`backend/scripts/import-puzzles.js`): parses a text/DOCX template, deduplicates by content hash, dry-run by default, `--update` mode for corrections.

## Engineering notes

- **Security:** the `service_role` key lives only on the server. RLS is enabled on every table with zero policies, so the public anon key can read nothing directly; correctness of a move is always recomputed on the server, never trusted from the client.
- **Latency:** click-to-summary time cut from ~1.7 s to ~1.0 s — puzzles cached in process memory (60 s TTL), Elo settlement via `upsert` with parallel reads, and settlement moved to its own endpoint so database round-trips run concurrently with the reveal animation.
- **Deployment:** a single small GCP VM — Caddy serving the built web app and reverse-proxying `/api/*` to the backend running under systemd.

## Running locally

```bash
# backend (port 3000)
cd backend && cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install && node index.js

# web (port 5173)
cd web && cp .env.example .env       # fill in the Supabase URL and anon key
npm install && npm run dev

# mobile (Expo, port 8081)
cd mobile && cp .env.example .env
npm install && npx expo start
```

The mobile app finds the backend automatically from the Expo dev-server host; set `EXPO_PUBLIC_API_URL` to point it elsewhere.

## Status

Work in progress. Card play (declarer and defence) works end to end; the bidding trainer is still a mock-up and the "Problems" and "Daily" modes have no content yet.

## License

[MIT](LICENSE)
