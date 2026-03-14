import React, { useEffect, useRef, useState } from 'react';
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
  Modal,
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

const FEEDBACK_URL = 'https://forms.gle/1g3Zv273vzsxDRmy6';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useThemeStore();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const {
    url,
    setUrl,
    languageCode,
    setLanguageCode,
    isLoading,
    error,
    runCheck,
  } = useCheckStore();
  const { ytChecksRemaining, igChecksRemaining, isExempt, fetchUsage } = useAuthStore();

  // Determine platform from URL to check correct limit
  const isYouTubeUrl = /(youtube\.com|youtu\.be)/i.test(url);
  const checksRemaining = isYouTubeUrl ? ytChecksRemaining : igChecksRemaining;

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

              {/* Disclaimer & Feedback */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => setShowDisclaimer(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.actionButtonText, { color: colors.textTertiary }]}>Why limits?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => Linking.openURL(FEEDBACK_URL)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.actionButtonText, { color: colors.textTertiary }]}>Feedback</Text>
                </TouchableOpacity>
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

        {/* Disclaimer Modal */}
        <Modal
          visible={showDisclaimer}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDisclaimer(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDisclaimer(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="information-circle" size={24} color={colors.saffron} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>About Usage Limits</Text>
              </View>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                TathyaQuest uses multiple AI and third-party APIs to verify claims, and each check incurs real infrastructure costs on our end.
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                To keep the service free and accessible while we work toward a sustainable model, we've introduced daily usage limits — 10 YouTube / 3 Instagram checks without sign-in, and 15 YouTube / 5 Instagram with a Google account.
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                We're actively working on a freemium plan that will offer higher limits. Your continued usage helps us understand demand and shape the right pricing.
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                Thank you for supporting TathyaQuest while we grow.
              </Text>
              <View style={styles.modalDivider} />
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                TathyaQuest दावों की जाँच के लिए कई AI और थर्ड-पार्टी APIs का उपयोग करता है, और हर जाँच पर हमें वास्तविक इंफ्रास्ट्रक्चर लागत आती है।
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                सेवा को मुफ़्त और सबके लिए सुलभ बनाए रखने के लिए, जब तक हम एक टिकाऊ मॉडल पर काम कर रहे हैं, हमने दैनिक उपयोग सीमाएँ तय की हैं — बिना साइन-इन के 10 YouTube / 3 Instagram जाँच, और Google अकाउंट से साइन-इन करने पर 15 YouTube / 5 Instagram जाँच।
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                हम एक फ्रीमियम प्लान पर सक्रिय रूप से काम कर रहे हैं जिसमें अधिक सीमाएँ उपलब्ध होंगी। आपका निरंतर उपयोग हमें माँग को समझने और सही मूल्य निर्धारण तय करने में मदद करता है।
              </Text>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                TathyaQuest को बढ़ने में सहयोग देने के लिए आपका धन्यवाद!
              </Text>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: colors.deepIndigo as string }]}
                onPress={() => setShowDisclaimer(false)}
              >
                <Text style={styles.modalCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

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
    justifyContent: 'center',
    marginBottom: 36,
  },
  logoWrapper: {
    marginBottom: 0,
    alignItems: 'center',
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
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  usageBadgeWrapper: {
    marginTop: 8,
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
