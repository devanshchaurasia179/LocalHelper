import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashColors, DashSpacing, DashType, DashRadius } from '../theme';
import { ServiceProvider } from '../types';

interface ServiceCardProps {
  provider: ServiceProvider;
  onAddPress?: (provider: ServiceProvider) => void;
  onFavouritePress?: (provider: ServiceProvider) => void;
  onPress?: (provider: ServiceProvider) => void;
}

export function ServiceCard({
  provider,
  onAddPress,
  onFavouritePress,
  onPress,
}: ServiceCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress?.(provider)}
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, ${provider.category}, rated ${provider.rating} stars, ₹${provider.pricePerHour} per hour`}
    >
      {/* Provider image */}
      <View style={styles.imageWrap}>
        <Image source={{ uri: provider.imageUrl }} style={styles.image} />

        {/* Favourite button */}
        <TouchableOpacity
          style={styles.favButton}
          onPress={() => onFavouritePress?.(provider)}
          activeOpacity={0.8}
          accessibilityLabel={provider.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          accessibilityRole="button"
        >
          <Ionicons
            name={provider.isFavourite ? 'heart' : 'heart-outline'}
            size={14}
            color={provider.isFavourite ? '#EF4444' : DashColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Card body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
        <Text style={styles.category} numberOfLines={1}>{provider.category}</Text>

        {/* Rating row */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={DashColors.star} />
          <Text style={styles.ratingText}>
            {provider.rating.toFixed(1)}
          </Text>
          <Text style={styles.reviewCount}>
            ({provider.reviewCount})
          </Text>
        </View>

        {/* Price + add button */}
        <View style={styles.footer}>
          <Text style={styles.price}>₹{provider.pricePerHour}<Text style={styles.perHour}>/hr</Text></Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddPress?.(provider)}
            activeOpacity={0.8}
            accessibilityLabel={`Add ${provider.name}`}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={DashColors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DashColors.surface,
    borderRadius: DashRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DashColors.border,
    // Subtle shadow
    shadowColor: DashColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 110,
    backgroundColor: DashColors.surfaceAlt,
  },
  favButton: {
    position: 'absolute',
    top: DashSpacing.sm,
    right: DashSpacing.sm,
    width: 28,
    height: 28,
    borderRadius: DashRadius.full,
    backgroundColor: DashColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  body: {
    padding: DashSpacing.sm,
    gap: 3,
  },
  name: {
    fontSize: DashType.sm,
    fontWeight: '700',
    color: DashColors.textPrimary,
  },
  category: {
    fontSize: DashType.xs,
    color: DashColors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: DashType.xs,
    fontWeight: '700',
    color: DashColors.textPrimary,
  },
  reviewCount: {
    fontSize: DashType.xs,
    color: DashColors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: DashSpacing.xs,
  },
  price: {
    fontSize: DashType.base,
    fontWeight: '800',
    color: DashColors.primary,
  },
  perHour: {
    fontSize: DashType.xs,
    fontWeight: '400',
    color: DashColors.textSecondary,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: DashRadius.sm,
    backgroundColor: DashColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
