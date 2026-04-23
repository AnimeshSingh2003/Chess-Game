# ARChess Nexus (Full-Stack)

ARChess Nexus is now organized as a proper full-stack project with a separate frontend and backend.

## Tech Stack

- Frontend: Vanilla JS modules + Vite (modern dev server and build)
- Backend: Node.js + Express + Socket.IO + Chess.js
- Realtime multiplayer: room-based socket events with server-side move validation
- AR mode: camera-based AR simulation workflow with mobile/desktop compatibility

## Project Structure

```
Chess-Game/
	frontend/
		index.html
		style.css
		src/modules/
		black/
		white/
		package.json
		.env.example
	backend/
		server.js
		package.json
		.env.example
	package.json
	.gitignore
	README.md
```

## Prerequisites

- Node.js 18+
- npm 9+

## Install

From project root:

```powershell
npm run install:all
```

## Run (Development)

Single command (recommended):

```powershell
npm run dev
```

Or run separately:

Terminal 1 (backend):

```powershell
npm run dev:backend
```

Terminal 2 (frontend):

```powershell
npm run dev:frontend
```

Open frontend URL shown by Vite (usually `http://localhost:5173`).

## Environment Configuration

Backend (`backend/.env`):

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173,http://localhost:8000
```

Frontend (`frontend/.env`):

```env
VITE_SERVER_URL=http://localhost:3001
```

## Mobile Testing (Same Wi-Fi)

1. Start backend and frontend in dev mode.
2. Find your laptop LAN IP (`ipconfig` on Windows).
3. Open on phone:

```text
http://YOUR_LAPTOP_IP:5173
```

4. Update backend allowed origins in `backend/.env` if needed:

```env
CLIENT_ORIGIN=http://localhost:5173,http://YOUR_LAPTOP_IP:5173
```

5. Restart backend after env changes.

## Production Build

Frontend:

```powershell
cd frontend
npm run build
npm run preview
```

Backend:

```powershell
cd backend
npm start
```

## Deploy on Vercel (Frontend)

You can deploy the frontend directly to Vercel without Docker.

1. Import the repo in Vercel.
2. Set Root Directory to frontend.
3. Build command: npm run build
4. Output directory: dist
5. Add environment variable:

VITE_SERVER_URL=https://your-backend-domain.com

The frontend already includes Vercel SPA rewrite config in frontend/vercel.json.

## Backend Hosting Note (Socket.IO)

The backend uses long-lived Socket.IO connections for multiplayer. This is best hosted on a Node runtime service (Railway, Render, Fly.io, VPS), still fully JavaScript and no Docker required.

Recommended split:

Frontend: Vercel
Backend: Node host (Railway/Render/Fly)

## Security and Stability Notes

- Backend loads environment from `.env` via `dotenv`
- Security headers enabled with `helmet`
- Server validates all moves with Chess.js
- Turn and room ownership enforced server-side
- Input validation for usernames, room codes, squares, and promotions
- Basic socket move rate-limiting enabled
- Inactive room expiry enabled
- CORS restricted to configured allowed origins

## Current Coverage

- Desktop and mobile web support
- Local game, AI game loop, puzzle board, online room multiplayer
- AR camera mode with graceful fallback behavior

## Next Recommended Upgrades

1. Add HTTPS and secure headers (`helmet`) for production backend.
2. Add persistent storage (Redis/Postgres) for resilient rooms and sessions.
3. Add automated tests for multiplayer flows and move validation edge cases.