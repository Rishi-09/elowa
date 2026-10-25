# Whisper

A privacy-focused mobile messenger built with React Native + Expo + TypeScript.
See [CLAUDE.md](CLAUDE.md) for product vision and architecture rules.

## Status

Phase 2 (Mobile Foundation) scaffolded:

- Expo + TypeScript + Expo Router
- Centralized theme (light/dark/system) with no hardcoded colors
- Auth gate with session restore via SecureStore
- Reusable UI primitives (`Screen`, `Text`, `Button`, `Input`, `Avatar`)
- Auth screens (login, register)
- Main shell (chats list, chat screen, settings, profile)
- Zustand auth store, TanStack Query provider, API client

Backend (Phase 3), realtime (Phase 4), media (Phase 5), privacy (Phase 6),
push (Phase 7), polish (Phase 8), and tests (Phase 9) are not yet implemented.

## Privacy stance

End-to-end encryption is **not** implemented in the MVP. Transport is HTTPS/WSS
only; the server can read message content. A `MessageCrypto` abstraction
lives at [src/features/privacy/MessageCrypto.ts](src/features/privacy/MessageCrypto.ts)
so a real Signal-protocol adapter can replace `plaintextCrypto` later without
changing wire format or call sites. The conversation-settings screen says
this plainly; we will not claim E2EE in the UI until the real thing ships.

**Disappearing messages are implemented** — server-enforced via a Mongo TTL
index on `Message.expiresAt`, with a 30-second client-side sweeper that
mirrors the same deadline on the local SQLite cache and the in-memory store.
Per-conversation TTL (`Off / 24h / 7d / 30d`) is set in the conversation
settings modal.

See [src/features/privacy/README.md](src/features/privacy/README.md) for the
full write-up.

## Setup

```bash
cd chatApp
npm install
npm start
```

Then press `a` for Android or `i` for iOS.

### Environment

Configure the API/socket URLs in `app.json` under `expo.extra`, or via
`EXPO_PUBLIC_*` conventions once a backend is running:

```json
{
  "expo": {
    "extra": {
      "API_BASE_URL": "http://10.0.2.2:4000/api",
      "SOCKET_URL": "http://10.0.2.2:4000"
    }
  }
}
```

Use `10.0.2.2` for Android emulator, `localhost` for iOS simulator, or your
LAN IP for a physical device.

## Project layout

See the structure in [CLAUDE.md](CLAUDE.md#mobile-project-structure). Current:

```
app/              Expo Router routes
  _layout.tsx     Theme + QueryClient + auth gate
  (auth)/        login, register
  (main)/        chats, settings, profile, chat/[id]
src/
  components/ui/ reusable primitives
  theme/         tokens + provider
  stores/        Zustand stores
  services/      api, secureStorage
  features/      feature modules (auth, chat, ...)
  types/         shared types
  constants/     config
```

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios`
- `npm run typecheck`
