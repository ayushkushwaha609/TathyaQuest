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

// Bilingual Section Component
const BilingualSection = ({ 
  label, 
  englishText, 
  regionalText, 
  icon,
  iconColor,
  boxStyle,
  textStyle
}: {
  label: string;
  englishText: string;
  regionalText?: string;
  icon?: string;
  iconColor?: string;
  boxStyle?: object;
  textStyle?: object;
}) => {
  if (!englishText && !regionalText) return null;
  
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && <Ionicons name={icon as any} size={16} color={iconColor || '#6B7280'} />}
        <Text style={[styles.sectionLabel, icon ? { marginLeft: 6, marginBottom: 0 } : {}]}>{label}</Text>
      </View>
      <View style={[styles.bilingualBox, boxStyle]}>
        {englishText && (
          <View style={styles.languageBlock}>
            <Text style={styles.languageLabel}>🇬🇧 English</Text>
            <Text style={[styles.contentText, textStyle]}>{englishText}</Text>
          </View>
        )}
        {regionalText && (
          <View style={[styles.languageBlock, englishText ? styles.languageBlockBorder : {}]}>
            <Text style={styles.languageLabel}>🇮🇳 आपकी भाषा</Text>
            <Text style={[styles.contentText, textStyle]}>{regionalText}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Bilingual Key Points Component
const BilingualKeyPoints = ({
  englishPoints,
  regionalPoints
}: {
  englishPoints: string[];
  regionalPoints?: string[];
}) => {
  if (!englishPoints || englishPoints.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>KEY POINTS FROM VIDEO</Text>
      <View style={styles.keyPointsContainer}>
        {/* English Points */}
        <View style={styles.languageBlock}>
          <Text style={styles.languageLabel}>🇬🇧 English</Text>
          {englishPoints.map((point, index) => (
            <View key={`en-${index}`} style={styles.keyPointItem}>
              <View style={styles.bulletPoint} />
              <Text style={styles.keyPointText}>{point}</Text>
            </View>
          ))}
        </View>
        {/* Regional Points */}
        {regionalPoints && regionalPoints.length > 0 && (
          <View style={[styles.languageBlock, styles.languageBlockBorder]}>
            <Text style={styles.languageLabel}>🇮🇳 आपकी भाषा</Text>
            {regionalPoints.map((point, index) => (
              <View key={`reg-${index}`} style={styles.keyPointItem}>
                <View style={styles.bulletPoint} />
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
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

      {/* Claim - Bilingual */}
      <BilingualSection
        label="CLAIM"
        englishText={result.claim}
        regionalText={result.claim_regional}
      />

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

      {/* Quick Verdict - Bilingual */}
      <BilingualSection
        label="QUICK VERDICT"
        englishText={result.reason}
        regionalText={result.reason_regional}
      />

      {/* Key Points - Bilingual */}
      <BilingualKeyPoints
        englishPoints={result.key_points}
        regionalPoints={result.key_points_regional}
      />

      {/* Facts - Bilingual */}
      <BilingualSection
        label="THE FACTS"
        englishText={result.fact_details}
        regionalText={result.fact_details_regional}
        icon="book"
        iconColor="#10B981"
        boxStyle={styles.factDetailsBox}
        textStyle={styles.factDetailsText}
      />

      {/* What to Know - Bilingual */}
      <BilingualSection
        label="WHAT YOU SHOULD KNOW"
        englishText={result.what_to_know}
        regionalText={result.what_to_know_regional}
        icon="bulb"
        iconColor="#F59E0B"
        boxStyle={styles.adviceBox}
        textStyle={styles.adviceText}
      />

      {/* Sources Note */}
      {result.sources_note && (
        <View style={styles.sourcesContainer}>
          <Ionicons name="library" size={14} color="#6B7280" />
          <Text style={styles.sourcesText}>{result.sources_note}</Text>
        </View>
      )}

      {/* Why Misleading - Bilingual */}
      {(result.why_misleading || result.why_misleading_regional) && (
        <BilingualSection
          label="WHY IS THIS MISLEADING?"
          englishText={result.why_misleading}
          regionalText={result.why_misleading_regional}
          icon="alert-circle"
          iconColor="#EF4444"
          boxStyle={styles.misleadingBox}
          textStyle={styles.misleadingText}
        />
      )}

      {/* Analysis in English */}
      {result.verdict_text_english && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={16} color="#3B82F6" />
            <Text style={[styles.sectionLabel, { marginLeft: 6, marginBottom: 0 }]}>DETAILED ANALYSIS (ENGLISH)</Text>
          </View>
          <View style={[styles.verdictTextBox, { borderColor: config.color }]}>
            <Text style={styles.verdictSpeechText}>{result.verdict_text_english}</Text>
          </View>
        </View>
      )}

      {/* Analysis in Regional Language */}
      {result.verdict_text_regional && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-high" size={16} color="#10B981" />
            <Text style={[styles.sectionLabel, { marginLeft: 6, marginBottom: 0 }]}>DETAILED ANALYSIS (आपकी भाषा)</Text>
          </View>
          <View style={[styles.verdictTextBox, { borderColor: config.color }]}>
            <Text style={styles.verdictSpeechText}>{result.verdict_text_regional}</Text>
          </View>
        </View>
      )}
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
  bilingualBox: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  languageBlock: {
    padding: 12,
  },
  languageBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  languageLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
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
  keyPointsContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
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
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  factDetailsText: {
    color: '#D1FAE5',
  },
  adviceBox: {
    backgroundColor: '#78350F',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  adviceText: {
    color: '#FEF3C7',
  },
  misleadingBox: {
    backgroundColor: '#7F1D1D',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  misleadingText: {
    color: '#FEE2E2',
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
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  verdictSpeechText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 24,
  },
});
