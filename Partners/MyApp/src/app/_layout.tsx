import { Slot } from "expo-router";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../providers/AuthProvider";
import { AuthGate } from "../providers/AuthGate";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          <Slot />
          <Toast />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
