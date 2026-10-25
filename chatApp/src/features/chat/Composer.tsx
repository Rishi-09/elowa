import React from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import type { Message } from '@/types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onStickers: () => void;
  /** Set while answering a message; shows a cancellable preview strip. */
  replyTo?: Message | null;
  replyToName?: string;
  onCancelReply: () => void;
  /** Set while editing an existing message. */
  editing?: Message | null;
  onCancelEdit: () => void;
  disabled?: boolean;
};

const previewOf = (m: Message): string => {
  switch (m.type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'gif':
      return 'GIF';
    case 'sticker':
      return 'Sticker';
    default:
      return m.body ?? '';
  }
};

export const Composer: React.FC<Props> = ({
  value,
  onChangeText,
  onSend,
  onAttach,
  onStickers,
  replyTo,
  replyToName,
  onCancelReply,
  editing,
  onCancelEdit,
  disabled,
}) => {
  const theme = useTheme();
  const canSend = value.trim().length > 0 && !disabled;
  const context = editing ?? replyTo ?? null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
      }}
    >
      {context ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm,
          }}
        >
          <Icon name={editing ? 'edit' : 'reply'} size="md" color="accent" />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="accent">
              {editing ? 'Editing message' : `Replying to ${replyToName ?? 'message'}`}
            </Text>
            <Text variant="small" color="textMuted" numberOfLines={1}>
              {previewOf(context)}
            </Text>
          </View>
          <IconButton
            name="close"
            accessibilityLabel={editing ? 'Cancel edit' : 'Cancel reply'}
            size="md"
            diameter={36}
            onPress={editing ? onCancelEdit : onCancelReply}
          />
        </View>
      ) : null}

      <View style={styles.row}>
        <IconButton
          name="attach"
          accessibilityLabel="Add attachment"
          accessibilityHint="Share a photo, video, GIF or sticker"
          onPress={onAttach}
          disabled={disabled || !!editing}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={editing ? 'Edit your message' : 'Message'}
          placeholderTextColor={theme.colors.textSubtle}
          accessibilityLabel="Message text"
          multiline
          editable={!disabled}
          style={[styles.input, { color: theme.colors.text }]}
        />
        {!editing ? (
          <IconButton
            name="sticker"
            accessibilityLabel="Stickers and GIFs"
            onPress={onStickers}
            disabled={disabled}
          />
        ) : null}
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save edit' : 'Send message'}
          accessibilityState={{ disabled: !canSend }}
          hitSlop={theme.touch.slop}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: canSend ? theme.colors.accent : theme.colors.surface,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Icon
            name={editing ? 'sent' : 'send'}
            size="md"
            color={canSend ? 'onAccent' : 'textSubtle'}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 6,
    paddingVertical: 11,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
