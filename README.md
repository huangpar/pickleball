# PickleLeague Win Tracker

Single-league pickleball tournament and standings tracker. No login — every page and action is open to anyone with the link.

## Local development

1. Copy `.env.example` to `.env.local` and fill in your Neon `DATABASE_URL`.
2. `npm install`
3. `npx drizzle-kit push` (applies the schema to your Neon database)
4. `npm run dev` — visit `http://localhost:3000`

## Testing

`npm run test` runs the full Vitest suite, including integration tests that hit the real Neon database configured in `.env.local`.

## Deployment

Connect this repository to a Netlify site. Netlify builds it using `@netlify/plugin-nextjs` (configured in `netlify.toml`) and `npm run build`. Set `DATABASE_URL` in the Netlify site's environment variables (Site configuration → Environment variables) to the same Neon connection string used locally, or to a separate production Neon branch if you want to keep local dev data isolated.
