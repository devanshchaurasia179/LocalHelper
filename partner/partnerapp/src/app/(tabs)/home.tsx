import { View, Text, StyleSheet } from "react-native";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";
import { colors, fonts, spacing } from "@/constants/theme";

/** Partner home — greeting and main app content added in Step 7 */
export default function HomeScreen() {
  const { data } = usePartnerStatus();

  const greeting = getGreeting();
  const name = data?.name ?? "Partner";

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting},</Text>
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  greeting: {
    fontFamily: fonts.jostRegular,
    fontSize: 16,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: fonts.oswaldBold,
    fontSize: 28,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
});
