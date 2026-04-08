import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const {
    googleEmail, googleName,
    subscriptionPlan, subscriptionStatus, subscriptionEndDate,
    ytChecksRemaining, ytDailyLimit, igChecksRemaining, igDailyLimit,
    cancelSubscription, fetchSubscription,
  } = useAuthStore();

  const [cancelling, setCancelling] = useState(false);

  const isPro = subscriptionPlan === 'pro';

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Your Pro access will continue until the end of the current billing period. Cancel anyway?',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const result = await cancelSubscription();
            setCancelling(false);
            if (result.success) {
              await fetchSubscription();
              Alert.alert('Cancelled', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Account & Plan</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.avatar, { backgroundColor: colors.deepIndigo as string }]}>
              <Ionicons name="person" size={26} color="#fff" />
            </View>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{googleName || 'User'}</Text>
            <Text style={[styles.email, { color: colors.textTertiary }]}>{googleEmail || ''}</Text>
          </View>

          {/* Plan card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: isPro ? colors.saffron : colors.cardBorder, borderWidth: isPro ? 2 : 1 }]}>
            <View style={styles.planRow}>
              <View style={styles.planLeft}>
                <Ionicons
                  name={isPro ? 'flash' : 'person-outline'}
                  size={22}
                  color={isPro ? colors.saffron : colors.textTertiary}
                />
                <View>
                  <Text style={[styles.planName, { color: colors.textPrimary }]}>
                    {isPro ? 'TathyaQuest Pro' : 'Free Plan'}
                  </Text>
                  <Text style={[styles.planSub, { color: colors.textTertiary }]}>
                    {isPro ? `Renews: ${formatDate(subscriptionEndDate)}` : '3 YT + 3 IG checks/day'}
                  </Text>
                </View>
              </View>
              <View style={[styles.planBadge, { backgroundColor: isPro ? colors.saffron + '22' : colors.cardBorder }]}>
                <Text style={[styles.planBadgeText, { color: isPro ? colors.saffron : colors.textTertiary }]}>
                  {isPro ? 'PRO' : 'FREE'}
                </Text>
              </View>
            </View>

            {isPro && (
              <>
                <View style={[styles.separator, { backgroundColor: colors.cardBorder }]} />
                <View style={styles.usageRow}>
                  <View style={styles.usageStat}>
                    <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                    <Text style={[styles.usageVal, { color: colors.textPrimary }]}>Unlimited</Text>
                  </View>
                  <View style={styles.usageStat}>
                    <Ionicons name="logo-instagram" size={18} color="#C13584" />
                    <Text style={[styles.usageVal, { color: colors.textPrimary }]}>Unlimited</Text>
                  </View>
                </View>
              </>
            )}

            {!isPro && (
              <>
                <View style={[styles.separator, { backgroundColor: colors.cardBorder }]} />
                <View style={styles.usageRow}>
                  <View style={styles.usageStat}>
                    <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                    <Text style={[styles.usageVal, { color: colors.textPrimary }]}>{ytChecksRemaining}/{ytDailyLimit} left</Text>
                  </View>
                  <View style={styles.usageStat}>
                    <Ionicons name="logo-instagram" size={18} color="#C13584" />
                    <Text style={[styles.usageVal, { color: colors.textPrimary }]}>{igChecksRemaining}/{igDailyLimit} left</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Actions */}
          {!isPro && (
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.saffron }]}
              onPress={() => router.push('/pricing')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro — ₹59/month</Text>
            </TouchableOpacity>
          )}

          {isPro && subscriptionStatus !== 'cancelled' && (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.false as string }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={colors.false as string} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={colors.false as string} />
                  <Text style={[styles.cancelBtnText, { color: colors.false as string }]}>Cancel Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isPro && subscriptionStatus === 'cancelled' && (
            <View style={[styles.cancelledNote, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.cancelledNoteText, { color: colors.textTertiary }]}>
                Subscription cancelled. Pro access until {formatDate(subscriptionEndDate)}.
              </Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16, alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 13 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  planName: { fontSize: 15, fontWeight: '700' },
  planSub: { fontSize: 12, marginTop: 2 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  planBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  separator: { height: 1, width: '100%', marginVertical: 14 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  usageStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usageVal: { fontSize: 14, fontWeight: '600' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginBottom: 12 },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  cancelledNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  cancelledNoteText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
