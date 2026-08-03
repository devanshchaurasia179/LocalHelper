// app.config.js — dynamic config so we can inject env vars into native config
// NOTE: dotenv only runs locally; on EAS use `eas secret:create` or eas.json env to set MAPS_KEY
require("dotenv").config();
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
  // plugins are inherited from app.json via the spread above — no override needed
};
