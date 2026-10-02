import { parseSearchAnswerCitations } from '../../../src/features/search/citations';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { SearchResponse } from '../../../src/features/search/types';
import type { SearchGame } from '../../../src/features/search/answer-types';
import { TEAM_LIST } from '../../../src/data/teams';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { API_BASE_URL } from '../lib/network';

const open = (url: string) => void Linking.openURL(url.startsWith('/') ? `${API_BASE_URL}${url}` : url);
function Game({ game, timeZone }: { game: SearchGame; timeZone: string }) {
  return <View style={s.card}>
    <Text style={s.label}>{game.status.toUpperCase()}</Text>
    {[game.away, game.home].map((name, i) => {
      const team = TEAM_LIST.find(t => t.abbr === name || t.name === name);
      return <View key={i} style={s.row}>{i === 1 && <Text style={s.text}>at</Text>}{team && <Image source={teamLogoAssets[team.abbr]} style={{ width: 28, height: 28 }} contentFit="contain" />}<Text style={[s.text, { fontWeight: '700', flex: 1 }]}>{team?.name ?? name}</Text></View>;
    })}
    <Text style={s.text}>{game.timeTbd ? 'Time TBD' : new Date(game.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' })}</Text>
    {game.venue && <Text style={s.text}>{game.venue}</Text>}
    {game.network && <Text style={s.text}>TV: {game.network}</Text>}
    <Text accessibilityRole="link" onPress={() => open(game.source.url)} style={s.link}>{game.source.title}</Text>
  </View>;
}
export function SearchAnswer({ response, accent }: { response: SearchResponse; accent: string }) {
  return <View>
    <Text style={[s.label, { color: accent, letterSpacing: 1.9, marginBottom: 12 }]}>✧ DOWN &amp; DISTANCE ANSWER</Text>
    <Text style={s.text}>{parseSearchAnswerCitations(response.answer ?? '', response.sources?.length ?? 0).map((segment, i) => segment.type === 'text' ? segment.value : <Text key={i} accessibilityRole="link" onPress={() => open(response.sources[segment.sourceIndex].url)} style={{ color: accent, fontWeight: '900', textDecorationLine: 'underline' }}>{segment.value}</Text>)}</Text>
    {response.blocks?.map((block, i) => <View key={i} style={{ marginTop: 16 }}>
      {block.type === 'paragraph' ? <Text style={s.text}>{block.text}</Text> : block.type === 'bulletList' ? <><Text style={s.label}>{block.title}</Text>{block.items.map((item, j) => <Text key={j} style={s.text}>• {item}</Text>)}</> : block.type === 'gameCard' || block.type === 'oddsCard' ? <><Game game={block.game} timeZone={block.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} />{block.type === 'oddsCard' && block.lines.map((line, j) => <Text key={j} style={s.text}>{line.market} · {line.selection} {line.line} · {line.price}</Text>)}</> : block.type === 'schedule' ? block.games.map(game => <Game key={game.id} game={game} timeZone={block.timeZone} />) : <><Text style={s.label}>{block.title}</Text><ScrollView horizontal><View><View style={s.row}>{block.columns.map((c,j) => <Text key={j} style={s.cell}>{c}</Text>)}</View>{block.rows.map((row,j) => <View key={j} style={s.row}>{row.map((value,k) => <Text key={k} style={s.cell}>{value}</Text>)}</View>)}</View></ScrollView></>}
    </View>)}
    {response.sources?.map((source, i) => <Text key={source.id} accessibilityRole="link" onPress={() => open(source.url)} style={[s.link, { color: accent }]}>[{i + 1}] {source.title}</Text>)}
    {response.results?.map(result => <Text key={result.id} accessibilityRole="link" onPress={() => open(result.url)} style={s.link}>{result.title} →</Text>)}
  </View>;
}
const s = StyleSheet.create({
  text: { color: '#00172b', fontSize: 15, lineHeight: 28, fontWeight: '500' },
  label: { color: '#00172b', fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  link: { color: '#00172b', textDecorationLine: 'underline', fontSize: 14, lineHeight: 24, marginTop: 12 },
  cell: { width: 120, color: '#00172b', fontSize: 13, lineHeight: 20 },
});
