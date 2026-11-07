// Design tokens for SaveMan Consultant. Colours live in src/constants/palette.json
// so the same values are shared with JS-only props (icon tints, tab bar options).
const palette = require('./src/constants/palette.json');

// w-pct-0 ... w-pct-100: whole-percent widths for bars drawn from data (built at runtime, so safelisted below).
const percentWidths = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`pct-${i}`, `${i}%`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  safelist: [{ pattern: /^w-pct-\d+$/ }],
  // Light mode only. 'class' stops NativeWind's web runtime from throwing when the page's colour scheme changes.
  darkMode: 'class',
  theme: {
    extend: {
      // PNG flag black, crimson and burnished gold, softened with warm neutrals and rainforest green.
      // Usage: bg-ink, text-red, bg-red-tint, border-line, text-fg-muted, text-on-dark ...
      colors: palette,
      // Type scale. No line-heights, to keep React Native's default text metrics.
      fontSize: {
        display: ['30px', { letterSpacing: '-0.5px', fontWeight: '800' }],
        title: ['22px', { fontWeight: '700' }],
        heading: ['17px', { fontWeight: '700' }],
        body: '15px',
        label: ['13px', { fontWeight: '600' }],
        caption: '12px',
      },
      borderRadius: {
        card: '20px',
      },
      width: percentWidths,
      // Soft, warm shadows (ink-tinted). Native needs a background colour on the element to show them.
      boxShadow: {
        card: '0 1px 2px rgba(23, 18, 15, 0.05), 0 6px 18px rgba(23, 18, 15, 0.06)',
        raised: '0 8px 24px rgba(23, 18, 15, 0.14)',
      },
    },
  },
  // NativeWind 4.2.7 includes its safe-area utilities (pt-safe-offset-2 ...) only in the native preset.
  // Add them for web too (same check NativeWind uses to pick a preset); browsers resolve them with env().
  plugins: process.env.NATIVEWIND_OS === undefined || process.env.NATIVEWIND_OS === 'web' ? [require('nativewind/dist/tailwind/safe-area').safeArea] : [],
};
