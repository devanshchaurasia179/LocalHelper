import { Stack } from "expo-router";

export default function AccountStatusLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="suspended" />
      <Stack.Screen name="blocked" />
    </Stack>
  );
}
