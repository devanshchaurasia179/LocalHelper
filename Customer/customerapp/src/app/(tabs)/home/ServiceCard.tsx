import { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Provider } from './types';
import { colors, spacing, radii, typography } from './theme';

// Category image map – add more entries as new images are added to assets/images
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CATEGORY_IMAGES: Record<string, number> = {
  carpenter: require('../../../../assets/images/Carpenter.png') as number,
  driver: require('../../../../assets/images/Driver.png') as number,
  plumber: require('../../../../assets/images/Plumber.png') as number,
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CATEGORY_PLACEHOLDER = require('../../../../assets/images/Fallback.png') as number;

function getCategoryImage(category: string): number {
  const key = category.trim().toLowerCase();
  return CATEGORY_IMAGES[key] ?? CATEGORY_PLACEHOLDER;
}

interface ServiceCardProps {
  provider: Provider;
  onPress?: () => void;
  onAddPress?: () => void;
}

export default function ServiceCard({ provider, onPress, onAddPress }: ServiceCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  // Press feedback: whole card scales down slightly on touch
  const cardScale = useRef(new Animated.Value(1)).current;
  // Bookmark pop animation
  const bookmarkScale = useRef(new Animated.Value(1)).current;

  const categoryFallback = getCategoryImage(provider.category);

  const imageSource =
    imgError || !provider.image
      ? categoryFallback
      : typeof provider.image === 'string'
      ? { uri: provider.image }
      : provider.image;

  // Optional fields — degrade gracefully if not present on Provider
  const verified = (provider as any).verified as boolean | undefined;
  const isAvailable = (provider as any).isAvailable as boolean | undefined;
  const reviewCount = (provider as any).reviewCount as number | undefined;

  const handlePressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.97,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const toggleBookmark = () => {
    setBookmarked((v) => !v);
    Animated.sequence([
      Animated.spring(bookmarkScale, {
        toValue: 1.35,
        speed: 50,
        bounciness: 14,
        useNativeDriver: true,
      }),
      Animated.spring(bookmarkScale, {
        toValue: 1,
        speed: 50,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }], width: '48%' }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        accessibilityRole="button"
        accessibilityLabel={`View ${provider.name}, ${provider.category}`}
      >
        {/* ── Image section ── */}
        <View style={styles.imageWrapper}>
          {imgLoading && !imgError && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          <Image
            source={imageSource}
            onError={() => {
              setImgError(true);
              setImgLoading(false);
            }}
            onLoadEnd={() => setImgLoading(false)}
            style={styles.image}
          />

          {/* Bottom gradient scrim for readability — two-stop for a softer falloff */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.48)']}
            locations={[0, 0.55, 1]}
            style={styles.scrim}
            pointerEvents="none"
          />

          {/* Rating pill – top left */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={colors.star} />
            <Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text>
            {reviewCount !== undefined && (
              <Text style={styles.reviewCountText}>({reviewCount})</Text>
            )}
          </View>

          {/* Verified badge – shown next to rating if provider is verified */}
          {verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={colors.white} />
            </View>
          )}

          {/* Bookmark – top right */}
          <Animated.View
            style={[styles.bookmarkButton, { transform: [{ scale: bookmarkScale }] }]}
          >
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={toggleBookmark}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
              accessibilityRole="button"
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={13}
                color={bookmarked ? colors.star : colors.white}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Distance chip – bottom left, inside image */}
          {provider.distanceKm !== undefined && (
            <View style={styles.distanceBadge}>
              <Ionicons name="location-sharp" size={9} color={colors.white} />
              <Text style={styles.distanceText}>{provider.distanceKm.toFixed(1)} km</Text>
            </View>
          )}

          {/* Availability chip – bottom right, inside image */}
          {isAvailable !== undefined && (
            <View
              style={[
                styles.availabilityBadge,
                { backgroundColor: isAvailable ? colors.success ?? '#2E7D32' : 'rgba(0,0,0,0.5)' },
              ]}
            >
              <View
                style={[
                  styles.availabilityDot,
                  { backgroundColor: isAvailable ? '#7CFF9E' : colors.textSecondary },
                ]}
              />
              <Text style={styles.availabilityText}>
                {isAvailable ? 'Available' : 'Busy'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Text section ── */}
        <View style={styles.body}>
          <Text style={styles.category} numberOfLines={1}>
            {provider.category}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {provider.name}
          </Text>

          <View style={styles.priceRow}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.priceLabel}>Starting from</Text>
              <Text style={styles.price} numberOfLines={1}>
                ₹{provider.pricePerHour.toFixed(0)}
                <Text style={styles.perHr}>/hr</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddPress}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={`Book ${provider.name}`}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },

  /* ── Image ── */
  imageWrapper: {
    height: 130,
    overflow: 'hidden',
    backgroundColor: colors.border ?? '#EEEEEE',
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },

  /* Rating pill */
  ratingBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
  reviewCountText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },

  /* Verified badge */
  verifiedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: 58,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Bookmark */
  bookmarkButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Distance */
  distanceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
  },

  /* Availability */
  availabilityBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  availabilityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  availabilityText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },

  /* ── Body ── */
  body: {
    padding: spacing.sm,
    paddingTop: 10,
    gap: 2,
  },
  category: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  perHr: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
});