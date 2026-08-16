import { Stack } from "expo-router";

/**
 * (auth) group layout.
 * No tabs here – pure stack navigation for login → OTP flow.
 * Header is hidden; each screen controls its own back button.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="send-otp" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
