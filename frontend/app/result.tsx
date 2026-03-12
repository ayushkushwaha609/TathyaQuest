import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useCheckStore } from '../store/useCheckStore';
import { useThemeStore } from '../store/useThemeStore';
import { VerdictCard } from '../components/VerdictCard';

export default function ResultScreen() {
  const router = useRouter();
  const { colors, isDark } = useThemeStore();
  const { result, reset } = useCheckStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    const { result: currentResult, isLoading: currentLoading } = useCheckStore.getState();
    if (!currentResult && !currentLoading) {
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result?.audio_base64) return;
    if (hasAutoPlayedRef.current) return;

    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const sound = new Audio.Sound();
        await sound.loadAsync({
          uri: `data:audio/wav;base64,${result.audio_base64}`,
        });
        soundRef.current = sound;
        setAudioLoaded(true);
        hasAutoPlayedRef.current = true;

        await sound.playAsync();
        setIsPlaying(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      } catch (error) {
        console.error('Audio setup error:', error);
      }
    };

    setupAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const togglePlayback = async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.positionMillis === status.durationMillis) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const handleCheckAnother = () => {
    reset();
    router.replace('/');
  };

  if (!result) {
    return null;
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: isDark ? 'rgba(196,181,253,0.08)' : 'rgba(45,27,105,0.06)' }]} />
      <View style={[styles.blob2, { backgroundColor: isDark ? 'rgba(244,162,97,0.06)' : 'rgba(232,124,62,0.08)' }]} />

      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCheckAnother}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Result</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <VerdictCard result={result} />

          {/* Audio Player */}
          {result.audio_base64 && (
            <View style={[styles.audioSection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.audioTitle, { color: colors.saffron }]}>
                Audio Summary
              </Text>
              <Text style={[styles.audioSubtitle, { color: colors.textSecondary }]}>
                ऑडियो सारांश
              </Text>
              <TouchableOpacity
                onPress={togglePlayback}
                disabled={!audioLoaded}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.playButton,
                    {
                      backgroundColor: !audioLoaded
                        ? colors.sandstone
                        : colors.deepIndigo as string,
                    },
                  ]}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#ffffff"
                  />
                </View>
              </TouchableOpacity>
              <Text style={[styles.audioLabel, { color: colors.textSecondary }]}>
                {isPlaying ? 'Playing verdict...' : 'Tap to play verdict'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action */}
        <View style={[styles.bottomAction, { borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={handleCheckAnother} activeOpacity={0.8}>
            <View style={[styles.checkAnotherButton, { backgroundColor: colors.deepIndigo as string }]}>
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.checkAnotherText}>Check Another Video</Text>
            </View>
          </TouchableOpacity>
        </View>
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
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -30,
    right: -50,
  },
  blob2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: 100,
    left: -40,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  audioSection: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  audioTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  audioSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  audioLabel: {
    fontSize: 14,
  },
  bottomAction: {
    padding: 20,
    borderTopWidth: 1,
  },
  checkAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  checkAnotherText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
