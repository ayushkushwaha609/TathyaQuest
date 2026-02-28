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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCheckStore } from '../store/useCheckStore';
import { LanguagePicker } from '../components/LanguagePicker';
import { LoadingOverlay } from '../components/LoadingOverlay';

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
  
  // Animation for when URL is received via share
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const prevUrl = useRef(url);
  
  // Animate when URL changes (e.g., received via share)
  useEffect(() => {
    if (url && url !== prevUrl.current && prevUrl.current === '') {
      // URL was just set (likely from share)
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    prevUrl.current = url;
  }, [url, shakeAnim]);

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
              <Ionicons name="shield-checkmark" size={48} color="#10B981" />
            </View>
            <Text style={styles.appName}>SachCheck</Text>
            <Text style={styles.taglineHindi}>सच चेक</Text>
            <Text style={styles.tagline}>Share a reel. Hear the truth.</Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Paste Video Link</Text>
            <Animated.View 
              style={[
                styles.inputContainer,
                { transform: [{ translateX: shakeAnim }] },
                url && prevUrl.current === '' && styles.inputContainerHighlight
              ]}
            >
              <Ionicons
                name="link"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Instagram or YouTube link"
                placeholderTextColor="#6B7280"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {url.length > 0 && (
                <TouchableOpacity onPress={() => setUrl('')}>
                  <Ionicons name="close-circle" size={20} color="#6B7280" />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
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
              <Text style={styles.checkButtonText}>Check करो</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Info Text */}
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle" size={16} color="#6B7280" />
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
    backgroundColor: '#0F172A',
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
    borderRadius: 40,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  taglineHindi: {
    fontSize: 20,
    color: '#10B981',
    marginTop: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  inputContainerHighlight: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
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
    color: '#EF4444',
    fontSize: 14,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  checkButtonDisabled: {
    backgroundColor: '#374151',
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  infoText: {
    color: '#6B7280',
    fontSize: 14,
  },
  platformsContainer: {
    alignItems: 'center',
  },
  platformsLabel: {
    color: '#6B7280',
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
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  platformText: {
    color: '#D1D5DB',
    fontSize: 14,
  },
});
