import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShareIntentContext } from 'expo-share-intent';
import { useCheckStore } from '../store/useCheckStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { LanguagePicker } from '../components/LanguagePicker';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { UsageBadge } from '../components/UsageBadge';

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : text.trim();
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useThemeStore();
  const {
    url,
    setUrl,
    languageCode,
    setLanguageCode,
    isLoading,
    error,
    runCheck,
  } = useCheckStore();
  const { checksRemaining, isExempt, fetchUsage } = useAuthStore();

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const isProcessingShareRef = useRef(false);

  // Refresh usage on mount
  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    const handleShareIntent = async () => {
      if (!hasShareIntent || isProcessingShareRef.current) return;

      const sharedText = shareIntent?.webUrl || shareIntent?.text || '';
      if (!sharedText) {
        resetShareIntent();
        return;
      }

      const cleanUrl = extractUrl(sharedText);

      if (cleanUrl && /(instagram\.com|instagr\.am|youtube\.com|youtu\.be)/i.test(cleanUrl)) {
        isProcessingShareRef.current = true;
        useCheckStore.setState({ result: null, error: null, isLoading: false });
        setUrl(cleanUrl);
        resetShareIntent();

        const success = await useCheckStore.getState().runCheck(cleanUrl);
        if (success) {
          router.push('/result');
        }
        isProcessingShareRef.current = false;
      } else {
        resetShareIntent();
      }
    };

    handleShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);

  const handleCheck = async () => {
    Keyboard.dismiss();
    const success = await runCheck();
    if (success) {
      router.push('/result');
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: isDark ? 'rgba(196,181,253,0.08)' : 'rgba(45,27,105,0.06)' }]} />
      <View style={[styles.blob2, { backgroundColor: isDark ? 'rgba(244,162,97,0.06)' : 'rgba(232,124,62,0.08)' }]} />
      <View style={[styles.blob3, { backgroundColor: isDark ? 'rgba(196,181,253,0.05)' : 'rgba(45,27,105,0.04)' }]} />

      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Theme Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={toggleTheme}
              >
                <Ionicons
                  name={isDark ? 'sunny' : 'moon'}
                  size={18}
                  color={colors.saffron}
                />
              </TouchableOpacity>
            </View>

            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoWrapper}>
                <Image
                  source={isDark
                    ? require('../assets/images/logodark.png')
                    : require('../assets/images/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.taglineHindi, { color: colors.saffron }]}>
                तथ्य की जांच
              </Text>
              <Text style={[styles.tagline, { color: colors.textTertiary }]}>
                Share a reel. Hear the truth.
              </Text>
              <View style={styles.usageBadgeWrapper}>
                <UsageBadge />
              </View>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                Paste Video Link
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                <Ionicons
                  name="link"
                  size={20}
                  color={colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary }]}
                  placeholder="Instagram or YouTube link"
                  placeholderTextColor={colors.textTertiary}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {url.length > 0 && (
                  <TouchableOpacity onPress={() => setUrl('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.false} />
                  <Text style={[styles.errorText, { color: colors.false }]}>{error}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                Select Language
              </Text>
              <LanguagePicker
                selectedValue={languageCode}
                onValueChange={setLanguageCode}
              />

              {/* Check Button */}
              <TouchableOpacity
                onPress={handleCheck}
                disabled={!url || isLoading || (!isExempt && checksRemaining <= 0)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkButton,
                    {
                      backgroundColor: (!url || isLoading || (!isExempt && checksRemaining <= 0))
                        ? colors.sandstone
                        : colors.deepIndigo as string,
                    },
                  ]}
                >
                  <Text style={styles.checkButtonText}>Check</Text>
                  <Text style={[styles.checkButtonHindi, { color: colors.warmOrange }]}>
                    जांचें
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </TouchableOpacity>

              <View style={styles.infoContainer}>
                <Ionicons name="information-circle" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                  Works with public reels only
                </Text>
              </View>

              {/* Google Sign-In */}
              <View style={styles.authSection}>
                <GoogleSignInButton />
              </View>
            </View>

            {/* Supported Platforms */}
            <View style={styles.platformsContainer}>
              <Text style={[styles.platformsLabel, { color: colors.textTertiary }]}>
                Supported Platforms
              </Text>
              <View style={styles.platformsRow}>
                <View style={[styles.platformBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                  <Text style={[styles.platformText, { color: colors.textPrimary }]}>Instagram</Text>
                </View>
                <View style={[styles.platformBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                  <Text style={[styles.platformText, { color: colors.textPrimary }]}>YouTube</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {isLoading && <LoadingOverlay />}

        {/* Donation Button */}
        <TouchableOpacity
          style={[styles.donateButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => Linking.openURL('https://buymeachai.ezee.li/ayushkushwaha')}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={16} color="#e74c8b" />
          <Text style={[styles.donateText, { color: colors.textPrimary }]}>Support</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  blob1: {
    position: 'absolute',
    width: 209,
    height: 209,
    borderRadius: 105,
    top: -40,
    right: -60,
  },
  blob2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 160,
    left: -50,
  },
  blob3: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: 120,
    right: -30,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  toggleRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoWrapper: {
    marginBottom: 8,
  },
  logoWrapperDark: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  logo: {
    width: 312,
    height: 125,
  },
  taglineHindi: {
    fontSize: 16,
    fontWeight: '500',
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
  },
  usageBadgeWrapper: {
    marginTop: 12,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  checkButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  checkButtonHindi: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
  },
  authSection: {
    marginTop: 20,
  },
  platformsContainer: {
    alignItems: 'center',
  },
  platformsLabel: {
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  platformsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
  },
  platformText: {
    fontSize: 14,
  },
  donateButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  donateText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
