import { useEffect } from "react";
import { Tabs } from "expo-router";
import { VerifiedGate } from "@/navigation/VerifiedGate";
import { CallProvider } from "@/providers/CallProvider";
import { registerPushToken } from "@/services/push";

export default function TabsLayout() {
  // Register this device for push notifications. This layout only mounts once
  // the partner is authenticated (behind VerifiedGate/AuthGate), so the FCM
  // token POST carries the partner_token cookie. Fire-and-forget — failures
  // are logged internally and never block the UI.
  useEffect(() => {
    registerPushToken();
  }, []);

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
