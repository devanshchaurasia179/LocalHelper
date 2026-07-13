import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ServiceCard } from './ServiceCard';
import { DashColors, DashSpacing, DashType } from '../theme';
import { ServiceProvider } from '../types';

interface ServiceGridProps {
  providers: ServiceProvider[];
  sectionTitle?: string;
  onAddPress?: (provider: ServiceProvider) => void;
  onFavouritePress?: (provider: ServiceProvider) => void;
  onCardPress?: (provider: ServiceProvider) => void;
}

export function ServiceGrid({
  providers,
  sectionTitle = 'Nearby Services',
  onAddPress,
  onFavouritePress,
  onCardPress,
}: ServiceGridProps) {
  if (providers.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No services found</Text>
      </View>
    );
  }

  // Build rows of 2
  const rows: ServiceProvider[][] = [];
  for (let i = 0; i < providers.length; i += 2) {
    rows.push(providers.slice(i, i + 2));
  }

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <Text style={styles.seeAll}>See all</Text>
      </View>

      {/* Grid rows */}
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((provider) => (
            <View key={provider.id} style={styles.cell}>
              <ServiceCard
                provider={provider}
                onAddPress={onAddPress}
                onFavouritePress={onFavouritePress}
                onPress={onCardPress}
              />
            </View>
          ))}
          {/* If last row has only one card, fill the second cell with an empty spacer */}
          {row.length === 1 && <View style={styles.cell} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: DashSpacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: DashType.md,
    fontWeight: '700',
    color: DashColors.textPrimary,
  },
  seeAll: {
    fontSize: DashType.sm,
    fontWeight: '600',
    color: DashColors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: DashSpacing.md,
  },
  cell: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: DashSpacing.xxl,
  },
  emptyText: {
    fontSize: DashType.base,
    color: DashColors.textMuted,
  },
});
