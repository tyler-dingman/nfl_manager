import { validateParlayBuild } from '../../../packages/parlay/validate-build';
import { useState } from 'react';
import { ParlayIcon } from './parlay-icon';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  describeGeneratorRules,
  generateConstrainedParlay,
  parseGeneratorRequest,
  type GeneratorRules,
} from '../../../src/lib/parlay-lab/generator';
import { getParlayEvents, getParlayMarkets, type ParlayMarket } from '../lib/parlay';
export function ParlayGenerator({
  teamId,
  slip,
  setSlip,
  onOpen,
  onClose,
}: {
  onClose?: () => void;
  teamId: string;
  slip: ParlayMarket[];
  setSlip: (v: ParlayMarket[]) => void;
  onOpen: (v: ParlayMarket) => void;
}) {
  const [formula, setFormula] = useState('');
  const [more, setMore] = useState(false);
  const [prompt, setPrompt] = useState(''),
    [refinement, setRefinement] = useState(''),
    [rules, setRules] = useState<GeneratorRules | null>(null),
    [legs, setLegs] = useState<ParlayMarket[]>([]),
    [recent, setRecent] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  async function generate(text: string, refine = false, rerun = false) {
    if (busy || !text.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const [data, games] = await Promise.all([getParlayMarkets(), getParlayEvents()]);
      const next = parseGeneratorRequest(
        text,
        data.markets,
        teamId,
        refine && rules ? rules : undefined,
      );
      if (refine && /different players/i.test(text)) {
        next.excludePlayers = legs.map((m) => m.playerName ?? '');
        next.players = [];
      }
      const result = generateConstrainedParlay(
        data.markets,
        games.events,
        next,
        rerun ? legs.map((m) => m.id) : [],
      );
      setRules(next);
      setLegs(result.legs);
      setNotice(result.message);
      setRecent((old) => [text, ...old.filter((x) => x !== text)].slice(0, 8));
      setRefinement('');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to generate. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function addAll() {
    if (busy || !legs.length) return;
    setBusy(true);
    try {
      const [data, games] = await Promise.all([getParlayMarkets(), getParlayEvents()]);
      const valid = validateParlayBuild(
        legs,
        data.markets,
        games.events,
        rules?.minScore ?? 0,
      ).every(Boolean);
      if (!valid)
        throw new Error('Lines or availability changed. Regenerate before adding these legs.');
      setSlip([
        ...slip,
        ...legs.filter((m) => !slip.some((s) => s.id === m.id && s.sportsbook === m.sportsbook)),
      ]);
      setNotice('Added to My Parlay. Review and save your build below.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to refresh lines.');
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, action: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={s.button}
    >
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <ParlayIcon name="experiment" color="#ff244e" size={38} />
        <Text style={s.title}>
          CREATE A <Text style={{ color: '#ff244e' }}>PARLAY</Text>
        </Text>
        {onClose && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Create a Parlay"
            onPress={onClose}
            style={s.close}
          >
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
        )}
      </View>
      <Text style={s.copy}>
        Tell us what you’re looking for. We’ll use real data and proven trends to build the best
        slip for you.
      </Text>
      <Text style={s.section}>WHAT ARE WE BUILDING?</Text>
      <View style={s.promptBox}>
        <Ionicons
          name="sparkles-outline"
          color="#ff244e"
          size={22}
          style={{ position: 'absolute', left: 12, top: 18 }}
        />
        <TextInput
          accessibilityLabel="What are we building?"
          multiline
          maxLength={500}
          value={prompt}
          onChangeText={(text) => {
            setPrompt(text);
            setFormula('');
          }}
          placeholder="Build me a 3-leg parlay with passing yards, a touchdown scorer, and safer lines..."
          placeholderTextColor="#9db4c6"
          style={s.prompt}
        />
        <Text style={s.counter}>{prompt.length}/500</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy || !prompt.trim()}
        onPress={() => void generate(prompt)}
        style={({ pressed }) => [
          s.cta,
          { opacity: busy || !prompt.trim()?.length ? 0.5 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={s.section}>{busy ? 'BUILDING YOUR PARLAY…' : 'BUILD MY PARLAY  →'}</Text>
      </Pressable>
      <View style={s.divider}>
        <View style={s.line} />
        <Text style={s.copy}>OR</Text>
        <View style={s.line} />
      </View>
      <Text style={s.section}>OR START WITH A FORMULA</Text>
      <Text style={s.copy}>Pick a proven starting point and we’ll build it for you.</Text>
      <View style={s.formulas}>
        {(
          [
            [
              '3-LEGGER',
              'star-outline',
              'Balanced parlay with strong value',
              'Build me a 3-leg parlay.',
            ],
            [
              'PLUS MONEY',
              'cash-outline',
              'Higher payout parlays',
              'Build me a plus money 3-leg parlay.',
            ],
            [
              'TD PICKS',
              'bar-chart-outline',
              'Build around touchdown scorers',
              'Build me a 3-leg parlay using touchdown props.',
            ],
            [
              'HIGH HIT RATE',
              'trending-up',
              'Safer lines with strong probabilities',
              'Build me a 3-leg parlay using high historical hit-rate props.',
            ],
            [
              'UNDERS',
              'arrow-down',
              'Find value with unders across key stats',
              'Build me a 3-leg parlay using strong Under trends.',
            ],
          ] as const
        ).map(([title, icon, description, text]) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityState={{ selected: formula === title, disabled: busy }}
            disabled={busy}
            onPress={() => {
              setPrompt(text);
              setFormula(title);
            }}
            style={({ pressed }) => [
              s.formula,
              { borderColor: formula === title || pressed ? '#ff244e' : '#183b4c' },
            ]}
          >
            <Ionicons name={icon} color="#ff244e" size={30} />
            <Text style={s.section}>{title}</Text>
            <Text style={[s.copy, { textAlign: 'center', fontSize: 13, lineHeight: 19 }]}>
              {description}
            </Text>
          </Pressable>
        ))}
      </View>
      {button(more ? 'Fewer suggestions' : 'More suggestions', () => setMore(!more))}
      {more &&
        !legs.length &&
        [
          '3 legs with the highest Lab Scores',
          '3 legs around my team',
          '4 legs with 80+ Lab Scores',
          '3 legs without touchdown props',
          '3 leg same-game parlay',
          '5 legs from different games',
          '3 most consistent props',
          '3 high upside legs',
          '3 running back props',
        ].map((text) =>
          button(text, () => {
            setPrompt(text);
            void generate(text);
          }),
        )}
      {!!notice && (
        <Text accessibilityRole="alert" style={s.copy}>
          {notice}
        </Text>
      )}
      {rules && <Text style={s.copy}>{describeGeneratorRules(rules)}</Text>}
      {legs.map((m, i) => (
        <Pressable key={`${m.id}:${m.sportsbook}`} onPress={() => onOpen(m)} style={s.leg}>
          <Text style={s.heading}>
            {i + 1}. {m.playerName}
          </Text>
          <Text style={s.copy}>
            {m.side} {m.line} · {m.marketType.replaceAll('_', ' ')} · {m.odds}
          </Text>
          <Text style={s.eyebrow}>
            LAB SCORE {Math.round(m.trend?.trendScore ?? 0)} · VIEW RESEARCH →
          </Text>
        </Pressable>
      ))}
      {!!legs.length && (
        <>
          {button('ADD ALL TO MY PARLAY', () => void addAll())}
          {button('REGENERATE', () => void generate(prompt, false, true))}
          <TextInput
            accessibilityLabel="Refine your parlay"
            value={refinement}
            onChangeText={setRefinement}
            placeholder="Make it more conservative"
            placeholderTextColor="#94AAB5"
            style={s.input}
          />
          {button('REFINE RESULTS', () => void generate(refinement, true))}
        </>
      )}
      {!!recent.length && (
        <>
          <Text style={s.heading}>RECENT REQUESTS</Text>
          {recent.map((text) =>
            button(text, () => {
              setPrompt(text);
              void generate(text);
            }),
          )}
        </>
      )}
      <View style={s.footer}>
        <Text style={s.copy}>▥ Uses real data + proven trends.</Text>
        <Text style={s.copy}>You’ll review every leg before adding it.</Text>
        <Text style={s.brand}>DOWN &amp; DISTANCE</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: '#00121b' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: 'BarlowCondensed',
    fontStyle: 'italic',
    color: 'white',
    fontSize: 32,
    flex: 1,
  },
  close: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#183b4c',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { fontFamily: 'BarlowCondensed', fontSize: 20, color: 'white' },
  promptBox: {
    borderWidth: 1,
    borderColor: '#ff244e',
    borderRadius: 10,
    backgroundColor: '#031923',
  },
  prompt: {
    color: 'white',
    fontSize: 16,
    padding: 16,
    paddingLeft: 44,
    paddingBottom: 28,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: { position: 'absolute', right: 10, bottom: 6, fontSize: 12, color: '#9db4c6' },
  cta: {
    backgroundColor: '#ff244e',
    borderRadius: 10,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 4 },
  line: { height: 1, backgroundColor: '#183b4c', flex: 1 },
  formulas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formula: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    minHeight: 155,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#031923',
  },
  footer: { borderTopWidth: 1, borderColor: '#183b4c', paddingTop: 16, gap: 8 },
  brand: { fontFamily: 'BarlowCondensed', color: '#9db4c6', letterSpacing: 3, fontSize: 12 },
  heading: { color: 'white', fontSize: 28, fontFamily: 'BarlowCondensed' },
  eyebrow: { color: '#FFCA00', fontSize: 12, fontWeight: '800' },
  copy: { color: '#B8CBD4', fontSize: 15, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: '#285064',
    borderRadius: 10,
    padding: 16,
    color: 'white',
    minHeight: 64,
  },
  button: {
    backgroundColor: '#092735',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#285064',
  },
  label: { color: 'white', fontWeight: '800' },
  leg: { padding: 16, gap: 8, borderWidth: 1, borderColor: '#285064', borderRadius: 10 },
});
