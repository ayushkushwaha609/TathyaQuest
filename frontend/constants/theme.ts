// TathyaCheck Design System — Warm Cream + Deep Indigo punch

export const lightColors = {
  // Punch & accent
  deepIndigo: '#2d1b69',
  navyBlue: '#3b2a80',
  deepTeal: '#4a3a94',
  saffron: '#e87c3e',
  warmOrange: '#f4a261',

  // Gradient (warm cream → soft peach)
  gradientStart: '#fffaf5',
  gradientEnd: '#fde4d0',

  // Surfaces
  background: '#fffaf5',
  card: '#ffffff',
  cardBorder: '#f0e0d0',
  inputBg: '#ffffff',
  divider: '#f0e6dc',
  sandstone: '#e8ddd0',

  // Verdict states
  verified: '#2d7a4f',
  verifiedBg: '#eaf5ef',
  false: '#c75b39',
  falseBg: '#fdf0ec',
  turmeric: '#d4a03c',
  turmericBg: '#fdf8ec',
  partialBg: '#f5f0ff',
  lotusRose: '#d4717a',

  // Text
  textPrimary: '#2a2233',
  textSecondary: '#6b6078',
  textTertiary: '#9a90a8',
  textOnDark: '#ffffff',

  // Overlays
  overlay: 'rgba(45, 27, 105, 0.92)',
  modalOverlay: 'rgba(0, 0, 0, 0.35)',

  // Status bar
  statusBar: 'dark' as const,
};

export const darkColors = {
  // Punch & accent (lightened for dark bg)
  deepIndigo: '#c4b5fd',
  navyBlue: '#a5b4fc',
  deepTeal: '#b8a9f0',
  saffron: '#f4a261',
  warmOrange: '#f4a261',

  // Gradient
  gradientStart: '#140e28',
  gradientEnd: '#1e1540',

  // Surfaces
  background: '#140e28',
  card: '#1e1750',
  cardBorder: '#2d2568',
  inputBg: '#1e1750',
  divider: '#2d2568',
  sandstone: '#2d2568',

  // Verdict states
  verified: '#4ade80',
  verifiedBg: '#0f2a1a',
  false: '#f87171',
  falseBg: '#2a0f0f',
  turmeric: '#fbbf24',
  turmericBg: '#2a2005',
  partialBg: '#1a1540',
  lotusRose: '#fb7185',

  // Text
  textPrimary: '#f0edf8',
  textSecondary: '#a8a0c0',
  textTertiary: '#7a7296',
  textOnDark: '#ffffff',

  // Overlays
  overlay: 'rgba(20, 14, 40, 0.95)',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',

  // Status bar
  statusBar: 'light' as const,
};

export type ThemeColors = Omit<typeof lightColors, 'statusBar'> & { statusBar: 'dark' | 'light' };

export const colors = lightColors;
