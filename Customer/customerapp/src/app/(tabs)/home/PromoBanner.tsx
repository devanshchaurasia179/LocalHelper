import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PromoOffer } from './types';
import { colors, spacing, radii } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoSlide extends PromoOffer {
  /** Gradient pair for the card, defaults to theme primary colours */
  gradientColors?: [string, string];
  /** Optional accent colour for the badge bg */
  accentColor?: string;
  /** Label shown in the badge pill */
  badgeLabel?: string;
}

interface PromoBannerProps {
  slides: PromoSlide[];
  autoPlayInterval?: number; // ms, default 4000
  onBookPress?: (slide: PromoSlide, index: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_H = 195;
// Card occupies full content width (margins applied by parent wrapper)
const CARD_W = SCREEN_W - spacing.md * 2;

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <Animated.View
            key={i}
            style={[
              dotStyles.dot,
              active ? dotStyles.dotActive : dotStyles.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 99,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.navInactive,
    opacity: 0.5,
  },
});

// ─── Single slide card ────────────────────────────────────────────────────────

function SlideCard({
  slide,
  onBookPress,
}: {
  slide: PromoSlide;
  onBookPress?: () => void;
}) {
  const grad: [string, string] = slide.gradientColors ?? [
    colors.primary,
    colors.primaryDark,
  ];
  const badge = slide.badgeLabel ?? 'LIMITED OFFER';
  const accent = slide.accentColor ?? 'rgba(255,255,255,0.22)';

  return (
    <LinearGradient
      colors={grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardStyles.container}
    >
      {/* ── Decorative circles ── */}
      <View style={[cardStyles.circle, cardStyles.circleLg]} pointerEvents="none" />
      <View style={[cardStyles.circle, cardStyles.circleSm]} pointerEvents="none" />
      <View style={[cardStyles.circle, cardStyles.circleXs]} pointerEvents="none" />

      {/* ── Left text block ── */}
      <View style={cardStyles.textBlock}>
        {/* Badge */}
        <View style={[cardStyles.badge, { backgroundColor: accent }]}>
          <Text style={cardStyles.badgeText}>{badge}</Text>
        </View>

        {/* Discount headline */}
        <Text style={cardStyles.discount} numberOfLines={1}>
          Save {slide.discountPercent}%
        </Text>

        {/* Tagline */}
        <Text style={cardStyles.description} numberOfLines={2}>
          {slide.description}
        </Text>

        {/* Chip row */}
        <View style={cardStyles.chip}>
          <View style={cardStyles.chipTextWrap}>
            <Text style={cardStyles.chipService} numberOfLines={1}>
              {slide.serviceName}
            </Text>
            <Text style={cardStyles.chipPrice}>${slide.servicePrice}/hr</Text>
          </View>

          <Pressable
            onPress={onBookPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Book ${slide.serviceName} now`}
            style={({ pressed }) => [
              cardStyles.bookBtn,
              pressed && cardStyles.bookBtnPressed,
            ]}
          >
            <Text style={cardStyles.bookBtnText}>Book Now</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Illustration ── */}
      
    </LinearGradient>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radii.lg,
    overflow: 'hidden',
    paddingLeft: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  /* decorative circles */
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circleLg: { width: 220, height: 220, right: -55, top: -60 },
  circleSm: { width: 120, height: 120, right: 60, bottom: -50 },
  circleXs: { width: 70, height: 70, right: 140, top: -20 },

  textBlock: { maxWidth: '90%', flex: 1, justifyContent: 'space-between' },

  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.white,
    textTransform: 'uppercase',
  },

  discount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 17,
    marginTop: 2,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipTextWrap: { flexShrink: 1 },
  chipService: { fontSize: 11, fontWeight: '600', color: colors.white },
  chipPrice: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  bookBtn: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtnPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  bookBtnText: { fontSize: 11, fontWeight: '800', color: colors.primary },


});

// ─── Carousel ─────────────────────────────────────────────────────────────────

export default function PromoBanner({
  slides,
  autoPlayInterval = 4000,
  onBookPress,
}: PromoBannerProps) {
  const listRef = useRef<FlatList<PromoSlide>>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollTo = useCallback(
    (idx: number) => {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
      setActiveIdx(idx);
    },
    [],
  );

  // Auto-play
  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, autoPlayInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, autoPlayInterval]);

  const handleMomentumEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    setActiveIdx(idx);
    // reset timer on manual swipe
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, autoPlayInterval);
  }, [slides.length, autoPlayInterval]);

  if (!slides.length) return null;

  return (
    <View>
      {/* Shadow wrapper */}
      <View style={wrapStyles.shadow}>
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W}
          decelerationRate="fast"
          bounces={false}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, index) => ({
            length: CARD_W,
            offset: CARD_W * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <SlideCard
              slide={item}
              onBookPress={() => onBookPress?.(item, index)}
            />
          )}
        />
      </View>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <Dots count={slides.length} activeIndex={activeIdx} />
      )}
    </View>
  );
}

const wrapStyles = StyleSheet.create({
  shadow: {
    borderRadius: radii.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
});
