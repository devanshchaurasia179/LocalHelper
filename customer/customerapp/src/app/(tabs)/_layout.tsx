import { useEffect } from "react";
import { Tabs } from "expo-router";
import { connectChatSocket } from "@/services/chat.socket";

export default function TabsLayout() {
  // Connect socket early so call events (call_accepted, call_rejected)
  // can be received even before the user opens a chat screen.
  useEffect(() => {
    connectChatSocket().catch((err) => {
      console.warn("[TabsLayout] Socket connect failed (will retry):", err);
    });
  }, []);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="nearby" options={{ href: null }} />
    </Tabs>
  );
}
