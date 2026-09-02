import type { ThreeAndOutSnapshot } from './types';

export type SpeechGenerationRequest = { text: string; voice?: string; teamId: string };
export type GeneratedSpeech = {
  audioUrl: string;
  duration: number;
  generatedAt: string;
  scriptVersion: string;
};

export interface SpeechProvider {
  generateSpeech(request: SpeechGenerationRequest): Promise<GeneratedSpeech>;
}

export function generateThreeAndOutAudioScript(snapshot: ThreeAndOutSnapshot) {
  const downs = ['First', 'Second', 'Third'];
  const body = snapshot.stories
    .map((story, index) => {
      const attribution = story.sources.find((source) => source.isOriginalReporter);
      const credit = attribution
        ? ` ${attribution.authorName ?? attribution.sourceName} first reported the development.`
        : '';
      return `${downs[index]} down: ${story.shortTitle}. ${story.summary} Why does it matter? ${story.whyItMatters} Next, ${story.whatsNext}${credit}`;
    })
    .join(' ');
  return `Here’s your ${snapshot.teamName} Three and Out. ${body} And that’s your ${snapshot.teamName} Three and Out. We’ll update it when something changes.`;
}

export function estimateAudioDuration(script: string) {
  return Math.max(1, Math.round((script.trim().split(/\s+/).length / 155) * 60));
}
