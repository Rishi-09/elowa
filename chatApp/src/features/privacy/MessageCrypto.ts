export type CipherEnvelope = {
  v: 1;
  alg: 'plain' | 'xchacha20-poly1305-signal-v1';
  ciphertext: string;
  nonce?: string;
  ad?: string;
};

export type ConversationKeys = {
  conversationId: string;
};

export interface MessageCrypto {
  readonly algorithm: CipherEnvelope['alg'];
  readonly isEndToEnd: boolean;
  encrypt(plaintext: string, ctx: ConversationKeys): Promise<CipherEnvelope>;
  decrypt(envelope: CipherEnvelope, ctx: ConversationKeys): Promise<string>;
  serialize(envelope: CipherEnvelope): string;
  parse(wire: string): CipherEnvelope | null;
}

const PLAIN_PREFIX = 'p1:';

export const plaintextCrypto: MessageCrypto = {
  algorithm: 'plain',
  isEndToEnd: false,

  async encrypt(plaintext) {
    return { v: 1, alg: 'plain', ciphertext: plaintext };
  },

  async decrypt(envelope) {
    if (envelope.alg !== 'plain') {
      throw new Error(`Cannot decrypt envelope with alg=${envelope.alg} using plaintext crypto`);
    }
    return envelope.ciphertext;
  },

  serialize(envelope) {
    if (envelope.alg !== 'plain') {
      throw new Error('plaintextCrypto cannot serialize non-plain envelopes');
    }
    return envelope.ciphertext;
  },

  parse(wire) {
    if (typeof wire !== 'string') return null;
    if (wire.startsWith(PLAIN_PREFIX)) {
      return { v: 1, alg: 'plain', ciphertext: wire.slice(PLAIN_PREFIX.length) };
    }
    return { v: 1, alg: 'plain', ciphertext: wire };
  },
};

export const messageCrypto: MessageCrypto = plaintextCrypto;
