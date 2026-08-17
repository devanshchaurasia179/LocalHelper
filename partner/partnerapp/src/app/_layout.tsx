import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Slot } from "expo-router";
import {
  useFonts as useOswald,
  Oswald_400Regular,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from "@expo-google-fonts/oswald";
import {
  useFonts as usePlusJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  useFonts as useJost,
  Jost_300Light,
  Jost_400Regular,
  Jost_500Medium,
  Jost_600SemiBold,
} from "@expo-google-fonts/jost";
import {
  useFonts as useArchivoBlack,
  ArchivoBlack_400Regular,
} from "@expo-google-fonts/archivo-black";

import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { registerGlobals } from "@livekit/react-native";

registerGlobals();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "light";

  const [oswaldLoaded] = useOswald({
    Oswald_400Regular,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });
  const [jakartaLoaded] = usePlusJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [jostLoaded] = useJost({
    Jost_300Light,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });
  const [archivoLoaded] = useArchivoBlack({ ArchivoBlack_400Regular });

  const fontsLoaded =
    oswaldLoaded && jakartaLoaded && jostLoaded && archivoLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Never return null — returning null unmounts the Slot while Expo Router's
  // useLinking still has async URL resolution in-flight. That causes the
  // "state update on a component that hasn't mounted yet" warning because the
  // navigator fiber is gone when the promise resolves.
  // Keep Slot mounted always; the splash screen hides content until fonts load.
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Slot />
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
