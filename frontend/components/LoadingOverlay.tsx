import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LOADING_MESSAGES = [
  { text: 'सच ढूंढ रहे हैं...', english: 'Searching for truth...' },
  { text: 'वीडियो सुन रहे हैं...', english: 'Listening to video...' },
  { text: 'विशेषज्ञों से पूछ रहे हैं...', english: 'Consulting experts...' },
  { text: 'तथ्यों की जांच कर रहे हैं...', english: 'Checking the facts...' },
  { text: 'जवाब तैयार कर रहे हैं...', english: 'Preparing answer...' },
];

export const LoadingOverlay: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const spinValue = new Animated.Value(0);
  const pulseValue = new Animated.Value(1);

  useEffect(() => {
    // Rotate animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cycle through messages
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ rotate: spin }, { scale: pulseValue }],
          },
        ]}
      >
        <Ionicons name="search" size={64} color="#10B981" />
      </Animated.View>

      <Text style={styles.hindiText}>
        {LOADING_MESSAGES[messageIndex].text}
      </Text>
      <Text style={styles.englishText}>
        {LOADING_MESSAGES[messageIndex].english}
      </Text>

      <View style={styles.timeContainer}>
        <Ionicons name="time-outline" size={16} color="#6B7280" />
        <Text style={styles.timeText}>This usually takes 15-30 seconds</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  iconContainer: {
    marginBottom: 32,
  },
  hindiText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  englishText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
