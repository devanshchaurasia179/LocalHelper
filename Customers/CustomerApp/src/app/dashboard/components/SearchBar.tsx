import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashColors, DashSpacing, DashType, DashRadius } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search services...',
  onFilterPress,
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      {/* Search input */}
      <View style={styles.inputWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color={DashColors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={DashColors.textMuted}
          returnKeyType="search"
          accessibilityLabel="Search services"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            accessibilityLabel="Clear search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={DashColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={onFilterPress}
        activeOpacity={0.8}
        accessibilityLabel="Open filters"
        accessibilityRole="button"
      >
        <Ionicons name="options-outline" size={20} color={DashColors.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: DashSpacing.sm,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DashColors.surface,
    borderRadius: DashRadius.lg,
    paddingHorizontal: DashSpacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: DashColors.border,
    gap: DashSpacing.sm,
  },
  searchIcon: {
    // keeps icon vertically centred
  },
  input: {
    flex: 1,
    fontSize: DashType.base,
    color: DashColors.textPrimary,
    paddingVertical: 0, // Android quirk
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: DashRadius.lg,
    backgroundColor: DashColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
