import { DarkTheme, DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts as useOswald, Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { useFonts as useCinzel, Cinzel_400Regular, Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { useFonts as usePlusJakarta, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts as useJost, Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from '@expo-google-fonts/jost';
import { useFonts as useArchivoBlack, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';

import { AuthProvider } from '@/providers/AuthProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';

  const [oswaldLoaded]       = useOswald({ Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold });
  const [cinzelLoaded]       = useCinzel({ Cinzel_400Regular, Cinzel_700Bold, Cinzel_900Black });
  const [jakartaLoaded]      = usePlusJakarta({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const [jostLoaded]         = useJost({ Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold });
  const [archivoLoaded]      = useArchivoBlack({ ArchivoBlack_400Regular });

  const fontsLoaded = oswaldLoaded && cinzelLoaded && jakartaLoaded && jostLoaded && archivoLoaded;

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
      </ThemeProvider>
    </AuthProvider>
  );
}
