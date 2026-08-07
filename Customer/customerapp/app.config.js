// app.config.js — dynamic config to inject env vars into native config
// NOTE: dotenv only runs locally; on EAS use `eas secret:create` or eas.json env to set MAPS_KEY
try { require("dotenv").config(); } catch (_) {}
const baseConfig = require("./app.json");

module.exports = {
  expo: {
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
  },
};
