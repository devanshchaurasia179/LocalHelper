import { Stack } from "expo-router";

export default function VerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="under-review" />
      <Stack.Screen name="rejected" />
    </Stack>
  );
}
