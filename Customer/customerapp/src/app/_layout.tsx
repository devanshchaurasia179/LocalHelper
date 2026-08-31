import { DarkTheme, DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts as useOswald, Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { useFonts as usePlusJakarta, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts as useJost, Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from '@expo-google-fonts/jost';
import { useFonts as useArchivoBlack, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import Toast from 'react-native-toast-message';

import { AuthProvider } from '@/providers/AuthProvider';
import { registerGlobals } from '@livekit/react-native';
// Side-effect import: registers the FCM background/quit message handler and the
// Notifee background tap handler at module scope, before React mounts.
import '@/services/notificationsBackground';
import { initNotifications } from '@/services/notifications';
import { setupCallKeep } from '@/services/callkeep';

registerGlobals();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';

  // Attach foreground notification handlers (onMessage display, tap routing)
  // and ensure the Android channel exists. Also initialise CallKeep once so the
  // native incoming-call UI + its answer/end listeners are ready. Safe to run
  // once on mount (both are idempotent).
  useEffect(() => {
    initNotifications();
    setupCallKeep().catch(() => {});
  }, []);

  const [oswaldLoaded]       = useOswald({ Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold });
  const [jakartaLoaded]      = usePlusJakarta({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const [jostLoaded]         = useJost({ Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold });
  const [archivoLoaded]      = useArchivoBlack({ ArchivoBlack_400Regular });

  const fontsLoaded = oswaldLoaded && jakartaLoaded && jostLoaded && archivoLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
        <Toast />
      </ThemeProvider>
    </AuthProvider>
  );
}
