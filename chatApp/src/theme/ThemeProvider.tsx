import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { AccessibilityInfo, useColorScheme, useWindowDimensions } from 'react-native';
import { buildTheme, breakpoints, type Theme, type ThemeMode } from './index';
import { localCache } from '@/services/localCache';

export type ThemePreference = ThemeMode | 'system';

const PREF_KEY = 'theme.preference';

const isPreference = (v: string | null): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

type ThemeContextValue = Theme & {
  setMode: (mode: ThemePreference) => void;
  preference: ThemePreference;
  /** True when the OS asks for reduced motion — skip non-essential animation. */
  reducedMotion: boolean;
  /** Layout class derived from the current window width. */
  layout: 'compact' | 'medium' | 'expanded';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    localCache.getPref(PREF_KEY).then((stored) => {
      if (!cancelled && isPreference(stored)) setPreference(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReducedMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const resolved: ThemeMode =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  const setMode = useCallback((mode: ThemePreference) => {
    setPreference(mode);
    void localCache.setPref(PREF_KEY, mode);
  }, []);

  const layout: ThemeContextValue['layout'] =
    width >= breakpoints.desktop ? 'expanded' : width >= breakpoints.tablet ? 'medium' : 'compact';

  const value = useMemo<ThemeContextValue>(
    () => ({ ...theme, setMode, preference, reducedMotion, layout }),
    [theme, setMode, preference, reducedMotion, layout],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
