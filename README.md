# Whisper Server (Phase 3)

Node.js + Express + MongoDB backend for the Whisper messenger.

## What's implemented

- Auth: register, login, refresh (rotating + reuse detection), logout
  - Argon2id password hashing
  - Access JWT (10 min default), opaque refresh token (SHA-256 hashed at rest, 30 d default)
- Users: username/display-name prefix search, get by id
- Conversations: list, create (idempotent 1:1), update disappearing TTL
- Messages: send (with `clientMessageId` idempotency), cursor-paginated list, edit, soft delete, mark read via service
- Profile: read, patch, push-token registration
- Middleware: helmet, CORS, zod validation, auth guard, rate limiting (auth + general), structured errors
- Pino logging with secret redaction
- TTL indexes on `Message.expiresAt` and `RefreshToken.expiresAt`

Not yet implemented (later phases): Socket.IO realtime handlers (Phase 4),
media signing + Cloudinary (Phase 5), E2EE (Phase 6), push dispatch (Phase 7).

## Setup

```bash
cd server
cp .env.example .env         # edit secrets
npm install
npm run dev
```

Requires MongoDB running locally (default `mongodb://localhost:27017/whisper`).

## Response envelope

```json
{ "ok": true, "data": ... }
{ "ok": false, "error": { "code": "string", "message": "string" } }
```

## Endpoints

```
POST   /api/auth/register       { username, displayName, password }
POST   /api/auth/login          { username, password }
POST   /api/auth/refresh        { refreshToken }
POST   /api/auth/logout         { refreshToken? }

GET    /api/users/search?q=&limit=
GET    /api/users/:id

GET    /api/conversations
POST   /api/conversations                       { peerUserId }
PATCH  /api/conversations/:id                   { disappearingTtlSeconds }

GET    /api/conversations/:conversationId/messages?before=&limit=

POST   /api/messages            { conversationId, clientMessageId, type, body?, media?, replyToId? }
PATCH  /api/messages/:id        { body }
DELETE /api/messages/:id

GET    /api/profile
PATCH  /api/profile             { displayName?, bio?, avatarUrl? }

POST   /api/devices/push-token  { token }
```

All routes except `/api/auth/*` and `/api/health` require `Authorization: Bearer <accessToken>`.

## Security notes

- Passwords are hashed with Argon2id; never returned.
- Refresh tokens are stored as SHA-256 hashes; raw token leaves the server exactly once.
- Refresh rotation: using an already-rotated token revokes the whole chain for that user.
- All request bodies validated via zod; failures surface as `validation_error`.
- Rate limiting: 20 auth attempts / 15 min, 120 general requests / minute per IP.
- `clientMessageId` is unique per sender → send retries are idempotent, never duplicate.
- Membership check runs before every conversation/message read or mutation (no IDOR).
- Messages have a TTL index (`expiresAt`) so disappearing messages are server-enforced.
- Server CAN read message content in the MVP. E2EE is not implemented. See [../chatApp/CLAUDE.md](../chatApp/CLAUDE.md).
