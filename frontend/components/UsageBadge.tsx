import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

export function UsageBadge() {
  const { checksRemaining, dailyLimit, checksUsed, isExempt } = useAuthStore();
  const { colors } = useThemeStore();

  const isLimitReached = !isExempt && checksRemaining <= 0;
  const isLow = !isExempt && checksRemaining === 1;

  const badgeColor = isLimitReached ? colors.false : isLow ? '#F59E0B' : '#4CAF50';

  let label: string;
  if (isExempt) {
    label = 'Unlimited checks';
  } else if (isLimitReached) {
    label = 'Daily limit reached';
  } else {
    label = `${checksRemaining}/${dailyLimit} checks left today`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.row}>
        <Ionicons
          name={isLimitReached ? 'alert-circle' : 'shield-checkmark'}
          size={16}
          color={badgeColor}
        />
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          {label}
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
    fontSize: 13,
    fontWeight: '500',
  },
});
