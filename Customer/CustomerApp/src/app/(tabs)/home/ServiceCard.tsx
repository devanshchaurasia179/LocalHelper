import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider } from './types';
import { colors, spacing, radii, typography } from './theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CATEGORY_PLACEHOLDER = require('../../../../../assets/images/Carpenter.png') as number;

interface ServiceCardProps {
  provider: Provider;
  onPress?: () => void;
  onAddPress?: () => void;
}

export default function ServiceCard({ provider, onPress, onAddPress }: ServiceCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        <Image
          source={
            provider.image
              ? typeof provider.image === 'string'
                ? { uri: provider.image }
                : provider.image
              : CATEGORY_PLACEHOLDER
          }
          defaultSource={CATEGORY_PLACEHOLDER}
          style={styles.image}
        />

        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={11} color={colors.star} />
          <Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text>
        </View>

        <TouchableOpacity style={styles.bookmarkButton} activeOpacity={0.7}>
          <Ionicons name="bookmark-outline" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
      <Text style={typography.caption}>{provider.category}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>₹{provider.pricePerHour.toFixed(2)}/hr</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddPress}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.background,
  },
  imageWrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
    height: 110,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
  bookmarkButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
