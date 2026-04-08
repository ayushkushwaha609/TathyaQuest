import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

function getBadgeColor(remaining: number, isExempt: boolean, falseColor: string) {
  if (!isExempt && remaining <= 0) return falseColor;
  if (!isExempt && remaining === 1) return '#F59E0B';
  return '#4CAF50';
}

export function UsageBadge() {
  const { ytChecksRemaining, ytDailyLimit, igChecksRemaining, igDailyLimit, isExempt, isAuthenticated } = useAuthStore();
  const { colors } = useThemeStore();

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.row}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.text, { color: colors.textTertiary }]}>Sign in to start checking</Text>
        </View>
      </View>
    );
  }

  if (isExempt) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={[styles.text, { color: colors.textPrimary }]}>Unlimited checks</Text>
        </View>
      </View>
    );
  }

  const ytColor = getBadgeColor(ytChecksRemaining, isExempt, colors.false as string);
  const igColor = getBadgeColor(igChecksRemaining, isExempt, colors.false as string);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.row}>
        <Ionicons name="logo-youtube" size={14} color={ytColor} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          {ytChecksRemaining <= 0 ? 'YT limit reached' : `YT: ${ytChecksRemaining}/${ytDailyLimit}`}
        </Text>
        <Text style={[styles.separator, { color: colors.textTertiary }]}>|</Text>
        <Ionicons name="logo-instagram" size={14} color={igColor} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          {igChecksRemaining <= 0 ? 'IG limit reached' : `IG: ${igChecksRemaining}/${igDailyLimit}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    fontSize: 12,
    marginHorizontal: 2,
  },
});
