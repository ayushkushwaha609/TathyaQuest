import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { colors } from '../constants/theme';

// Component to handle share intent navigation
function ShareIntentHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { hasShareIntent } = useShareIntentContext();

  const processingRef = React.useRef(false);

  useEffect(() => {
    // When a new share intent comes in and we're on the result screen,
    // navigate back to home to handle the new share
    if (hasShareIntent && !processingRef.current) {
      const currentScreen = segments[0] || 'index';

      if (currentScreen === 'result') {
        processingRef.current = true;
        // Navigate to home — do NOT call reset() here because index.tsx is already
        // mounted and may have already started runCheck. Calling reset() would
        // increment latestRequestId and cause the in-flight request to be discarded.
        router.replace('/');
        // Allow processing again after a short delay
        setTimeout(() => {
          processingRef.current = false;
        }, 500);
      }
    }
  }, [hasShareIntent, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <ShareIntentHandler>
        <View style={styles.container}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="result" />
          </Stack>
        </View>
      </ShareIntentHandler>
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
