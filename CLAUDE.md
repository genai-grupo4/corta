# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Corta — a small internal URL shortener (Spanish variable/comment names throughout). Express server backed by a JSON file instead of a database.

## Commands

- Run the server: `npm start` (runs `node server.js`, listens on port 3000; uses `links.json` unless `DATABASE_URL` is set)
- Run tests: `npm test` (`node --test tests/*.test.js`)

## Architecture

- **Storage**: `storage.js` abstracts two backends based on `DATABASE_URL`. Without it (local/tests): `links.json` at the repo root, read/written synchronously (`fs.readFileSync`/`writeFileSync`) on every request — no locking, so concurrent writes to the file can race (see `SPEC.md` for the accepted-limitation writeup). With `DATABASE_URL` set (production, Railway): a Postgres `links` table; `incrementarClicks` uses an atomic `UPDATE ... SET clicks = clicks + 1`, so this race doesn't apply there. This is also what makes links/clicks survive a redeploy — the container filesystem doesn't persist, the database does.
- **Routes** (in `server.js`): `POST /api/links` validates the url (`esUrlValida`: must parse with `new URL()` and be `http:`/`https:`) and creates a short link (`{ codigo, url, clicks, creado }`, code from `utils.js`); `GET /:codigo` looks up the code, increments `clicks`, and issues a real `302` redirect (`res.redirect`); `GET /api/links/:codigo/stats` returns `{ codigo, url, clicks, creado }` read-only (does not increment `clicks`).
- **Code generation**: `utils.js`'s `generarCodigoUnico()` takes the list of existing codes and regenerates until it finds one not in use — collisions can't silently overwrite or shadow a link.
- **Frontend**: static files served from `public/` via `express.static`. `index.html` is the shortening form plus a per-browser link history (`localStorage`, not server-side). `stats.html` calls `GET /api/links/:codigo/stats` and renders real data.
- **Repo hygiene**: `.gitignore` covers `node_modules/`, `reportes/`, `.claude/settings.local.json`. The legacy duplicate/dead files from the inherited project (`index_v2_FINAL.js`, `server_OLD.js`, `links_backup_marzo.json`, `notas.txt`, root `test.js`, `public/estilos_viejos.css`) were removed from the repo in Milestone 2 — `server.js` is the only server entry point.
- **Tests**: `tests/*.test.js` (`node --test`, run via `npm test`) is the real test suite — 18+ tests derived from `SPEC.md`, using `tests/helpers.js`'s `levantarServer()` to spin up the app against an isolated temp `links.json` per test.
- **Known gaps found in review**: see `FIXES_PENDIENTES.md` — all 4 items were fixed on 2026-08-19 (self-XSS in the local history render, `POST /api/links` swallowing the real error message, and the missing `/collect-memory` skill below; the fourth was this file itself, already caught by that same review).

## Team automation

- Remotes: `origin` is the individual repo (`KLeichen/Corta_Test`); `grupal` is the shared team repo (`lucasmonteverdi1/corta`). Team work happens on branch `Corta_Kevin`, tracking `grupal/Corta_Kevin` — `main` stays pointed at `origin`.
- Skill `reporte-cambios` (`.claude/skills/reporte-cambios/SKILL.md`): updates the local repo from its remote and writes a report of new commits (author, files touched) to `reportes/` (gitignored, not committed). Built to run unattended from a scheduled cron job — if there are uncommitted changes or the branch has diverged, it stops and reports instead of forcing anything (no stash/reset/merge).
- Skill `collect-memory` (`.claude/skills/collect-memory/SKILL.md`): the other team extra from `mission.md` ("la memoria del agente"). Invoked by hand at the end of a work session, it reviews the conversation and updates this file with progress and team preferences. Still needs to actually be used session over session — the success criterion in `mission.md` is that this file's git history shows its updates.
