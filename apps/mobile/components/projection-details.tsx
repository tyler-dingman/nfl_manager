import { labScoreColor } from '../../../packages/parlay/lab-score-config';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  projectionDetails,
  SCORE_GAUGE_PATH,
  SCORE_GAUGE_LENGTH,
} from '../../../packages/parlay/projection-details';
import type { LabScoreV2 } from '../../../src/server/historical-stats/lab-score-v2';
export function ProjectionDetails({
  projection,
  active,
  stat,
  position,
  children,
}: {
  projection?: LabScoreV2;
  active: boolean;
  stat: string;
  position?: string | null;
  children?: ReactNode;
}) {
  const d = projectionDetails(projection, active, stat, position);
  return (
    <View style={s.card} accessibilityLabel="Lab Score 2.0 dashboard">
      <View style={s.block}>
        <Text style={s.heading}>LAB SCORE 2.0</Text>
        <View
          style={s.gauge}
          accessibilityLabel={`Lab Score 2.0 ${d.score ?? 'unavailable'}, ${d.confidence} confidence. Not win probability.`}
        >
          <Svg width={210} height={180} viewBox="0 0 200 170">
            <Path d={SCORE_GAUGE_PATH} fill="none" stroke="#19333f" strokeWidth={14} />
            <Path
              d={SCORE_GAUGE_PATH}
              fill="none"
              stroke={labScoreColor(d.score)}
              strokeWidth={14}
              strokeDasharray={`${((d.score ?? 0) / 100) * SCORE_GAUGE_LENGTH} ${SCORE_GAUGE_LENGTH}`}
            />
          </Svg>
          <View style={s.gaugeText}>
            <Text style={[s.score, { color: labScoreColor(d.score) }]}>{d.score ?? '—'}</Text>
            <Text style={s.label}>{d.band}</Text>
          </View>
        </View>
        <Text style={s.copy}>{d.sentence}</Text>
      </View>
      <View style={s.block}>
        <Text style={s.label}>◎ THE PICK</Text>
        <Text style={s.pick}>{d.pick}</Text>
        <Text style={s.heading}>{d.stat.toUpperCase()}</Text>
        <View style={s.metrics}>
          {d.metrics.map(([label, value]) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={s.value}>{value}</Text>
              <Text style={s.copy}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.heading}>{d.lean.toUpperCase()}</Text>
      {d.signals.map((signal, i) => (
        <View key={signal.label} style={s.signal}>
          <Feather
            name={(['users', 'bar-chart-2', 'clock'] as const)[i]}
            size={24}
            color="#f4f8fc"
          />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.label}>{signal.label.toUpperCase()}</Text>
            <Text style={s.strong}>{signal.value}</Text>
            <Text style={s.copy}>{signal.note}</Text>
          </View>
        </View>
      ))}
      <View style={[s.callout, d.material && { borderColor: '#ff123e80' }]}>
        <Text style={[s.heading, d.material && { color: '#ff123e' }]}>
          {d.material ? 'ϟ ' : ''}
          {d.calloutTitle.toUpperCase()}
        </Text>
        {d.material && <Text style={s.copy}>Role confidence: {d.roleConfidence}</Text>}
        <Text style={s.strong}>{d.calloutLead}</Text>
        <Text style={s.copy}>{d.calloutText}</Text>
      </View>
      <View style={s.block} accessibilityLabel="Score components">
        {d.breakdown.map((c) => (
          <View key={c.label} style={s.metrics}>
            <Text style={[s.copy, { flex: 1 }]}>
              {c.label} · {c.weight == null ? '—' : `${Math.round(c.weight * 100)}%`}
            </Text>
            <Text style={s.strong}>
              {c.score == null ? 'Unavailable' : `${Math.round(c.score)}/100`}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.copy}>{d.explanation}</Text>
      <Text style={s.note}>
        Estimated hit probability: {d.probability}. Betting value: {d.value}. {d.reliability}.
        Missing optional components are reweighted; evidence reliability moderates the final score.
      </Text>
      {children}
      <Text style={s.note}>{d.historyNote}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 9,
    backgroundColor: '#031923',
    borderColor: '#183b4c',
    borderWidth: 1,
    gap: 16,
  },
  block: { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#183b4c', gap: 8 },
  heading: { fontFamily: 'BarlowCondensed', fontSize: 22, color: '#f4f8fc' },
  label: { fontSize: 11, color: '#a8bac4', fontWeight: '700' },
  gauge: { alignSelf: 'center', width: 210, height: 180 },
  gaugeText: { position: 'absolute', top: 53, left: 0, right: 0, alignItems: 'center' },
  score: { fontFamily: 'BarlowCondensed', fontSize: 60, color: '#f4f8fc', lineHeight: 65 },
  copy: { fontSize: 12, lineHeight: 19, color: '#a8bac4' },
  note: { fontSize: 10, lineHeight: 16, color: '#a8bac4' },
  pick: { fontFamily: 'BarlowCondensed', fontSize: 40, color: '#f4f8fc' },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 12 },
  value: { fontFamily: 'BarlowCondensed', fontSize: 30, color: '#f4f8fc' },
  strong: { fontSize: 14, fontWeight: '700', color: '#f4f8fc' },
  signal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#183b4c',
    padding: 14,
    borderRadius: 7,
  },
  callout: { borderWidth: 1, borderColor: '#183b4c', padding: 14, borderRadius: 8, gap: 8 },
});
