import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="add-service" />
      <Stack.Screen name="upload-documents" />
    </Stack>
  );
}
