import { getActiveSimulationRoster } from '../../../src/lib/front-office-roster';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PlayerRowDTO } from '../../../src/types/player';
import { getPlayerTransactionTheme } from '../../../src/lib/team-theme-tokens';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import { scoreFreeAgencyOffer } from '../../../src/lib/free-agency-scoring';
import { estimateResignInterest } from '../../../src/lib/resign-scoring';
import { resolvePlayerRating } from '../../../src/lib/team-overview';
import { API_BASE_URL } from '../lib/network';
type Props = {
  player: PlayerRowDTO;
  team: string;
  signing: boolean;
  season: number;
  roster: PlayerRowDTO[];
  years: string;
  apy: string;
  guaranteed: string;
  setYears: (value: string) => void;
  setApy: (value: string) => void;
  setGuaranteed: (value: string) => void;
  busy: boolean;
  response: string;
  onOffer: () => void;
  onRelease: () => void;
  onClose: () => void;
};
export function PlayerTransactionWorkspace(p: Props) {
  const [release, setRelease] = useState(false),
    [failed, setFailed] = useState(false);
  const theme = getPlayerTransactionTheme(p.team),
    name = `${p.player.firstName} ${p.player.lastName}`;
  const years = Number(p.years) || 0,
    apy = Number(p.apy) || 0,
    guaranteed = Number(p.guaranteed) || 0;
  const rating = resolvePlayerRating(p.player);
  const estimate = p.signing
    ? scoreFreeAgencyOffer({ player: p.player, years, apy, guaranteed, teamAbbr: p.team })
    : estimateResignInterest({
        playerId: p.player.id,
        position: p.player.position,
        age: p.player.age ?? 27,
        rating: rating ?? 75,
        years,
        apy,
        guaranteed,
        teamAbbr: p.team,
        teamRoster: p.roster,
      });
  const score = estimate.interestScore,
    interest = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(1)}M`;
  const savings =
    p.player.releaseSavings ??
    Math.max(
      0,
      (parseFloat(p.player.capHit.replace(/[$M,]/gi, '')) || 0) - (p.player.deadCap ?? 0),
    );
  const depth = getActiveSimulationRoster(p.roster, p.team).filter(
    (t) => t.id !== p.player.id && t.position === p.player.position,
  ).length;
  const capCopy =
    savings >= 0
      ? `create ${money(savings)} in cap space`
      : `reduce cap space by ${money(-savings)}`;
  const metrics = release
    ? [
        ['Cap Space Created', money(savings)],
        [`Dead Cap (${p.season})`, money(p.player.deadCap ?? 0)],
        [`${p.season} Cap Hit`, p.player.capHit],
        ['Position Depth', `${depth} remaining`],
      ]
    : p.signing
      ? [
          ['Expected APY', money(estimate.expectedApy)],
          [
            'Preferred Deal',
            `${estimate.expectedYearsRange[0]}–${estimate.expectedYearsRange[1]} Years`,
          ],
          ['Market Status', 'Available Free Agent'],
          ['Interest', `${interest} · ${score.toFixed(0)}%`],
        ]
      : [
          ['Current Cap Hit', p.player.capHit],
          ['Expected APY', money(estimate.expectedApy)],
          ['Years Remaining', String(p.player.contractYearsRemaining ?? '—')],
          ['Interest', `${interest} · ${score.toFixed(0)}%`],
        ];
  return (
    <View style={{ gap: 14 }}>
      <View style={[s.hero, { borderLeftColor: theme.interactive }]}>
        <Image
          source={{ uri: API_BASE_URL + gameDayHeroAsset(p.team) }}
          style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}
          resizeMode="cover"
          accessibilityElementsHidden
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.interactive, opacity: 0.1 }]}
        />
        <Text style={s.position} accessibilityElementsHidden>
          {p.player.position}
        </Text>
        {!failed && p.player.headshotUrl ? (
          <Image
            source={{
              uri: p.player.headshotUrl.startsWith('/')
                ? API_BASE_URL + p.player.headshotUrl
                : p.player.headshotUrl,
            }}
            style={s.portrait}
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={[s.portrait, { justifyContent: 'flex-end', alignItems: 'center' }]}>
            <Text style={s.initials}>
              {p.player.firstName?.[0]}
              {p.player.lastName?.[0]}
            </Text>
          </View>
        )}
        <Text style={s.eyebrow}>
          {release ? 'ROSTER MOVE' : p.signing ? 'FREE AGENT' : 'CONTRACT NEGOTIATION'}
        </Text>
        <Text style={s.title}>
          {release ? `Release ${name}?` : p.signing ? `Sign ${name}` : `Re-Negotiate With ${name}`}
        </Text>
        <Text style={[s.copy, { maxWidth: '54%' }]}>
          {release
            ? `Moving on would ${capCopy}. Review the financial impact before making a decision.`
            : p.signing
              ? 'Set contract terms and gauge interest.'
              : 'Set new contract terms and see if you can reach an agreement.'}
        </Text>
        <Text style={[s.copy, { maxWidth: '54%' }]}>
          {p.player.position}
          {p.player.age != null ? ` · Age ${p.player.age}` : ''}
          {p.player.height ? ` · ${p.player.height}` : ''}
          {p.player.weight ? ` · ${p.player.weight} lbs` : ''}
        </Text>
        {p.signing && <Text style={s.copy}>Free Agent</Text>}
        <View style={s.rating}>
          <Text style={s.label}>OVR</Text>
          <Text style={s.number}>{rating ?? '—'}</Text>
          <View style={{ height: 4, backgroundColor: theme.interactive, borderRadius: 3 }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close transaction dialog"
          onPress={p.onClose}
          style={s.close}
        >
          <Feather name="x" size={24} color="white" />
        </Pressable>
      </View>
      <View style={s.metrics}>
        {metrics.map(([label, value]) => (
          <View key={label} style={s.metric}>
            <Text style={s.label}>{label.toUpperCase()}</Text>
            <Text style={s.metricValue}>{value}</Text>
          </View>
        ))}
      </View>
      {!release && (
        <View style={s.panel}>
          <Text style={s.copy}>
            Interest: {interest} · {score.toFixed(0)}%
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: score }}
            style={s.track}
          >
            <View
              style={{ width: `${score}%`, height: 8, backgroundColor: '#00c58e', borderRadius: 9 }}
            />
          </View>
        </View>
      )}
      {release ? (
        <>
          <View style={s.panel}>
            <Text style={s.heading}>ROSTER IMPACT</Text>
            <Text style={s.copy}>Cap space: {money(savings)}</Text>
            <Text style={s.copy}>Roster size: −1 player</Text>
            <Text style={s.copy}>
              Position depth: {depth} remaining at {p.player.position}
            </Text>
          </View>
          <View style={s.panel}>
            <Text style={s.heading}>CONFIRM ROSTER MOVE</Text>
            <Text style={s.copy}>
              Releasing {name} is permanent and will {capCopy}. This action cannot be undone.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Confirm release of ${name}`}
              disabled={p.busy}
              onPress={p.onRelease}
              style={[s.button, { backgroundColor: theme.interactive, opacity: p.busy ? 0.5 : 1 }]}
            >
              <Text style={[s.buttonText, { color: theme.interactiveForeground }]}>
                {p.busy ? 'Releasing…' : 'Release Player →'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={p.busy}
              onPress={() => setRelease(false)}
              style={s.secondary}
            >
              <Text style={s.copy}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={s.panel}>
            <Text style={s.heading}>CONTRACT TERMS</Text>
            <Text style={s.copy}>
              Adjust your offer to{' '}
              {p.signing ? 'improve his interest.' : 'keep this player on your team.'}
            </Text>
            <Pressable
              disabled
              accessibilityLabel="Market comparables unavailable"
              style={s.secondary}
            >
              <Text style={s.copy}>View Market Comparables · Unavailable</Text>
            </Pressable>
            {(
              [
                ['Years', p.years, p.setYears],
                ['APY (M)', p.apy, p.setApy],
                ['Guaranteed (M)', p.guaranteed, p.setGuaranteed],
              ] as const
            ).map(([label, value, set]) => (
              <View key={label}>
                <Text style={s.label}>{label.toUpperCase()}</Text>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={set}
                  style={s.input}
                />
              </View>
            ))}
          </View>
          <View style={s.panel}>
            <Text style={s.label}>PROJECTED TOTAL VALUE</Text>
            <Text style={s.number}>{money(years * apy)}</Text>
            <Text style={s.copy}>
              {years} years · {money(guaranteed)} guaranteed
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={p.busy}
              style={[s.button, { backgroundColor: theme.interactive, opacity: p.busy ? 0.5 : 1 }]}
              onPress={p.onOffer}
            >
              <Text style={[s.buttonText, { color: theme.interactiveForeground }]}>
                {p.busy ? 'Sending Offer…' : 'Send Offer →'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={p.busy}
              onPress={p.onClose}
              style={s.secondary}
            >
              <Text style={s.copy}>{p.signing ? 'Cancel' : 'Walk Away'}</Text>
            </Pressable>
          </View>
          {!p.signing && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRelease(true)}
              disabled={p.busy}
              style={s.secondary}
            >
              <Text style={s.copy}>Review player release</Text>
            </Pressable>
          )}
        </>
      )}
      {!!p.response && (
        <Text accessibilityRole="alert" style={s.copy}>
          {p.response}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    minHeight: 360,
    backgroundColor: '#041b25',
    borderWidth: 1,
    borderColor: '#294651',
    borderLeftWidth: 6,
    borderRadius: 9,
    overflow: 'hidden',
    padding: 18,
  },
  eyebrow: {
    fontFamily: 'BarlowCondensed',
    fontSize: 14,
    color: '#b9cdd8',
    marginBottom: 10,
    marginRight: 30,
  },
  title: {
    fontFamily: 'BarlowCondensed',
    fontStyle: 'italic',
    fontSize: 34,
    lineHeight: 36,
    color: 'white',
    marginBottom: 12,
    paddingRight: 20,
  },
  copy: { color: '#b9cdd8', fontSize: 14, lineHeight: 21, marginVertical: 8 },
  position: {
    position: 'absolute',
    right: 8,
    bottom: 120,
    fontFamily: 'BarlowCondensed',
    fontSize: 100,
    color: '#bdd6e0',
    opacity: 0.1,
  },
  portrait: { position: 'absolute', right: -15, bottom: 0, width: '44%', height: 220 },
  initials: {
    fontSize: 40,
    color: 'white',
    backgroundColor: '#284b5a',
    borderRadius: 60,
    padding: 20,
  },
  rating: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#31515d',
    backgroundColor: '#031b25',
  },
  close: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#31515d',
    backgroundColor: '#031b25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#294651',
    borderRadius: 9,
    backgroundColor: '#061f28',
    padding: 8,
  },
  metric: { width: '50%', padding: 10 },
  label: { fontSize: 12, color: '#b9cdd8', marginTop: 8 },
  metricValue: { fontFamily: 'BarlowCondensed', fontSize: 27, color: 'white', marginTop: 5 },
  panel: {
    backgroundColor: '#061c25',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#294651',
    padding: 18,
  },
  heading: { fontFamily: 'BarlowCondensed', fontSize: 24, color: 'white' },
  number: { fontFamily: 'BarlowCondensed', fontSize: 40, color: 'white' },
  track: { height: 8, backgroundColor: '#dce5ed', borderRadius: 9, overflow: 'hidden' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#31515d',
    backgroundColor: '#08232e',
    color: 'white',
    padding: 12,
    borderRadius: 5,
    marginTop: 8,
  },
  button: {
    minHeight: 50,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  buttonText: { fontFamily: 'BarlowCondensed', fontSize: 24 },
  secondary: {
    minHeight: 46,
    padding: 10,
    borderWidth: 1,
    borderColor: '#294651',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#09232e',
    marginTop: 12,
  },
});
