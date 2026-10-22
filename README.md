# Tile Studio — React, Node.js and MongoDB

Open **D:\Tile_Studio** in VS Code. Run commands from this root folder, not from `frontend`.

## Start the project

Dependencies are installed during setup. For a fresh checkout, run `npm install` once and copy `backend/.env.example` to `backend/.env`.

**Terminal 1 — database:**
```powershell
npm run db:start
```
Leave this terminal open. The database persists in `.local/mongodb-data` after stopping/restarting. For a fresh checkout, run `npm run db:install` once first. The installer downloads MongoDB Community from the official MongoDB server, verifies its SHA-256, and extracts it inside this project. It does not install a Windows service.

**Terminal 2 — initial data and website:**
```powershell
npm run db:seed
npm run dev
```
Open http://127.0.0.1:5173. Importing is only needed initially or after deliberately updating `backend/data/catalog.json`. The import updates records by their unique ID; running it again does not create duplicates. It overwrites fields of matching seeded records and preserves unrelated records.

If PowerShell blocks npm scripts, substitute `npm.cmd` for `npm`.

## Folder structure

```text
Tile_Studio/
  frontend/
    src/             React UI, perspective mapping and renderer
    public/assets/   Room layers and supplied tile image files
    index.html
    vite.config.js   Sends /api requests to the backend during development
  backend/
    src/             Express API and MongoDB connection
    scripts/         Catalogue import and database check
    data/catalog.json  Seed data; the running API reads MongoDB
    .env             Local configuration, excluded from Git
    .env.example     Shareable configuration template
  scripts/           Project-local MongoDB installation/start helpers
  .local/            MongoDB program, persistent data, logs; excluded from Git
  package.json       Commands for the complete project
```

## How the connection works

React → `/api/catalog` → Express → MongoDB (`tile_studio`) → JSON response → Canvas preview.

MongoDB has `rooms`, `tiles`, and `metadata` collections. Tile records include names, dimensions, collections, file URLs and face variations. The actual image files stay under `frontend/public/assets`; the database stores their URLs. There are 3 sample rooms, 19 supplied Whiteeza designs and 62 tile faces. Demo dimensions are 120 × 60 cm, as agreed; these are not manufacturer specifications.

The frontend requires the API. There is no silent static catalogue fallback. The backend connects and pings MongoDB before listening, and reports an unavailable database with HTTP 503. One shared MongoClient manages the database connection pool.

## Backend endpoints

| Route | Purpose |
| --- | --- |
| GET /api/health | Live MongoDB ping and connection status |
| GET /api/catalog | Complete rooms, tiles and collection metadata |
| GET /api/rooms | Predefined rooms |
| GET /api/tiles | Tile list; optional `surface=floor` and `collection=Dior` |
| GET /api/tiles/:id | One product, e.g. `dior-berry` |

The backend port is configured in `backend/.env`; Vite reads that port for its proxy. Restart `npm run dev` after changing it. Local MongoDB listens only on `127.0.0.1:27017`. This setup is for a local interview demo. Public deployment will need authenticated database access and deployment-specific settings.

## Verification and production-style demo

```powershell
npm run db:check
npm test
npm run test:integration
npm run build
npm start
```

Integration tests require running MongoDB and use a unique disposable test database. They verify idempotent imports, filters, actual database-backed reads, and 503 responses on a disconnected database. They do not modify the application database.

For `npm start`, stop `npm run dev` first; MongoDB must remain running. Open the backend address printed in the terminal. Express serves the built frontend and the API together.

## Next work and planning estimate

The backend/database setup is the current milestone. The requested visual redesign remains to be done after selecting a reference or direction.

| Remaining work | Focused working estimate |
| --- | --- |
| Agree on new layout and visual direction | 30–60 minutes |
| Build the new responsive interface | 3–5 hours |
| Replace illustrated rooms with 2–3 prepared real photos, if desired | 3–6 hours, depending on furniture masks |
| End-to-end checks, bug fixes, demo polish | 1–2 hours |
| Walk through the code and practise interview explanation | 1–2 hours |

With the current illustrated rooms, allow approximately **1–2 focused working days** for a polished interview demo. With realistic room preparation, allow **2–3 working days**. These are planning estimates, not a guarantee; revisions and image preparation affect them. Accounts, admin editing, saved projects and public deployment are additional scope and are not implemented here.

## Troubleshooting

- **MongoDB connection failed:** start Terminal 1 and run `npm run db:check`; read `.local/mongodb.log` if it will not start.
- **Catalogue is empty:** run `npm run db:seed`.
- **Port already in use:** stop the other process you own or change `PORT` in `backend/.env` and restart development.
- **Lost local database:** do not delete `.local/mongodb-data`; the catalogue can be restored with the seed command if necessary.
- **No package.json found:** check that your terminal is in the project root.

Official connection guidance: https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/

AI room previews
---------------
Select a predefined photo and tile settings, then choose Generate preview. The original photograph and floor/wall product references are sent to OpenAI image editing. No photo masks are sent. Preview appearance and dimensions are approximate.

Configure OPENAI_API_KEY in backend/.env (never in the frontend). Optional OPENAI_IMAGE_MODEL defaults to gpt-image-1.5. Restart the backend after changing environment settings. Each generation uses API credits; identical successful requests reuse the saved result. Failed requests require an explicit retry and are never automatically resubmitted to the provider.

POST /api/generations starts a job. GET /api/generations/:id returns its state; the image endpoint serves the completed PNG. MongoDB stores settings/status and .local/ai-previews stores image files. Preserve both when backing up. Jobs run in this single local server process; restarting during generation interrupts the job, and generating again retries it. This local demo has no user authentication and should not be exposed publicly without authentication, per-user limits and durable job processing.
