import { useEffect } from "react";
import { Tabs } from "expo-router";
import { connectChatSocket } from "@/services/chat.socket";
import { CallProvider } from "@/providers/CallProvider";

export default function TabsLayout() {
  // Connect socket early so call events can be received
  // even before the user opens a chat screen.
  useEffect(() => {
    connectChatSocket().catch(() => {});
  }, []);

  return (
    <CallProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          freezeOnBlur: true, // Freeze inactive tabs to save memory
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="bookings" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="wallet" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="nearby" options={{ href: null }} />
      </Tabs>
    </CallProvider>
  );
}
