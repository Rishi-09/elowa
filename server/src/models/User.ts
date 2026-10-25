import { Schema, model, type InferSchemaType, type Model, Types } from 'mongoose';

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 24,
      match: /^[a-z0-9_]+$/,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 48 },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
    bio: { type: String, default: null, maxlength: 240 },
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    pushToken: { type: String, default: null, select: false },
    pushPrefs: {
      enabled: { type: Boolean, default: true },
      showPreview: { type: Boolean, default: true },
    },
    /**
     * Privacy choices are enforced server-side, never merely hidden in the UI:
     * presence is stripped from payloads and withheld from realtime events,
     * and read receipts are not broadcast when the reader opted out.
     */
    privacy: {
      showPresence: { type: Boolean, default: true },
      showReadReceipts: { type: Boolean, default: true },
      searchable: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

userSchema.index({ username: 'text', displayName: 'text' });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User: Model<UserDoc> = model<UserDoc>('User', userSchema);

export type PrivacyPrefs = {
  showPresence: boolean;
  showReadReceipts: boolean;
  searchable: boolean;
};

export const DEFAULT_PRIVACY: PrivacyPrefs = {
  showPresence: true,
  showReadReceipts: true,
  searchable: true,
};

export const privacyOf = (u: Pick<UserDoc, 'privacy'>): PrivacyPrefs => ({
  showPresence: u.privacy?.showPresence ?? DEFAULT_PRIVACY.showPresence,
  showReadReceipts: u.privacy?.showReadReceipts ?? DEFAULT_PRIVACY.showReadReceipts,
  searchable: u.privacy?.searchable ?? DEFAULT_PRIVACY.searchable,
});

/**
 * Profile shape for someone the caller shares a conversation with. Presence is
 * included only when that user allows it.
 */
export const publicUser = (u: UserDoc) => {
  const privacy = privacyOf(u);
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isOnline: privacy.showPresence ? u.isOnline : false,
    lastSeenAt: privacy.showPresence ? u.lastSeenAt : null,
  };
};

/** The caller's own profile: presence of their own is never hidden from them. */
export const selfUser = (u: UserDoc) => ({
  id: String(u._id),
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  isOnline: u.isOnline,
  lastSeenAt: u.lastSeenAt,
  privacy: privacyOf(u),
});
