import { DarkTheme, DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts, Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';

import { AuthProvider } from '@/providers/AuthProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';

  const [fontsLoaded] = useFonts({
    Oswald_400Regular,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

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
