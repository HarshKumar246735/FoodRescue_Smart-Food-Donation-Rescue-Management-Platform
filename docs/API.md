# FoodRescue API

Base URL: `/api/v1` · Interactive docs: `GET /api/docs` (Swagger UI, enabled outside production, or when `ENABLE_DOCS=true`).

## Conventions
- JSON everywhere. Success: `{ "success": true, "message": "…", "data": {…}, "meta": {page,limit,total,pages}? }`.
- Errors: `{ "success": false, "message": "…", "errors": [{ "field", "message" }]? }` with correct HTTP codes (400, 401, 403, 404, 409, 413, 415, 422, 429, 5xx). Stack traces are never returned in production.
- **Auth**: HTTP-only cookie (`COOKIE_NAME`). **CSRF**: call `GET /auth/csrf` once, then send the returned token as `X-CSRF-Token` on every POST/PUT/PATCH/DELETE. Without it the API answers 403.
- Pagination: `?page=1&limit=12` (limit ≤ 50). Unknown body fields are rejected (422), so clients cannot set `role`, `status`, etc.

## Endpoint groups
| Group | Highlights |
|---|---|
| `/health` | DB state, queue state, which optional integrations are configured (no secrets). 503 when the DB is down. |
| `/auth` | `csrf`, `register`, `login`, `logout`, `me`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password` |
| `/users` | `PATCH /me`, `POST /me/password`, `GET /volunteers` (donor/admin) |
| `/organizations` | `GET/PUT /me` (NGO) |
| `/donations` | `GET /` (public; `q, category, dietary, minQuantity, availability, deadlineWithinHours, lat, lng, radiusKm, sort=newest|nearest|deadline`), `GET /mine`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/publish`, `POST /:id/cancel`, `POST/DELETE /:id/image` |
| `/donation-requests` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id/{accept,reject,ready,handover,cancel,receipt}` |
| `/pickups` | `GET /available`, `/mine`, `/party`, `/:id`; `POST /:id/{accept,decline,assign,start,cancel,handover-token,verify,sharing}` |
| `/notifications` | list, `unread-count`, `PATCH /:id/read`, `PATCH /read-all` |
| `/recurring-donations` | CRUD-style schedule management, `pause`, `resume`, `cancel`, `GET /:id/generated` |
| `/analytics` | `public`, `me` (role-specific), `admin` |
| `/reports` | `POST /` (report a donation) |
| `/categories` | public list of active categories |
| `/geo/search` | server-side geocoding proxy (needs `GEOCODER_API_KEY`) |
| `/admin` | users, organizations (decision), donations (suspend/unsuspend/reject), requests, pickups, reports (resolve), audit-logs, categories, settings |

## State machines (enforced server-side, `server/src/utils/statusMachine.js`)
- **Donation**: draft → available → request_pending / reserved → ready_for_pickup → picked_up → delivered → completed; side exits: cancelled, expired, rejected. The status is *derived* from quantities and request states; clients cannot set it.
- **Request**: pending → accepted → ready_for_pickup → picked_up → (delivered) → completed; side exits: rejected, cancelled, expired.
- **Pickup**: open → assigned → accepted → en_route → picked_up → delivered → completed (volunteers may release before pickup).

## Handover (QR) protocol
1. Donor (pickup) or organization (delivery) calls `POST /pickups/:id/handover-token` → random 144-bit token, only its SHA-256 hash is stored, valid 10 minutes.
2. The QR payload is `{"t":"fr-handover","p":"<pickupId>","k":"<token>"}`; a typed fallback code is shown.
3. The assigned volunteer calls `POST /pickups/:id/verify {token}`. One atomic update checks volunteer identity, current status, stage, hash and expiry, advances the state and deletes the token (single use).

## Real-time (Socket.IO)
Authenticated with the session cookie. Rooms: `user:<id>` (private notifications), `role:<role>` (e.g. new open pickups), `assignment:<id>` (live volunteer location, only for the three parties and only while sharing). Events: `notification`, `request:updated`, `pickup:updated`, `assignment:new`, `donation:new`, `location:update`. MongoDB is the source of truth; the client re-syncs counts on reconnect.
