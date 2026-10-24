# Deployment guide

Nothing here has been executed against live accounts. Follow it and treat the first deploy as a test.

## 1. MongoDB Atlas
1. Create a cluster, then **Database Access → Add user** with *Read and write to a specific database* (`foodrescue`) only (least privilege). Use a long random password.
2. **Network Access**: Atlas needs to allow your Render outbound IPs. Prefer Render’s published outbound IP ranges for your region; `0.0.0.0/0` is a convenience fallback, only acceptable with a strong password.
3. Copy the `mongodb+srv://…/foodrescue` connection string into `MONGODB_URI`. Indexes are created automatically on first start.

## 2. Redis (BullMQ)
- On Render, `render.yaml` provisions a Key Value instance with `maxmemoryPolicy: noeviction` (required so jobs are not evicted) and wires `REDIS_URL` into the API.
- Elsewhere (Upstash, Redis Cloud…): create a database with `noeviction`, copy the `rediss://` URL into `REDIS_URL`.
- The API process also runs the worker. If Redis is missing or down the API still works: emails are sent inline and the same idempotent jobs run on an in-process `node-cron` schedule (single instance only). `/api/v1/health` reports `queue: connected | unavailable | not_configured`.
- Repeatable jobs use `upsertJobScheduler`, so restarts and multiple instances never create duplicate schedules.

## 3. Cloudinary
Create a free account; copy cloud name, API key and secret into the three `CLOUDINARY_*` variables on the **server only**. The browser never sees the secret: uploads go browser → API (type, size and magic-byte checks) → Cloudinary.

## 4. Email (SMTP)
Any SMTP provider (Brevo, Postmark, Mailgun, SES). Set `SMTP_*` and `EMAIL_FROM`. Without SMTP in **production**, users cannot verify their email, so do not launch without it.

## 5. Geocoding
Address search uses a server-side proxy for a Geoapify-compatible API (`GEOCODER_URL`, `GEOCODER_API_KEY`). The public Nominatim endpoint is not used. Without a key, the picker still works by clicking the map.

## 6. Backend on Render
1. New → **Blueprint** → select the repo (uses `render.yaml`), or create a Web Service manually: root directory `server`, build `npm ci --omit=dev`, start `npm start`, health check `/api/v1/health`.
2. Set the `sync: false` variables. `CLIENT_URL`/`CLIENT_ORIGINS` must contain your exact Vercel origin(s), with no trailing slash. `JWT_SECRET` ≥ 32 random characters.
3. Render provides `PORT`; the server respects it. Use a paid instance so jobs and websockets are not interrupted by idle spin-down.

## 7. Frontend on Vercel
1. Import the repo, set **Root Directory** to `client`. Framework: Vite; build `npm run build`; output `dist` (all in `client/vercel.json`, including the SPA rewrite).
2. Environment variables: `VITE_API_URL=https://<api>.onrender.com/api/v1`, `VITE_SOCKET_URL=https://<api>.onrender.com`, optional `VITE_MAP_TILE_URL`.
3. Redeploy after changing variables (Vite inlines them at build time).

## 8. Cross-origin cookies (important)
In production the cookies are `Secure; SameSite=None` so a Vercel origin can call a Render origin. Some browsers (Safari, Brave, Firefox strict mode) block third-party cookies, which breaks login in that setup. The robust fix is to serve both under one registrable domain, for example `app.example.com` (Vercel) and `api.example.com` (Render custom domain). The browser then treats them as same-site and the cookies are not blocked. Add both origins to `CLIENT_ORIGINS` and decide this before launch.

## 9. Post-deploy checks
`GET /api/v1/health` → `status: ok`; register and verify an account; create a donation with a photo; request it from a verified organization; run a volunteer pickup with QR codes; confirm notifications arrive live.
