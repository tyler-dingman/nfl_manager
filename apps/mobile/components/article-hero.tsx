import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  articleAge,
  articleDate,
  articleHeroDesign,
  articlePublishedAt,
  resolveBeatArtwork,
  type ArticleHeroStory,
} from '../../../packages/beat/article-hero';
import { beatPalette } from '../../../src/components/beat/beat-model';
import { TEAM_LIST } from '../../../src/data/teams';
import { normalizeDisplayHeadline } from '../../../src/lib/display-headline';
import { BeatArtwork } from './beat-artwork';

export function ArticleHero({ story }: { story: ArticleHeroStory }) {
  const decision = resolveBeatArtwork(story);
  const palette = beatPalette(story.teamAbbr);
  const team = TEAM_LIST.find((t) => t.abbr === palette.team);
  const headline = normalizeDisplayHeadline(story.headline);
  const published = articlePublishedAt(story);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [story.id, story.updatedAt]);
  return (
    <View style={s.hero} testID="article-hero">
      <View style={s.artwork} pointerEvents="none">
        <BeatArtwork decision={decision} teamId={story.teamAbbr} />
      </View>
      <View style={s.top}>
        <Text style={[s.category, { borderLeftColor: palette.accent }]}>
          <Text style={{ color: palette.accent }}>{decision.displayCategory.toUpperCase()}</Text> |{' '}
          {team ? team.name.toUpperCase() : story.teamAbbr}
        </Text>
        <Text style={s.age}>
          {now === null ? story.updatedAt?.slice(0, 10) : articleAge(story.updatedAt, now)}
        </Text>
      </View>
      <View>
        <Text
          accessibilityRole="header"
          style={[
            s.headline,
            headline.length > 110 && s.long,
            headline.length > 180 && s.extraLong,
          ]}
        >
          {headline}
        </Text>
        <Text style={s.deck}>{story.summary}</Text>
      </View>
      <Text style={s.metadata}>
        {[
          published ? `Published ${articleDate(published)}` : '',
          story.updatedAt ? `Updated ${articleDate(story.updatedAt)}` : '',
          `${story.sourceCount} ${story.sourceCount === 1 ? 'source' : 'sources'}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    minHeight: articleHeroDesign.mobileMinHeight,
    backgroundColor: '#0b1115',
    padding: 18,
    gap: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  artwork: { position: 'absolute', right: -35, top: 35, width: 320, opacity: 0.18 },
  top: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 38, gap: 8 },
  category: {
    flex: 1,
    color: '#e5e8ea',
    fontSize: 10,
    lineHeight: 18,
    letterSpacing: 0.8,
    fontWeight: '800',
    borderLeftWidth: 4,
    paddingLeft: 9,
  },
  age: { color: '#fff', fontSize: 10, fontWeight: '800' },
  headline: {
    color: '#fff',
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.6,
  },
  long: { fontSize: 23, lineHeight: 26 },
  extraLong: { fontSize: 21, lineHeight: 24 },
  deck: { color: '#f1f3f4', fontSize: 14, lineHeight: 20, marginTop: 9 },
  metadata: { color: '#cbd3d7', fontSize: 10, lineHeight: 15 },
});
