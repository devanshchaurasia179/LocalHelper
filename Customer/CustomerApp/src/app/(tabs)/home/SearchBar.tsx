import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from './theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChangeText,
  onFilterPress,
  placeholder = 'Search for your services',
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={onFilterPress}
        activeOpacity={0.7}
      >
        <Ionicons name="options-outline" size={20} color={colors.white} />
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
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    height: 50,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
