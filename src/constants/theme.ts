import palette from './palette.json';

// Styling is done with NativeWind classes (see tailwind.config.js).
// These values are only for props that take a colour directly,
// such as icon tints, placeholder text and navigator options.
export const colors = {
  ink: palette.ink.DEFAULT,
  red: palette.red.DEFAULT,
  redDark: palette.red.dark,
  gold: palette.gold.DEFAULT,
  goldDark: palette.gold.dark,
  inkDeep: palette.ink.deep,
  forest: palette.forest.DEFAULT,
  inkSoft: palette.ink.soft,
  sand: palette.sand,
  surface: palette.surface,
  border: palette.line,
  text: palette.fg.DEFAULT,
  textMuted: palette.fg.muted,
  textOnDark: palette['on-dark'].DEFAULT,
} as const;
