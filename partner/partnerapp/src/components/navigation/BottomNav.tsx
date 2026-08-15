import { useEffect, useCallback, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, radii, fonts } from "@/constants/theme";
import { fetchMyConversations } from "@/api/chat.api";
import { connectChatSocket, getChatSocket } from "@/services/chat.socket";

type TabRoute = "home" | "wallet" | "bookings" | "chat" | "profile";

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PILL_MIN = 48;
const PILL_MAX = 110;

const NAV_ITEMS: {
  route: TabRoute;
  matchKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { route: "home", matchKey: "home", icon: "home-outline", activeIcon: "home", label: "Home" },
  { route: "wallet", matchKey: "wallet", icon: "wallet-outline", activeIcon: "wallet", label: "Wallet" },
  { route: "bookings", matchKey: "bookings", icon: "calendar-outline", activeIcon: "calendar", label: "Bookings" },
  { route: "chat", matchKey: "chat", icon: "chatbubble-outline", activeIcon: "chatbubble", label: "Chat" },
  { route: "profile", matchKey: "profile", icon: "person-outline", activeIcon: "person", label: "Profile" },
];

function NavItem({
  item,
  isActive,
  onPress,
  showBadge,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onPress: () => void;
  showBadge?: boolean;
}) {
  const progress = useSharedValue(isActive ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: isActive ? 280 : 200,
      easing: EASE,
    });
  }, [isActive]);

  const pillWidthStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [PILL_MIN, PILL_MAX]),
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55, 1], [0, 0, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [6, 0]) }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.87, { duration: 80, easing: Easing.out(Easing.quad) });
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { stiffness: 320, damping: 14 });
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      <Animated.View style={pressStyle}>
        {/* Badge dot — shown when there are unread messages */}
        {showBadge && !isActive && <View style={styles.badgeDot} />}
        <Animated.View style={[styles.pill, pillWidthStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pillBg, bgStyle]} />
          <View style={styles.iconWrapper}>
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={21}
              color={isActive ? colors.white : colors.navInactive}
            />
          </View>
          <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
            {item.label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const activeRoute: TabRoute =
    NAV_ITEMS.find((item) => pathname.includes(`/${item.matchKey}`))?.route ?? "home";

  // ── Unread message badge ─────────────────────────────────────────────────────
  // Fetch unread count on mount and refresh when a new_message socket event fires.
  const checkUnread = useCallback(async () => {
    try {
      const res = await fetchMyConversations();
      const totalUnread = res.data.conversations.reduce(
        (sum, c) => sum + (c.unreadByPartner ?? 0),
        0
      );
      setHasUnreadMessages(totalUnread > 0);
    } catch {
      // Silently ignore — badge is non-critical UI
    }
  }, []);

  useEffect(() => {
    checkUnread();
  }, [checkUnread]);

  // Re-check whenever we're NOT on the chat tab (so badge clears once they open chat)
  useEffect(() => {
    if (activeRoute === "chat") {
      // User is on chat tab — clear badge optimistically
      setHasUnreadMessages(false);
      return;
    }

    // Subscribe to socket new_message to update badge in real-time
    let mounted = true;
    connectChatSocket()
      .then((socket) => {
        if (!mounted) return;
        socket.on("new_message", () => {
          if (mounted && activeRoute !== "chat") {
            setHasUnreadMessages(true);
          }
        });
      })
      .catch(() => {/* ignore */});

    return () => {
      mounted = false;
      const socket = getChatSocket();
      if (socket) socket.off("new_message");
    };
  }, [activeRoute, checkUnread]);

  const handleNavigate = useCallback(
    (route: TabRoute) => {
      router.replace(`/(tabs)/${route}` as any);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.route}
          item={item}
          isActive={item.route === activeRoute}
          onPress={() => handleNavigate(item.route)}
          showBadge={item.route === "chat" && hasUnreadMessages}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: spacing.lg,
    width: "92%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pill: {
    height: 44,
    minWidth: PILL_MIN,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 5,
    overflow: "hidden",
  },
  pillBg: {
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  iconWrapper: {
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.jostSemiBold,
    color: colors.white,
    fontSize: 12,
    maxWidth: 64,
  },
  /** Red dot badge — appears above the chat icon pill when there are unread messages */
  badgeDot: {
    position: "absolute",
    top: 2,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
    zIndex: 10,
  },
});
