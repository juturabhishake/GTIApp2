import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppTheme = 'light' | 'dark';

const palettes = {
  light: {
    background: '#f3f6f8',
    surface: 'rgba(255,255,255,0.88)',
    surfaceSolid: '#ffffff',
    surfaceAlt: '#edf2f4',
    text: '#172b36',
    muted: '#6d7e87',
    border: 'rgba(30,58,70,0.12)',
    accent: '#167f70',
    accentStrong: '#0e665b',
    accentSoft: 'rgba(22,127,112,0.12)',
    danger: '#c74646',
    shadow: '#243e48',
  },
  dark: {
    background: '#10191e',
    surface: 'rgba(26,39,46,0.94)',
    surfaceSolid: '#1a272e',
    surfaceAlt: '#22323a',
    text: '#edf4f5',
    muted: '#a0b1b8',
    border: 'rgba(218,235,239,0.12)',
    accent: '#65c7b0',
    accentStrong: '#89deca',
    accentSoft: 'rgba(101,199,176,0.15)',
    danger: '#ff8585',
    shadow: '#000000',
  },
} as const;

type ThemeContextValue = {
  preference: ThemePreference;
  theme: AppTheme;
  colors: (typeof palettes)[AppTheme];
  ready: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: React.PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPreference = async () => {
      try {
        const stored = Platform.OS === 'web'
          ? (typeof localStorage === 'undefined' ? null : localStorage.getItem('gti_theme'))
          : await SecureStore.getItemAsync('gti_theme');
        if (active && (stored === 'system' || stored === 'light' || stored === 'dark')) {
          setPreferenceState(stored);
        }
      } catch (error) {
        console.error('Unable to load saved theme preference:', error);
      } finally {
        if (active) setReady(true);
      }
    };
    loadPreference();
    return () => {
      active = false;
    };
  }, []);

  const setPreference = async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem('gti_theme', nextPreference);
      return;
    }
    await SecureStore.setItemAsync('gti_theme', nextPreference);
  };

  const theme: AppTheme = preference === 'system'
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : preference;
  const value = useMemo(
    () => ({ preference, theme, colors: palettes[theme], ready, setPreference }),
    [preference, theme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within AppThemeProvider');
  return context;
}
