import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  Archive,
  AtSign,
  Ban,
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Crown,
  Download,
  EllipsisVertical,
  Eye,
  EyeOff,
  FaceSlightlySmiling,
  FaceSlightlySmilingPlus,
  FileText,
  Film,
  Flag,
  Heart,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Maximize2,
  Menu,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Monitor,
  Moon,
  Paperclip,
  Pencil,
  Pin,
  Play,
  Plus,
  Reply,
  RotateCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SquarePen,
  Sticker,
  Sun,
  Timer,
  Trash,
  TriangleAlert,
  User,
  UserMinus,
  UserPlus,
  Users,
  Video,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { icon as iconTokens } from '@/theme';

/**
 * The app's complete icon vocabulary. Call sites use semantic names so the
 * mapping, stroke width and size ramp stay in one place — and so swapping an
 * icon is a one-line change here rather than a hunt through screens.
 *
 * Emoji are never used as interface icons. They remain valid only as
 * user-authored message content and as emoji reactions.
 */
const registry = {
  /* navigation */
  back: ArrowLeft,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  menu: Menu,
  more: EllipsisVertical,
  close: X,
  scrollDown: ArrowDown,

  /* chat actions */
  send: Send,
  attach: Paperclip,
  camera: Camera,
  photo: ImageIcon,
  video: Video,
  gif: Film,
  sticker: Sticker,
  emoji: FaceSlightlySmiling,
  react: FaceSlightlySmilingPlus,
  mic: Mic,
  reply: Reply,
  edit: Pencil,
  delete: Trash,
  copy: Copy,
  heart: Heart,
  document: FileText,

  /* delivery status */
  pending: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: CircleAlert,
  retry: RotateCw,

  /* media controls */
  play: Play,
  expand: Maximize2,
  download: Download,

  /* people & discovery */
  search: Search,
  newChat: SquarePen,
  newGroup: MessageSquarePlus,
  profile: User,
  group: Users,
  addMember: UserPlus,
  removeMember: UserMinus,
  admin: Crown,
  block: Ban,
  report: Flag,
  username: AtSign,
  message: MessageCircle,

  /* settings & system */
  settings: Settings,
  notifications: Bell,
  muted: BellOff,
  archive: Archive,
  pin: Pin,
  signOut: LogOut,
  privacy: Lock,
  security: ShieldCheck,
  timer: Timer,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  offline: WifiOff,
  add: Plus,
  visible: Eye,
  hidden: EyeOff,
  themeLight: Sun,
  themeDark: Moon,
  themeSystem: Monitor,
} as const;

export type IconName = keyof typeof registry;
export type IconSize = keyof Omit<typeof iconTokens, 'stroke'>;

export type IconProps = {
  name: IconName;
  /** Token from the icon size ramp, or an explicit pixel size. */
  size?: IconSize | number;
  /** Theme colour token, or an explicit colour for on-media overlays. */
  color?: keyof ThemeColors | (string & {});
  strokeWidth?: number;
  /** Icons are decorative by default; the surrounding control owns the label. */
  accessibilityLabel?: string;
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = 'text',
  strokeWidth = iconTokens.stroke,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const Glyph = registry[name];
  const px = typeof size === 'number' ? size : iconTokens[size];
  const resolved = (theme.colors as Record<string, string>)[color as string] ?? (color as string);

  return (
    <Glyph
      size={px}
      color={resolved}
      strokeWidth={strokeWidth}
      accessibilityRole={accessibilityLabel ? 'image' : 'none'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
};
