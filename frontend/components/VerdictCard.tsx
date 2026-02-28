import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckResult } from '../store/useCheckStore';

interface VerdictCardProps {
  result: CheckResult;
}

const getVerdictConfig = (verdict: string) => {
  switch (verdict) {
    case 'TRUE':
      return {
        color: '#10B981',
        bgColor: '#064E3B',
        icon: 'checkmark-circle' as const,
        label: 'TRUE',
        labelHindi: 'सच',
      };
    case 'FALSE':
      return {
        color: '#EF4444',
        bgColor: '#7F1D1D',
        icon: 'close-circle' as const,
        label: 'FALSE',
        labelHindi: 'झूठ',
      };
    case 'MISLEADING':
      return {
        color: '#F59E0B',
        bgColor: '#78350F',
        icon: 'warning' as const,
        label: 'MISLEADING',
        labelHindi: 'भ्रामक',
      };
    case 'PARTIALLY_TRUE':
      return {
        color: '#3B82F6',
        bgColor: '#1E3A8A',
        icon: 'remove-circle' as const,
        label: 'PARTIALLY TRUE',
        labelHindi: 'आंशिक सच',
      };
    default:
      return {
        color: '#6B7280',
        bgColor: '#374151',
        icon: 'help-circle' as const,
        label: 'UNKNOWN',
        labelHindi: 'अज्ञात',
      };
  }
};

export const VerdictCard: React.FC<VerdictCardProps> = ({ result }) => {
  const config = getVerdictConfig(result.verdict);

  return (
    <View style={styles.container}>
      {/* Verdict Badge */}
      <View style={[styles.verdictBadge, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={48} color={config.color} />
        <Text style={[styles.verdictText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>

      {/* Claim */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CLAIM</Text>
        <Text style={styles.claimText}>{result.claim}</Text>
      </View>

      {/* Confidence */}
      <View style={styles.confidenceContainer}>
        <Text style={styles.sectionLabel}>CONFIDENCE</Text>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${result.confidence}%`,
                backgroundColor: config.color,
              },
            ]}
          />
        </View>
        <Text style={[styles.confidenceText, { color: config.color }]}>
          {result.confidence}%
        </Text>
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EXPLANATION</Text>
        <Text style={styles.reasonText}>{result.reason}</Text>
      </View>

      {/* Verdict in regional language */}
      <View style={[styles.verdictTextBox, { borderColor: config.color }]}>
        <Ionicons name="volume-high" size={20} color={config.color} />
        <Text style={styles.verdictSpeechText}>{result.verdict_text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  verdictBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  verdictText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    letterSpacing: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  claimText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
  },
  confidenceContainer: {
    marginBottom: 20,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#1F2937',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reasonText: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24,
  },
  verdictTextBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  verdictSpeechText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
});
