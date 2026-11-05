const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem: 16 so Tailwind spacing matches the web (p-4 = 16px). NativeWind defaults to 14 on native.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
