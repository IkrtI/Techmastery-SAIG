import { create } from 'zustand';

export type Theme = 'dark' | 'light';

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

const initial: Theme = (localStorage.getItem('mm-theme') as Theme) || 'light';
apply(initial);

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    localStorage.setItem('mm-theme', theme);
    apply(theme);
    set({ theme });
  },
}));
