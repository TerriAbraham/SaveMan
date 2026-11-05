// Palette inspired by the Papua New Guinea flag (black, red, gold)
// softened with warm sand and rainforest tones for a professional feel.
export const colors = {
  ink: '#14110F', // near-black, from the flag
  inkSoft: '#2A2420',
  red: '#C8102E', // flag red
  redDark: '#9E0C24',
  redTint: '#FBE9EC',
  gold: '#F2B705', // bird of paradise gold
  goldTint: '#FFF6D9',
  forest: '#1F6F50', // rainforest green, used for success / verified
  forestTint: '#E3F2EA',
  sand: '#FAF6F0', // app background
  surface: '#FFFFFF',
  border: '#E8E0D5',
  text: '#1C1917',
  textMuted: '#6B625A',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#CFC6BC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;
