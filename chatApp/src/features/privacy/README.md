# Privacy Architecture

## Current state (MVP)

End-to-end encryption is **NOT** implemented. The default `messageCrypto`
export is `plaintextCrypto`, which is a no-op pass-through. The server can
read all message content.

Transport is HTTPS/WSS. Local caches use Expo SQLite (non-encrypted at the
SDK level — rely on the OS data-protection class, not application crypto).
Authentication credentials live in Expo SecureStore (Keychain/Keystore).

The UI MUST NOT claim "end-to-end encrypted" anywhere until a real crypto
implementation ships. The [settings screen](../../../app/(main)/conversation-settings.tsx)
states the current status plainly.

## Why ship a no-op abstraction

So the wire format and call sites don't change when real E2EE lands. All
message bodies that need confidentiality should flow through this interface:

```ts
import { messageCrypto } from '@/features/privacy/MessageCrypto';
const env = await messageCrypto.encrypt(body, { conversationId });
await send(env.ciphertext);
```

Swapping the implementation later means replacing `plaintextCrypto` with a
real adapter (e.g. one built on `@signalapp/libsignal-client`) and nothing
else.

## What the real adapter must do

- Use an established protocol/library. Do not invent cryptography.
- Store identity + session keys in Expo SecureStore keyed by `userId`.
- Rotate session state via a Double Ratchet.
- Attach `alg: 'xchacha20-poly1305-signal-v1'` (or whatever the chosen
  protocol advertises) so legacy plaintext envelopes remain decodable until
  all conversations have migrated.
- Fail closed: if decryption fails, the UI must show "unable to decrypt",
  never silently display ciphertext.

## Disappearing messages

Server-enforced via a Mongo TTL index on `Message.expiresAt`. When a
conversation has `disappearingTtlSeconds > 0`, every new message gets an
`expiresAt` computed server-side at send time. The client additionally
sweeps the local SQLite cache on launch and every 30 seconds to drop
expired rows between TTL-index runs.

Clients MUST NOT trust the client clock for expiration — all `expiresAt`
values come from the server.
