import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';

// Configure Google Sign-In once at module level
GoogleSignin.configure({
  webClientId: GOOGLE_CLIENT_ID_WEB, // Required for getting idToken
  offlineAccess: false,
});

export function GoogleSignInButton() {
  const { isAuthenticated, googleEmail, isAuthLoading, signInWithGoogle, signOut } = useAuthStore();
  const { colors } = useThemeStore();

  const handleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (idToken) {
        await signInWithGoogle(idToken);
      } else {
        Alert.alert('Sign-In Error', 'Could not get authentication token. Please try again.');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — do nothing
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Sign-in already in progress
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play services are not available on this device.');
      } else {
        console.error('Google Sign-In error:', error);
        Alert.alert('Sign-In Error', 'Something went wrong. Please try again.');
      }
    }
  };

  if (isAuthenticated) {
    return (
      <View style={[styles.signedInContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.userInfo}>
          <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
          <Text style={[styles.emailText, { color: colors.textPrimary }]} numberOfLines={1}>
            {googleEmail}
          </Text>
        </View>
        <TouchableOpacity onPress={signOut} disabled={isAuthLoading} style={styles.signOutBtn}>
          <Text style={[styles.signOutText, { color: colors.textTertiary }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={handleSignIn}
      disabled={isAuthLoading}
      activeOpacity={0.8}
    >
      {isAuthLoading ? (
        <ActivityIndicator size="small" color={colors.textPrimary} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
            Sign in for more checks
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signedInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  emailText: {
    fontSize: 13,
    flex: 1,
  },
  signOutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
