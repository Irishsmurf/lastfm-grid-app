'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme | 'system';
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    let initialValue: Theme;
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem(storageKey) as
        | Theme
        | 'system'
        | null;
      if (storedTheme === 'light' || storedTheme === 'dark') {
        initialValue = storedTheme;
      } else if (storedTheme === 'system') {
        initialValue = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else if (defaultTheme === 'system') {
        initialValue = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else {
        initialValue = defaultTheme as Theme; // defaultTheme is 'light' or 'dark' at this point
      }
    } else {
      // SSR default
      if (defaultTheme === 'system') {
        initialValue = 'light'; // Default for SSR if system is chosen, can be 'dark' too
      } else {
        initialValue = defaultTheme as Theme;
      }
    }
    return initialValue;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme); // 'theme' is already resolved to 'light' or 'dark'
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, theme);
    }
  }, [theme, storageKey]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
