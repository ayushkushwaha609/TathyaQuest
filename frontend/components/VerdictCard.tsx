import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckResult } from '../store/useCheckStore';
import { useThemeStore } from '../store/useThemeStore';
import { ThemeColors } from '../constants/theme';

interface VerdictCardProps {
  result: CheckResult;
}

const getVerdictConfig = (verdict: string, c: ThemeColors) => {
  switch (verdict) {
    case 'TRUE':
      return { color: c.verified, bgColor: c.verifiedBg, borderColor: c.verified, icon: 'checkmark-circle' as const, label: 'VERIFIED', labelHindi: 'सत्यापित' };
    case 'FALSE':
      return { color: c.false, bgColor: c.falseBg, borderColor: c.false, icon: 'close-circle' as const, label: 'FALSE', labelHindi: 'झूठ' };
    case 'MISLEADING':
      return { color: c.turmeric, bgColor: c.turmericBg, borderColor: c.turmeric, icon: 'warning' as const, label: 'MISLEADING', labelHindi: 'भ्रामक' };
    case 'PARTIALLY_TRUE':
      return { color: c.deepTeal, bgColor: c.partialBg, borderColor: c.deepTeal, icon: 'remove-circle' as const, label: 'PARTIALLY TRUE', labelHindi: 'आंशिक सच' };
    default:
      return { color: c.textSecondary, bgColor: c.card, borderColor: c.textSecondary, icon: 'help-circle' as const, label: 'UNKNOWN', labelHindi: 'अज्ञात' };
  }
};

const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'health': return 'fitness';
    case 'science': return 'flask';
    case 'history': return 'time';
    case 'technology': return 'hardware-chip';
    case 'finance': return 'cash';
    case 'news': return 'newspaper';
    default: return 'information-circle';
  }
};

const TABS = ['Verdict', 'Claim', 'Analysis'] as const;
type Tab = typeof TABS[number];

