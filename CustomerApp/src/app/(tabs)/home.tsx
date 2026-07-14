import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme, Spacing } from "@/constants/theme";

// ─── Service category data ────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "1", label: "Cleaning",   emoji: "🧹" },
  { id: "2", label: "Plumbing",   emoji: "🔧" },
  { id: "3", label: "Electrical", emoji: "⚡" },
  { id: "4", label: "Painting",   emoji: "🖌️" },
  { id: "5", label: "Carpentry",  emoji: "🪚" },
  { id: "6", label: "Shifting",   emoji: "📦" },
  { id: "7", label: "Appliance",  emoji: "🏠" },
  { id: "8", label: "More",       emoji: "➕" },
];

const POPULAR = [
  { id: "1", title: "Deep Home Cleaning", rating: "4.8", reviews: "2.3k", price: "₹499" },
  { id: "2", title: "Pipe Leak Fix",       rating: "4.6", reviews: "1.1k", price: "₹299" },
  { id: "3", title: "Fan Installation",    rating: "4.7", reviews: "980",  price: "₹199" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryCard({ emoji, label, bg }: { emoji: string; label: string; bg: string }) {
  return (
    <TouchableOpacity activeOpacity={0.75} style={styles.categoryCard}>
      <View style={[styles.categoryIcon, { backgroundColor: bg }]}>
        <Text style={styles.categoryEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.categoryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const CARD_BG_COLORS = [
  "#FFF3E0", "#E3F2FD", "#E8F5E9", "#FCE4EC",
  "#EDE7F6", "#E0F7FA", "#F9FBE7", "#F3E5F5",
];

function PopularCard({
  title,
  rating,
  reviews,
  price,
}: {
  title: string;
  rating: string;
  reviews: string;
  price: string;
}) {
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.popularCard}>
      {/* Placeholder image area */}
      <View style={styles.popularImagePlaceholder}>
        <Text style={styles.popularImageEmoji}>🔨</Text>
      </View>

      <View style={styles.popularContent}>
        <Text style={styles.popularTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.popularMeta}>
          <Text style={styles.popularRating}>⭐ {rating}</Text>
          <Text style={styles.popularReviews}>({reviews})</Text>
        </View>
        <Text style={styles.popularPrice}>Starting {price}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { customer } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const firstName = customer?.name?.split(" ")[0] ?? "there";
  const primaryAddress = customer?.addresses?.[0];
  const locationLabel =
    primaryAddress
      ? [primaryAddress.locality, primaryAddress.city].filter(Boolean).join(", ")
      : "Set your location";

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.six + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity activeOpacity={0.7} style={styles.locationRow}>
              <Text style={styles.locationPin}>📍</Text>
              <Text
                style={[styles.locationText, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {locationLabel}
              </Text>
              <Text style={[styles.chevron, { color: theme.textSecondary }]}>▾</Text>
            </TouchableOpacity>
            <Text style={[styles.greeting, { color: theme.text }]}>
              Hi, {firstName} 👋
            </Text>
          </View>

          {/* Avatar */}
          <TouchableOpacity activeOpacity={0.8} style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(customer?.name?.[0] ?? "?").toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={[styles.searchWrapper, { backgroundColor: theme.backgroundElement }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search for services…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {/* ── Promo banner ── */}
        <View style={styles.promoBanner}>
          <View style={styles.promoTextBlock}>
            <Text style={styles.promoTag}>LIMITED OFFER</Text>
            <Text style={styles.promoHeading}>20% off your{"\n"}first booking</Text>
            <TouchableOpacity activeOpacity={0.8} style={styles.promoButton}>
              <Text style={styles.promoButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.promoEmoji}>🛠️</Text>
        </View>

        {/* ── Categories ── */}
        <SectionHeader title="Our Services" />
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              bg={CARD_BG_COLORS[idx % CARD_BG_COLORS.length]}
            />
          ))}
        </View>

        {/* ── Popular near you ── */}
        <SectionHeader title="Popular Near You" actionLabel="See all" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularList}
        >
          {POPULAR.map((item) => (
            <PopularCard key={item.id} {...item} />
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && (
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerLeft: { flex: 1 },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  locationPin: { fontSize: 14, marginRight: 4 },
  locationText: { fontSize: 13, maxWidth: 200 },
  chevron: { fontSize: 12, marginLeft: 4 },
  greeting: { fontSize: 22, fontWeight: "700", marginTop: 2 },

  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.three,
  },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "700" },

  /* Search */
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.three,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === "ios" ? Spacing.two + 2 : Spacing.two,
    marginBottom: Spacing.three,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.two },
  searchInput: { flex: 1, fontSize: 15 },

  /* Promo banner */
  promoBanner: {
    marginHorizontal: Spacing.three,
    borderRadius: 18,
    backgroundColor: "#6C63FF",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },
  promoTextBlock: { flex: 1 },
  promoTag: {
    color: "#D4CFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  promoHeading: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  promoButton: {
    marginTop: Spacing.two + 4,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  promoButtonText: { color: "#6C63FF", fontWeight: "700", fontSize: 13 },
  promoEmoji: { fontSize: 60 },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two + 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  sectionAction: { fontSize: 13, color: "#6C63FF", fontWeight: "600" },

  /* Categories grid */
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.four,
  },
  categoryCard: {
    width: "25%",
    alignItems: "center",
    paddingVertical: Spacing.two + 4,
  },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryEmoji: { fontSize: 28 },
  categoryLabel: { fontSize: 12, fontWeight: "500", color: "#333", textAlign: "center" },

  /* Popular */
  popularList: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  popularCard: {
    width: 170,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  popularImagePlaceholder: {
    height: 110,
    backgroundColor: "#F0F0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  popularImageEmoji: { fontSize: 48 },
  popularContent: { padding: Spacing.two + 4 },
  popularTitle: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 4 },
  popularMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  popularRating: { fontSize: 12, color: "#F59E0B", fontWeight: "600" },
  popularReviews: { fontSize: 12, color: "#888" },
  popularPrice: { fontSize: 13, fontWeight: "700", color: "#6C63FF" },
});
