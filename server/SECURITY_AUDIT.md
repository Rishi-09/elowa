# Phase 9 — Security Audit

Senior-engineer pass over the whole backend + socket + mobile surface.
Each item below was checked against the actual code and either marked
compliant with the file reference, or fixed in this phase and tested.

## Authentication

- **Password hashing**: Argon2id. Confirmed `auth.service.ts:register`.
- **Timing-safe login**: on missing user we still run a dummy argon2 hash so
  the response time doesn't distinguish "no such user" from "bad password".
  Confirmed `auth.service.ts:login`.
- **Refresh rotation**: every refresh issues a new opaque token, hashes it
  with SHA-256 before storing, and marks the previous one as replaced.
  Confirmed `auth.service.ts:issueRefresh` + regression test
  `auth.test.ts` (refresh rotates tokens…).
- **Reuse detection**: if a client presents an already-rotated token, the
  whole chain is revoked. Confirmed `auth.service.ts:refresh` + regression
  test `auth.test.ts` (…and detects reuse).
- **Token storage on device**: `secureStorage.ts` always uses Expo
  SecureStore (never AsyncStorage).
- **JWT secrets**: zod requires >= 16 chars; env fails fast if missing.
  Confirmed `config/env.ts`.

## Authorization / IDOR

- **Conversation list** filters by `participantIds: me`.
  Confirmed `conversations.routes.ts:list` + regression test
  `conversations.test.ts` (listing excludes conversations…).
- **Message read/write** gated by `assertMember`. Confirmed
  `messages.service.ts:assertMember` + regression tests
  `messages.test.ts` (non-member cannot read or write…).
- **Message edit/delete** check `senderId.equals(userId)`. Confirmed
  `messages.service.ts:edit` + regression test
  `messages.test.ts` (only sender can edit…).
- **Disappearing TTL** patch runs the membership filter in the Mongo query
  itself. Confirmed `conversations.routes.ts:patch` + regression test.
- **Socket handlers** re-check `assertMember` before every room emit —
  `conversation:join`, `typing:start/stop`. Confirmed `socketServer.ts`.
- **Push dispatch** reads participants from the DB, not the client payload,
  and only sends to the counterparty. Confirmed `socketServer.ts`
  (message:send side-effect).

## Users endpoint — hardened this phase

**Finding**: `GET /api/users/search` and `GET /api/users/:id` previously
returned the full public profile — including `isOnline` and `lastSeenAt` —
to any authenticated caller. Combined with the username search (which
reveals which handles exist), this let any account poll presence for
arbitrary users without ever starting a conversation.

**Fix**: both endpoints now return a *discovery* projection that omits
presence fields. `GET /api/users/:id` upgrades to the full projection only
when the caller shares a conversation with the target (established
relationship). See `users.routes.ts:discoveryUser` +
`users.routes.ts:haveSharedConversation`.

**Regression tests**: `users.test.ts` — search never exposes presence,
`/users/:id` hides presence from strangers but reveals it after a shared
conversation exists, and search sanitizes regex metacharacters.

## Input validation

- Every mutation body is validated with zod before controller logic.
  Confirmed in each `*.routes.ts`.
- Query strings validated via `validateQuery` (`users.search`,
  `conversation messages list`, `gifs search`, etc.).
- Username search sanitizes to `[a-z0-9_]` *before* building the regex, so
  `.*` or `^(a+)+$` style inputs can't cause ReDoS or wildcard
  enumeration. Covered by `users.test.ts` (regex metacharacters).

## Rate limiting

- `authLimiter`: 20 attempts / 15 min / IP for register + login + refresh.
- `generalLimiter`: 120 / minute / IP applied globally.
- Rate-limit responses still use the project response envelope.

## Media

- Signed uploads expire in 10 minutes and are scoped to
  `whisper/u_<userId>/<kind>/` so a client can't request a signature that
  overwrites someone else's assets.
- `confirm` validates:
  - MIME against a per-kind allowlist (`CloudinaryProvider.ts`).
  - Size against the server-side cap (not just the client's claim).
  - `publicId` has the caller's folder prefix — rejects attempts to attach
    another user's uploaded file to your own message.

## Realtime

- JWT in handshake; invalid or missing token rejected immediately
  (`authSocket.ts`).
- `message:send` reuses the same service as REST, so idempotency via
  `clientMessageId` applies on both transports. Covered by
  `messages.test.ts` (clientMessageId retry is idempotent).
- Server assigns `_id` and `createdAt`; the client cannot forge ordering.
- Rooms are membership-scoped; `typing:start/stop` ignored silently if the
  caller is not a member (no information leak via error channel).

## Push notifications

- Payload contains only `{ conversationId }` for deep-linking. Preview
  text in title/body is suppressed when the recipient has
  `pushPrefs.showPreview = false` — the server never puts message content
  on the Expo push payload in that case.
- `DeviceNotRegistered` tickets null out the stale token so revoked
  devices stop receiving pushes.
- Signing out `DELETE`s the device token server-side.

## Logging

- `pino` configured with redaction on `req.headers.authorization`,
  `*.password`, `*.passwordHash`, `*.refreshToken`. Confirmed
  `lib/logger.ts`.
- Error handler never serializes the raw `Error` — only `{code, message}`.
- Push dispatcher logs only error metadata on failure, not the body text.

## Known tradeoffs (documented, not bugs)

- **No E2EE in MVP**. Transport-only confidentiality. The
  `MessageCrypto` abstraction (`chatApp/src/features/privacy/MessageCrypto.ts`)
  lets us swap in Signal protocol later without touching the wire format.
  The UI never claims E2EE while `plaintextCrypto` is active.
- **Local SQLite plaintext**. Documented in
  `chatApp/src/features/privacy/README.md`. Cleared on sign-out. Encrypting
  the cache belongs with E2EE because it's the same key-management
  problem.
- **Access-token lifetime vs. socket lifetime**. The JWT is 10 min; a
  connected socket keeps its original claim until it reconnects. For MVP
  this is acceptable — the socket is always re-authenticated on reconnect
  because the client refreshes the access token first. A per-interval
  socket re-auth is a Phase 10 hardening.

## Test coverage summary

Running `npm test` in `server/` executes against an in-memory MongoDB:

- `auth.test.ts` — register duplicate, login lowercase + wrong password +
  missing user, refresh rotation + reuse detection, protected-route guard,
  validation error shape.
- `conversations.test.ts` — idempotent create, cannot message self, IDOR
  on list, IDOR on patch.
- `messages.test.ts` — send + list, `clientMessageId` idempotency, IDOR
  on read + write, edit/delete authorization, disappearing TTL assigns
  `expiresAt`, empty text body rejected, non-existent conversation
  rejected.
- `users.test.ts` — search omits presence, `GET /users/:id` reveals
  presence only after a shared conversation exists, regex metacharacter
  sanitization.
