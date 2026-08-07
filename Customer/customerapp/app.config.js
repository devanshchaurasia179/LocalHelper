// app.config.js — reads MAPS_KEY from .env at build/config time so the
// raw key never lives in app.json or source control.
// MAPS_KEY (no EXPO_PUBLIC_ prefix) is used only here for native map tiles;
// EXPO_PUBLIC_MAPS_KEY is the same value, used by JS at runtime for Places API.

const { withAppBuildGradle } = require("expo/config-plugins");

/** @type {import('expo/config').ConfigContext} */
module.exports = ({ config }) => {
  const mapsKey = process.env.MAPS_KEY ?? "";

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []).filter(
        (p) =>
          !(
            Array.isArray(p) &&
            p[0] === "react-native-maps"
          )
      ),
      [
        "react-native-maps",
        {
          googleMapsApiKey: mapsKey,
        },
      ],
    ],
  };
};
