import React from 'react';
import { View, StyleSheet } from 'react-native';
import ServiceCard from './ServiceCard';
import { Provider } from './types';
import { spacing } from './theme';

interface ServiceGridProps {
  providers: Provider[];
  onCardPress?: (provider: Provider) => void;
  onAddPress?: (provider: Provider) => void;
}

export default function ServiceGrid({ providers, onCardPress, onAddPress }: ServiceGridProps) {
  return (
    <View style={styles.grid}>
      {providers.map((provider) => (
        <ServiceCard
          key={provider.id}
          provider={provider}
          onPress={() => onCardPress?.(provider)}
          onAddPress={() => onAddPress?.(provider)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    rowGap: spacing.lg,
  },
});
