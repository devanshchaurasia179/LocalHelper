import { Stack } from "expo-router";
import { VerifiedGate } from "@/navigation/VerifiedGate";

export default function TabsLayout() {
  return (
    <VerifiedGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
      </Stack>
    </VerifiedGate>
  );
}