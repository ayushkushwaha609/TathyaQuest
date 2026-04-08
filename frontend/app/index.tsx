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
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
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
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useThemeStore();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const {
    url,
    setUrl,
    languageCode,
    setLanguageCode,
    isLoading,
    error,
    runCheck,
  } = useCheckStore();
  const { ytChecksRemaining, igChecksRemaining, isExempt, isAuthenticated, googleEmail, fetchUsage } = useAuthStore();

  const isYouTubeUrl = /(youtube\.com|youtu\.be)/i.test(url);
  const checksRemaining = isYouTubeUrl ? ytChecksRemaining : igChecksRemaining;

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const isProcessingShareRef = useRef(false);

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    const handleShareIntent = async () => {
      if (!hasShareIntent || isProcessingShareRef.current) return;
      const sharedText = shareIntent?.webUrl || shareIntent?.text || '';
      if (!sharedText) { resetShareIntent(); return; }
      const cleanUrl = extractUrl(sharedText);
      if (cleanUrl && /(instagram\.com|instagr\.am|youtube\.com|youtu\.be)/i.test(cleanUrl)) {
        // Login is required — do not process the share if not authenticated
        if (!isAuthenticated) { resetShareIntent(); return; }
        isProcessingShareRef.current = true;
        useCheckStore.setState({ result: null, error: null, isLoading: false });
        setUrl(cleanUrl);
        resetShareIntent();
        const success = await useCheckStore.getState().runCheck(cleanUrl);
        if (success) { router.push('/result'); }
        isProcessingShareRef.current = false;
      } else { resetShareIntent(); }
    };
    handleShareIntent();
  }, [hasShareIntent]);

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
      setDrawerVisible(false);
    });
  };

  const handleCheck = async () => {
    Keyboard.dismiss();
    const success = await runCheck();
    if (success) { router.push('/result'); }
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
            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={openDrawer}
              >
                <Ionicons name="menu" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={toggleTheme}
              >
                <Ionicons name={isDark ? 'sunny' : 'moon'} size={18} color={colors.saffron} />
              </TouchableOpacity>
            </View>

            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoWrapper}>
                <Image
                  source={isDark ? require('../assets/images/logodark.png') : require('../assets/images/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.taglineHindi, { color: colors.saffron }]}>तथ्य की जांच</Text>
              <Text style={[styles.tagline, { color: colors.textTertiary }]}>Share a reel. Hear the truth.</Text>
              <View style={styles.usageBadgeWrapper}>
                <UsageBadge />
              </View>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              {!isAuthenticated ? (
                /* Login wall — shown to all users who are not signed in */
                <View style={[styles.loginWall, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Ionicons name="lock-closed" size={32} color={colors.saffron} style={{ marginBottom: 12 }} />
                  <Text style={[styles.loginWallTitle, { color: colors.textPrimary }]}>Sign in to fact-check</Text>
                  <Text style={[styles.loginWallBody, { color: colors.textSecondary }]}>
                    A free account gives you 3 YouTube + 3 Instagram checks per day.
                  </Text>
                  <View style={{ marginTop: 20, width: '100%' }}>
                    <GoogleSignInButton />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Paste Video Link</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="link" size={20} color={colors.textTertiary} style={styles.inputIcon} />
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

                  <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 20 }]}>Select Language</Text>
                  <LanguagePicker selectedValue={languageCode} onValueChange={setLanguageCode} />

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
                      <Text style={[styles.checkButtonHindi, { color: colors.warmOrange }]}>जांचें</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.infoContainer}>
                    <Ionicons name="information-circle" size={16} color={colors.textTertiary} />
                    <Text style={[styles.infoText, { color: colors.textTertiary }]}>Works with public reels only</Text>
                  </View>
                </>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setShowDisclaimer(true)} activeOpacity={0.7}>
                <Text style={[styles.footerLink, { color: colors.textTertiary }]}>Why limits?</Text>
              </TouchableOpacity>
              <Text style={[styles.footerDot, { color: colors.textTertiary }]}>  ·  </Text>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                Works with Instagram & YouTube
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {isLoading && <LoadingOverlay />}

        {/* Side Drawer via Modal */}
        <Modal
          visible={drawerVisible}
          transparent
          animationType="none"
          onRequestClose={closeDrawer}
        >
          <View style={styles.drawerOverlay}>
            {/* Tap outside to close */}
            <TouchableWithoutFeedback onPress={closeDrawer}>
              <View style={styles.drawerBackdrop} />
            </TouchableWithoutFeedback>

            {/* Drawer panel */}
            <Animated.View
              style={[
                styles.drawer,
                {
                  backgroundColor: colors.gradientEnd,
                  borderRightColor: colors.cardBorder,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              <SafeAreaView style={styles.drawerInner}>
                {/* Drawer header */}
                <View style={styles.drawerHeader}>
                  <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>Menu</Text>
                  <TouchableOpacity onPress={closeDrawer}>
                    <Ionicons name="close" size={24} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                {/* Account section */}
                <View style={[styles.drawerSection, { borderBottomColor: colors.cardBorder }]}>
                  {isAuthenticated && (
                    <View style={styles.drawerAccountRow}>
                      <View style={[styles.drawerAvatar, { backgroundColor: colors.deepIndigo as string }]}>
                        <Ionicons name="person" size={18} color="#fff" />
                      </View>
                      <View style={styles.drawerAccountInfo}>
                        <Text style={[styles.drawerEmail, { color: colors.textPrimary }]} numberOfLines={1}>
                          {googleEmail}
                        </Text>
                        <Text style={[styles.drawerLabel, { color: colors.textTertiary }]}>Signed in</Text>
                      </View>
                    </View>
                  )}
                  <GoogleSignInButton />
                </View>

                {/* Menu items */}
                <View style={styles.drawerMenu}>
                  <TouchableOpacity
                    style={styles.drawerMenuItem}
                    onPress={() => { closeDrawer(); router.push('/history'); }}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.drawerMenuText, { color: colors.textPrimary }]}>My History</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.drawerMenuItem}
                    onPress={() => { closeDrawer(); Linking.openURL(FEEDBACK_URL); }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.drawerMenuText, { color: colors.textPrimary }]}>Feedback</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.drawerMenuItem}
                    onPress={() => { closeDrawer(); Linking.openURL('https://buymeachai.ezee.li/ayushkushwaha'); }}
                  >
                    <Ionicons name="heart-outline" size={20} color="#e74c8b" />
                    <Text style={[styles.drawerMenuText, { color: colors.textPrimary }]}>Support Us</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.drawerMenuItem}
                    onPress={() => { closeDrawer(); Linking.openURL('https://ayushkushwaha609.github.io/TathyaQuest/privacy.html'); }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.drawerMenuText, { color: colors.textPrimary }]}>Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>

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
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  TathyaQuest uses multiple AI and third-party APIs to verify claims, and each check incurs real infrastructure costs on our end.
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  A free Google account gives you 3 YouTube Shorts + 3 Instagram Reels per day. Signing in is required to use the service — this helps us prevent abuse and keep the app fast for everyone.
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  We're working on a paid plan for unlimited checks. Your support helps us cover infrastructure costs and keep growing.
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  Thank you for using TathyaQuest!
                </Text>
                <View style={styles.modalDivider} />
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  TathyaQuest दावों की जाँच के लिए कई AI और थर्ड-पार्टी APIs का उपयोग करता है, और हर जाँच पर हमें वास्तविक इंफ्रास्ट्रक्चर लागत आती है।
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  एक मुफ़्त Google अकाउंट से आपको प्रतिदिन 3 YouTube Shorts + 3 Instagram Reels जाँचने की सुविधा मिलती है। सेवा का उपयोग करने के लिए साइन-इन अनिवार्य है — इससे हम दुरुपयोग रोकते हैं और सभी के लिए ऐप को तेज़ बनाए रखते हैं।
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  हम असीमित जाँच के लिए एक पेड प्लान पर काम कर रहे हैं। आपका समर्थन हमें इंफ्रास्ट्रक्चर लागत कवर करने और आगे बढ़ने में मदद करता है।
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  TathyaQuest का उपयोग करने के लिए आपका धन्यवाद!
                </Text>
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: colors.deepIndigo as string }]}
                onPress={() => setShowDisclaimer(false)}
              >
                <Text style={styles.modalCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  blob1: { position: 'absolute', width: 209, height: 209, borderRadius: 105, top: -40, right: -60 },
  blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: 160, left: -50 },
  blob3: { position: 'absolute', width: 140, height: 140, borderRadius: 70, bottom: 120, right: -30 },
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  header: { alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoWrapper: { marginBottom: 0, alignItems: 'center' },
  logo: { width: 312, height: 125 },
  taglineHindi: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  tagline: { fontSize: 14, marginTop: 2, textAlign: 'center' },
  usageBadgeWrapper: { marginTop: 10 },
  inputSection: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1 },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, paddingVertical: 14 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  errorText: { fontSize: 14 },
  checkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28, gap: 8 },
  checkButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  checkButtonHindi: { fontSize: 16, fontWeight: '500' },
  infoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6 },
  infoText: { fontSize: 14 },
  loginWall: { alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 28, marginTop: 8 },
  loginWallTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  loginWallBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto', paddingTop: 16, paddingBottom: 8 },
  footerLink: { fontSize: 12, textDecorationLine: 'underline' },
  footerDot: { fontSize: 12 },
  footerText: { fontSize: 12 },
  // Drawer
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, borderRightWidth: 1, elevation: 8, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
  drawerInner: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  drawerTitle: { fontSize: 20, fontWeight: '700' },
  drawerSection: { paddingBottom: 20, marginBottom: 20, borderBottomWidth: 1 },
  drawerAccountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  drawerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  drawerAccountInfo: { flex: 1 },
  drawerEmail: { fontSize: 14, fontWeight: '600' },
  drawerLabel: { fontSize: 12, marginTop: 2 },
  drawerMenu: { gap: 4 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  drawerMenuText: { fontSize: 15, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { borderRadius: 16, borderWidth: 1, padding: 24, width: '100%', maxWidth: 400, maxHeight: '70%' },
  modalScroll: { marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  modalClose: { alignItems: 'center', paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  modalCloseText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
