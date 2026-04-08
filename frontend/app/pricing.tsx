import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import axios from 'axios';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tathya-api.onrender.com';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';

const FEATURES_FREE = [
  '3 YouTube Shorts / day',
  '3 Instagram Reels / day',
  '8 regional languages',
  'Full verdict + audio',
  'Check history',
];

const FEATURES_PRO = [
  'Unlimited YouTube Shorts',
  'Unlimited Instagram Reels',
  '8 regional languages',
  'Full verdict + audio',
  'Check history',
  'Priority support',
];

export default function PricingScreen() {
  const router = useRouter();
  const { colors, isDark } = useThemeStore();
  const { isAuthenticated, googleEmail, deviceId, fetchSubscription, subscriptionPlan } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [webIdToken, setWebIdToken] = useState<string | null>(null);

  // Configure Google Sign-In for web
  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID_WEB, offlineAccess: true });
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Get ID token — from app session or fresh web sign-in
      let idToken: string | null = null;

      if (isAuthenticated && deviceId) {
        // App context: use device_id header (device is already linked to google_id)
        const res = await axios.post(`${API_URL}/api/subscription/create`, {}, {
          headers: {
            'X-Device-Id': deviceId,
            ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
          },
        });
        const { short_url, already_subscribed } = res.data;
        if (already_subscribed) {
          await fetchSubscription();
          Alert.alert('Already Subscribed', 'You already have an active Pro subscription!');
          router.back();
          return;
        }
        if (short_url) {
          await Linking.openURL(short_url);
          setLoading(false);
          return;
        }
      } else {
        // Web context: need Google Sign-In first
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          idToken = response.data?.idToken ?? (response as any).idToken ?? null;
        } catch {
          Alert.alert('Sign-In Required', 'Please sign in with Google to subscribe.');
          setLoading(false);
          return;
        }

        if (!idToken) {
          Alert.alert('Sign-In Error', 'Could not get authentication token. Please try again.');
          setLoading(false);
          return;
        }

        const res = await axios.post(`${API_URL}/api/subscription/create`, { id_token: idToken }, {
          headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
        });
        const { short_url, already_subscribed } = res.data;
        if (already_subscribed) {
          Alert.alert('Already Subscribed', 'You already have an active Pro subscription!');
          setLoading(false);
          return;
        }
        if (short_url) {
          await Linking.openURL(short_url);
          setLoading(false);
          return;
        }
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail?.message || e.response?.data?.detail || 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    }
    setLoading(false);
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
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Upgrade to Pro</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.saffron + '22' }]}>
              <Ionicons name="flash" size={14} color={colors.saffron} />
              <Text style={[styles.badgeText, { color: colors.saffron }]}>Unlimited fact-checking</Text>
            </View>
          </View>

          {/* Pricing cards */}
          <View style={styles.cardsRow}>
            {/* Free card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.cardTier, { color: colors.textTertiary }]}>FREE</Text>
              <Text style={[styles.cardPrice, { color: colors.textPrimary }]}>₹0</Text>
              <Text style={[styles.cardPriceSub, { color: colors.textTertiary }]}>forever</Text>
              <View style={styles.divider} />
              {FEATURES_FREE.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Pro card */}
            <View style={[styles.card, styles.proCard, { backgroundColor: colors.deepIndigo as string, borderColor: colors.saffron }]}>
              <View style={styles.proLabelRow}>
                <Text style={styles.cardTierPro}>PRO</Text>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              </View>
              <Text style={styles.cardPricePro}>₹99</Text>
              <Text style={styles.cardPriceSubPro}>per month</Text>
              <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              {FEATURES_PRO.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.saffron} />
                  <Text style={[styles.featureText, { color: '#fff' }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          {subscriptionPlan === 'pro' ? (
            <View style={[styles.alreadyPro, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={[styles.alreadyProText, { color: colors.textPrimary }]}>You're already on Pro!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.saffron }]}
              onPress={handleSubscribe}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color="#fff" />
                  <Text style={styles.ctaBtnText}>Get Pro — ₹99/month</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.footNote, { color: colors.textTertiary }]}>
            Cancel anytime from Account settings. Billed monthly via Razorpay. Secure UPI / card payment.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  badgeRow: { alignItems: 'center', marginBottom: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16 },
  proCard: { borderWidth: 2 },
  cardTier: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  cardTierPro: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#fff', marginBottom: 0 },
  cardPrice: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  cardPricePro: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 2 },
  cardPriceSub: { fontSize: 12, marginBottom: 12 },
  cardPriceSubPro: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  featureText: { fontSize: 12, flex: 1 },
  proLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  popularBadge: { backgroundColor: 'rgba(255,165,0,0.25)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  popularText: { fontSize: 9, fontWeight: '700', color: '#FFB300' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 16 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  alreadyPro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  alreadyProText: { fontSize: 15, fontWeight: '600' },
  footNote: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
