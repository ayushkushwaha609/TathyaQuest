import { create } from 'zustand';
import { lightColors, darkColors, ThemeColors } from '../constants/theme';

interface ThemeStore {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: true,
  colors: darkColors,
  toggleTheme: () =>
    set((state) => ({
      isDark: !state.isDark,
      colors: state.isDark ? lightColors : darkColors,
    })),
}));
