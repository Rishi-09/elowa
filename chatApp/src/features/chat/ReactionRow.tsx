import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types';

/** The quick-pick set offered in the message menu. */
export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

type Props = {
  message: Message;
  align: 'left' | 'right';
};

/**
 * Reaction chips under a bubble. The emoji here are user content, not
 * interface icons, so they are rendered as the characters people picked.
 */
export const ReactionRow: React.FC<Props> = ({ message, align }) => {
  const theme = useTheme();
  const me = useAuthStore((s) => s.user?.id);
  const react = useMessageStore((s) => s.react);

  const groups = useMemo(() => {
    const counts = new Map<string, { count: number; mine: boolean }>();
    for (const r of message.reactions ?? []) {
      const entry = counts.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.userId === me) entry.mine = true;
      counts.set(r.emoji, entry);
    }
    return Array.from(counts.entries());
  }, [message.reactions, me]);

  if (!groups.length) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.xs,
        marginTop: theme.spacing.xs,
        marginBottom: theme.spacing.xxs,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {groups.map(([emoji, { count, mine }]) => (
        <Pressable
          key={emoji}
          onPress={() => {
            if (me) void react(message.conversationId, message.id, emoji, me).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={`${emoji} reaction, ${count}${mine ? ', including yours' : ''}`}
          accessibilityState={{ selected: mine }}
          hitSlop={6}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 3,
            borderRadius: theme.radius.pill,
            backgroundColor: mine ? theme.colors.accentMuted : theme.colors.surfaceElevated,
            borderWidth: 1,
            borderColor: mine ? theme.colors.accentSoft : theme.colors.border,
          }}
        >
          <Text variant="caption" style={{ fontSize: 13 }}>
            {emoji}
          </Text>
          <Text variant="caption" color={mine ? 'accent' : 'textMuted'}>
            {count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

/** Emoji picker strip shown at the top of the message action sheet. */
export const ReactionPicker: React.FC<{
  onPick: (emoji: string) => void;
  selected?: string | null;
}> = ({ onPick, selected }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.md,
      }}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onPick(emoji)}
          accessibilityRole="button"
          accessibilityLabel={`React with ${emoji}`}
          accessibilityState={{ selected: selected === emoji }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              selected === emoji
                ? theme.colors.accentMuted
                : pressed
                  ? theme.colors.surface
                  : 'transparent',
          })}
        >
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
};
