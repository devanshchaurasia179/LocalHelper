import { Stack } from "expo-router";
import { OnboardingProvider } from "@/contexts/OnboardingContext";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="add-service" />
        <Stack.Screen name="upload-documents" />
      </Stack>
    </OnboardingProvider>
  );
}
