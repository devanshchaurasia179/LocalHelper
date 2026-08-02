// app.config.js — dynamic config so we can inject env vars into native config
const baseConfig = require("./app.json");

module.exports = {
  ...baseConfig.expo,
  ios: {
    ...baseConfig.expo.ios,
    config: {
      googleMapsApiKey: process.env.MAPS_KEY,
    },
  },
  android: {
    ...baseConfig.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.MAPS_KEY,
      },
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
  ],
};
