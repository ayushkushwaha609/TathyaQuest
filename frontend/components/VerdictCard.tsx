import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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

const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'health':
      return 'fitness';
    case 'science':
      return 'flask';
    case 'history':
      return 'time';
    case 'technology':
      return 'hardware-chip';
    case 'finance':
      return 'cash';
    case 'news':
      return 'newspaper';
    default:
      return 'information-circle';
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
        {result.category && (
          <View style={styles.categoryBadge}>
            <Ionicons name={getCategoryIcon(result.category) as any} size={14} color="#9CA3AF" />
            <Text style={styles.categoryText}>{result.category.toUpperCase()}</Text>
          </View>
        )}
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

      {/* Quick Verdict */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>QUICK VERDICT</Text>
        <Text style={styles.reasonText}>{result.reason}</Text>
      </View>

      {/* Key Points from Video */}
      {result.key_points && result.key_points.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KEY POINTS FROM VIDEO</Text>
          <View style={styles.keyPointsContainer}>
            {result.key_points.map((point, index) => (
              <View key={index} style={styles.keyPointItem}>
                <View style={styles.bulletPoint} />
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Detailed Facts */}
      {result.fact_details && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book" size={16} color="#10B981" />
            <Text style={[styles.sectionLabel, { marginLeft: 6, marginBottom: 0 }]}>THE FACTS</Text>
          </View>
          <View style={styles.factDetailsBox}>
            <Text style={styles.factDetailsText}>{result.fact_details}</Text>
          </View>
        </View>
      )}

      {/* What You Should Know */}
      {result.what_to_know && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={16} color="#F59E0B" />
            <Text style={[styles.sectionLabel, { marginLeft: 6, marginBottom: 0 }]}>WHAT YOU SHOULD KNOW</Text>
          </View>
          <View style={styles.adviceBox}>
            <Text style={styles.adviceText}>{result.what_to_know}</Text>
          </View>
        </View>
      )}

      {/* Sources Note */}
      {result.sources_note && (
        <View style={styles.sourcesContainer}>
          <Ionicons name="library" size={14} color="#6B7280" />
          <Text style={styles.sourcesText}>{result.sources_note}</Text>
        </View>
      )}

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
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  keyPointsContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
    marginTop: 7,
    marginRight: 10,
  },
  keyPointText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  factDetailsBox: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  factDetailsText: {
    color: '#D1FAE5',
    fontSize: 15,
    lineHeight: 24,
  },
  adviceBox: {
    backgroundColor: '#78350F',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  adviceText: {
    color: '#FEF3C7',
    fontSize: 15,
    lineHeight: 24,
  },
  sourcesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  sourcesText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontStyle: 'italic',
    flex: 1,
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
