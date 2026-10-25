import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { MessageStatus as Status } from '@/types';

const GLYPH: Record<Status, IconName> = {
  sending: 'pending',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

export const STATUS_LABEL: Record<Status, string> = {
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
};

type Props = {
  status: Status;
  /** Colour used for every state except `read` and `failed`. */
  color: string;
  /** Colour for the `read` state — the accent that signals "seen". */
  readColor: string;
  failedColor: string;
  size?: number;
};

/** Delivery indicator for outgoing messages. Icons only — no tick characters. */
export const MessageStatusIcon: React.FC<Props> = ({
  status,
  color,
  readColor,
  failedColor,
  size = 14,
}) => (
  <Icon
    name={GLYPH[status]}
    size={size}
    color={status === 'failed' ? failedColor : status === 'read' ? readColor : color}
    strokeWidth={2}
    accessibilityLabel={STATUS_LABEL[status]}
  />
);
