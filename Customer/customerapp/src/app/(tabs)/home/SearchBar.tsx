import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from './theme';

interface SearchBarProps {
  onPress?: () => void;
  onFilterPress?: () => void;
  placeholder?: string;
  hasActiveFilters?: boolean;
}

export default function SearchBar({
  onPress,
  onFilterPress,
  placeholder = 'Search for your services',
  hasActiveFilters = false,
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.searchContainer}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <Text style={styles.placeholder} numberOfLines={1}>{placeholder}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={onFilterPress}
        activeOpacity={0.7}
      >
        <Ionicons name="options-outline" size={20} color={colors.white} />
        {hasActiveFilters && <View style={styles.filterBadge} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    height: 50,
    gap: spacing.sm,
  },
  placeholder: {
    flex: 1,
    ...typography.searchInput,
    color: colors.textSecondary,
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.chipBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5252',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
