import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useCheckStore } from '../store/useCheckStore';
import { VerdictCard } from '../components/VerdictCard';

export default function ResultScreen() {
  const router = useRouter();
  const { result, reset } = useCheckStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Redirect if no result
    if (!result) {
      router.replace('/');
      return;
    }

    // Setup audio
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        if (result.audio_base64) {
          const sound = new Audio.Sound();
          await sound.loadAsync({
            uri: `data:audio/mp3;base64,${result.audio_base64}`,
          });
          soundRef.current = sound;
          setAudioLoaded(true);

          // Auto-play on load
          await sound.playAsync();
          setIsPlaying(true);

          // Listen for playback status
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
      } catch (error) {
        console.error('Audio setup error:', error);
      }
    };

    setupAudio();

    // Cleanup
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
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
          // Replay from start
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
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
                color="#FFFFFF"
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
          <Ionicons name="refresh" size={20} color="#10B981" />
          <Text style={styles.checkAnotherText}>Check Another Video</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
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
    padding: 20,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonDisabled: {
    backgroundColor: '#374151',
  },
  audioLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  bottomAction: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  checkAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  checkAnotherText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
});
