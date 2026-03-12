import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useCheckStore } from '../store/useCheckStore';
import { VerdictCard } from '../components/VerdictCard';
import { colors } from '../constants/theme';

export default function ResultScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCheckAnother}
        >
          <Ionicons name="arrow-back" size={24} color={colors.deepIndigo} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Result</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Verdict Card */}
        <VerdictCard result={result} />

        {/* Audio Player */}
        {result.audio_base64 && (
          <View style={styles.audioSection}>
            <Text style={styles.audioTitle}>Audio Summary</Text>
            <Text style={styles.audioSubtitle}>ऑडियो सारांश</Text>
            <TouchableOpacity
              style={[
                styles.playButton,
                !audioLoaded && styles.playButtonDisabled,
              ]}
              onPress={togglePlayback}
              disabled={!audioLoaded}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color={colors.white}
              />
            </TouchableOpacity>
            <Text style={styles.audioLabel}>
              {isPlaying ? 'Playing verdict...' : 'Tap to play verdict'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.checkAnotherButton}
          onPress={handleCheckAnother}
        >
          <Ionicons name="refresh" size={20} color={colors.white} />
          <Text style={styles.checkAnotherText}>Check Another Video</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.sandstone,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.deepIndigo,
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
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.sandstone,
  },
  audioTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.saffron,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  audioSubtitle: {
    fontSize: 14,
    color: colors.ashGray,
    marginBottom: 16,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.deepIndigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.deepIndigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonDisabled: {
    backgroundColor: colors.sandstone,
  },
  audioLabel: {
    color: colors.ashGray,
    fontSize: 14,
  },
  bottomAction: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.sandstone,
  },
  checkAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.deepIndigo,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  checkAnotherText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
