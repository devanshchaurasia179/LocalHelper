import { Tabs } from "expo-router";
import { VerifiedGate } from "@/navigation/VerifiedGate";
import { CallProvider } from "@/providers/CallProvider";

export default function TabsLayout() {
  return (
    <VerifiedGate>
      <CallProvider>
        <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
          <Tabs.Screen name="home" />
          <Tabs.Screen name="wallet" />
          <Tabs.Screen name="bookings" />
          <Tabs.Screen name="chat" />
          <Tabs.Screen name="profile" />
        </Tabs>
      </CallProvider>
    </VerifiedGate>
  );
}