export const VerdictCard: React.FC<VerdictCardProps> = ({ result }) => {
  const { colors: c } = useThemeStore();
  const config = getVerdictConfig(result.verdict, c);
  const [activeTab, setActiveTab] = useState<Tab>('Verdict');
  const [fullVerdictExpanded, setFullVerdictExpanded] = useState(false);

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { backgroundColor: c.deepIndigo as string, borderRadius: 8 }]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? '#fff' : c.textSecondary }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 1 — Claim */}
      {activeTab === 'Claim' && (
        <View style={styles.tabContent}>
          {/* Category */}
          {result.category && (
            <View style={[styles.categoryRow, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <Ionicons name={getCategoryIcon(result.category) as any} size={14} color={c.saffron} />
              <Text style={[styles.categoryText, { color: c.saffron }]}>{result.category.toUpperCase()}</Text>
            </View>
          )}

          {/* Claim EN */}
          {result.claim && (
            <View style={[styles.claimBox, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
              <Text style={[styles.claimText, { color: c.textPrimary }]}>{result.claim}</Text>
            </View>
          )}

          {/* Claim Regional */}
          {result.claim_regional && (
            <View style={[styles.claimBox, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
              <Text style={[styles.claimText, { color: c.textPrimary }]}>{result.claim_regional}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 2 — Analysis */}
      {activeTab === 'Analysis' && (
        <View style={styles.tabContent}>
          {/* Key Points / Per-claim verdicts */}
          {result.key_points?.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>CLAIMS CHECKED</Text>
              <View style={[styles.box, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                {result.key_points.map((point, i) => (
                  <View key={i} style={styles.pointRow}>
                    <View style={[styles.bullet, { backgroundColor: c.saffron }]} />
                    <Text style={[styles.pointText, { color: c.textPrimary }]}>{point}</Text>
                  </View>
                ))}
                {result.key_points_regional?.length > 0 && (
                  <>
                    <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                    <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                    {result.key_points_regional.map((point, i) => (
                      <View key={i} style={styles.pointRow}>
                        <View style={[styles.bullet, { backgroundColor: c.saffron }]} />
                        <Text style={[styles.pointText, { color: c.textPrimary }]}>{point}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          )}

          {/* Fact Details */}
          {result.fact_details && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>THE FACTS</Text>
              <View style={[styles.box, { backgroundColor: c.verifiedBg, borderColor: c.verified, borderLeftWidth: 4 }]}>
                <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.fact_details}</Text>
                {result.fact_details_regional && (
                  <>
                    <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                    <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                    <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.fact_details_regional}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Why Misleading */}
          {(result.why_misleading || result.why_misleading_regional) && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>WHY MISLEADING?</Text>
              <View style={[styles.box, { backgroundColor: c.falseBg, borderColor: c.false, borderLeftWidth: 4 }]}>
                {result.why_misleading && (
                  <>
                    <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                    <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.why_misleading}</Text>
                  </>
                )}
                {result.why_misleading_regional && (
                  <>
                    <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                    <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                    <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.why_misleading_regional}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Sources */}
          {result.sources_note && (
            <View style={[styles.sourcesRow, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <Ionicons name="library" size={14} color={c.textSecondary} />
              <Text style={[styles.sourcesText, { color: c.textSecondary }]}>{result.sources_note}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 3 — Verdict */}
      {activeTab === 'Verdict' && (
        <View style={styles.tabContent}>
          {/* Verdict Badge */}
          <View style={[styles.verdictBadge, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
            <Ionicons name={config.icon} size={48} color={config.color} />
            <Text style={[styles.verdictLabel, { color: config.color }]}>{config.label}</Text>
            <Text style={[styles.verdictHindi, { color: config.color }]}>{config.labelHindi}</Text>
          </View>

          {/* Truth Score */}
          {(() => {
            let truthScore: number;
            switch (result.verdict) {
              case 'TRUE':         truthScore = result.confidence; break;
              case 'FALSE':        truthScore = 100 - result.confidence; break;
              case 'MISLEADING':   truthScore = Math.round((100 - result.confidence) * 0.6); break;
              case 'PARTIALLY_TRUE': truthScore = 50; break;
              default:             truthScore = 50;
            }
            const barColor = truthScore >= 70 ? c.verified : truthScore >= 40 ? c.turmeric : c.false;
            return (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>VIDEO TRUTH SCORE</Text>
                <View style={[styles.confidenceBar, { backgroundColor: c.sandstone }]}>
                  <View style={[styles.confidenceFill, { width: `${truthScore}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.confidenceNum, { color: barColor }]}>{truthScore}% accurate</Text>
              </View>
            );
          })()}

          {/* Quick Verdict */}
          {result.reason && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>QUICK VERDICT</Text>
              <View style={[styles.box, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
                <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.reason}</Text>
                {result.reason_regional && (
                  <>
                    <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                    <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                    <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.reason_regional}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* What to Know */}
          {result.what_to_know && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>WHAT YOU SHOULD KNOW</Text>
              <View style={[styles.box, { backgroundColor: c.turmericBg, borderColor: c.turmeric, borderLeftWidth: 4 }]}>
                <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.what_to_know}</Text>
                {result.what_to_know_regional && (
                  <>
                    <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                    <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                    <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.what_to_know_regional}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Full Verdict — expandable */}
          {(result.verdict_text_english || result.verdict_text_regional) && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.fullVerdictToggle, { backgroundColor: c.card, borderColor: config.borderColor }]}
                onPress={() => setFullVerdictExpanded(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color={config.color} />
                <Text style={[styles.fullVerdictToggleText, { color: config.color }]}>
                  {fullVerdictExpanded ? 'Hide Full Verdict' : 'Read Full Verdict'}
                </Text>
                <Ionicons
                  name={fullVerdictExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={config.color}
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              {fullVerdictExpanded && (
                <View style={[styles.box, { backgroundColor: c.card, borderColor: config.borderColor, borderLeftWidth: 4, marginTop: 8 }]}>
                  {result.verdict_text_english && (
                    <>
                      <Text style={[styles.langLabel, { color: c.saffron }]}>English</Text>
                      <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.verdict_text_english}</Text>
                    </>
                  )}
                  {result.verdict_text_regional && (
                    <>
                      <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
                      <Text style={[styles.langLabel, { color: c.saffron }]}>आपकी भाषा</Text>
                      <Text style={[styles.bodyText, { color: c.textPrimary }]}>{result.verdict_text_regional}</Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  tabBar: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 4, marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabContent: {},
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  categoryText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  claimBox: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  claimText: { fontSize: 16, lineHeight: 24 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  box: { borderRadius: 12, padding: 14, borderWidth: 1 },
  langLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  divider: { height: 1, marginVertical: 10 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10, flexShrink: 0 },
  pointText: { fontSize: 14, lineHeight: 20, flex: 1 },
  sourcesRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 8, padding: 12, gap: 8, borderWidth: 1 },
  sourcesText: { fontSize: 12, fontStyle: 'italic', flex: 1 },
  verdictBadge: { alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 16, borderWidth: 2 },
  verdictLabel: { fontSize: 22, fontWeight: 'bold', marginTop: 8, letterSpacing: 2 },
  verdictHindi: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  confidenceBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  confidenceFill: { height: '100%', borderRadius: 4 },
  confidenceNum: { fontSize: 16, fontWeight: '600' },
  fullVerdictToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  fullVerdictToggleText: { fontSize: 14, fontWeight: '600' },
});
