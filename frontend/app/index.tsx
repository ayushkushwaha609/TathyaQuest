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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShareIntentContext } from 'expo-share-intent';
import { useCheckStore } from '../store/useCheckStore';
import { LanguagePicker } from '../components/LanguagePicker';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { colors } from '../constants/theme';

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : text.trim();
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    url,
    setUrl,
    languageCode,
    setLanguageCode,
    isLoading,
    error,
    runCheck,
  } = useCheckStore();

  // Use expo-share-intent context for receiving shared content
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const isProcessingShareRef = useRef(false);

  // Handle incoming share intent - auto-populate and auto-search
  useEffect(() => {
    const handleShareIntent = async () => {
      // Prevent duplicate processing
      if (!hasShareIntent || isProcessingShareRef.current) return;

      // Get shared URL - prefer webUrl (direct URL) over text (may contain non-URL content)
      const sharedText = shareIntent?.webUrl || shareIntent?.text || '';
      if (!sharedText) {
        resetShareIntent();
        return;
      }

      // Extract URL from shared text
      const cleanUrl = extractUrl(sharedText);

      // Validate it's from Instagram or YouTube
      if (cleanUrl && /(instagram\.com|instagr\.am|youtube\.com|youtu\.be)/i.test(cleanUrl)) {
        isProcessingShareRef.current = true;

        // Clear any stale result/error/loading from a previous check before starting new one
        useCheckStore.setState({ result: null, error: null, isLoading: false });

        // Set the URL in store (auto-populate the input field)
        setUrl(cleanUrl);

        // Clear share intent to prevent re-processing
        resetShareIntent();

        // Pass URL directly to avoid race condition with store state
        const success = await useCheckStore.getState().runCheck(cleanUrl);
        if (success) {
          router.push('/result');
        }
        isProcessingShareRef.current = false;
      } else {
        // Clear invalid share intent
        resetShareIntent();
      }
    };

    handleShareIntent();
    // Only depend on hasShareIntent (boolean). shareIntent is an object whose
    // reference changes on every render, which was causing 5+ duplicate requests.
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="scan" size={36} color={colors.saffron} />
            </View>
            <Text style={styles.appName}>TathyaCheck</Text>
            <Text style={styles.taglineHindi}>तथ्य की जांच</Text>
            <Text style={styles.tagline}>Share a reel. Hear the truth.</Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Paste Video Link</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="link"
                size={20}
                color={colors.ashGray}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Instagram or YouTube link"
                placeholderTextColor={colors.lightGray}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {url.length > 0 && (
                <TouchableOpacity onPress={() => setUrl('')}>
                  <Ionicons name="close-circle" size={20} color={colors.lightGray} />
                </TouchableOpacity>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.false} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Language Picker */}
            <Text style={styles.inputLabel}>Select Language</Text>
            <LanguagePicker
              selectedValue={languageCode}
              onValueChange={setLanguageCode}
            />

            {/* Check Button */}
            <TouchableOpacity
              style={[
                styles.checkButton,
                (!url || isLoading) && styles.checkButtonDisabled,
              ]}
              onPress={handleCheck}
              disabled={!url || isLoading}
            >
              <Text style={styles.checkButtonText}>Check</Text>
              <Text style={styles.checkButtonHindi}>जांचें</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </TouchableOpacity>

            {/* Info Text */}
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle" size={16} color={colors.lightGray} />
              <Text style={styles.infoText}>Works with public reels only</Text>
            </View>
          </View>

          {/* Supported Platforms */}
          <View style={styles.platformsContainer}>
            <Text style={styles.platformsLabel}>Supported Platforms</Text>
            <View style={styles.platformsRow}>
              <View style={styles.platformBadge}>
                <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                <Text style={styles.platformText}>Instagram</Text>
              </View>
              <View style={styles.platformBadge}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <Text style={styles.platformText}>YouTube</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.deepIndigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.deepIndigo,
  },
  taglineHindi: {
    fontSize: 18,
    color: colors.saffron,
    marginTop: 4,
    fontWeight: '500',
  },
  tagline: {
    fontSize: 14,
    color: colors.ashGray,
    marginTop: 8,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.sandstone,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: colors.charcoal,
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
    color: colors.false,
    fontSize: 14,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.deepIndigo,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  checkButtonDisabled: {
    backgroundColor: colors.sandstone,
  },
  checkButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  checkButtonHindi: {
    color: colors.warmOrange,
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
    color: colors.lightGray,
    fontSize: 14,
  },
  platformsContainer: {
    alignItems: 'center',
  },
  platformsLabel: {
    color: colors.lightGray,
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
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.sandstone,
  },
  platformText: {
    color: colors.charcoal,
    fontSize: 14,
  },
});
