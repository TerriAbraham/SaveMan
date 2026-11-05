// Design tokens for SaveMan Consultant. Colours live in src/constants/palette.json
// so the same values are shared with JS-only props (icon tints, tab bar options).
const palette = require('./src/constants/palette.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // PNG flag black, red and gold, softened with sand and rainforest green.
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
        card: '18px',
      },
    },
  },
  plugins: [],
};
