import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";

export default function WalletScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your earnings and payouts will appear here.</Text>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.oswaldBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.jostRegular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
