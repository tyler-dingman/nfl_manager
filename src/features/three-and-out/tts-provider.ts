export type SpeakOptions = {
  onEnd: () => void;
  onError: () => void;
  onProgressIndex?: (index: 0 | 1 | 2) => void;
};
export type ThreeOutSpeechSource = {
  text: string;
  audioUrl?: string;
  sectionStartTimes?: readonly number[];
};

export function getActiveThreeOutSection(
  currentTime: number,
  sectionStartTimes: readonly number[],
): number {
  if (!sectionStartTimes.length) return 0;
  const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  let activeIndex = 0;
  for (let index = 1; index < sectionStartTimes.length; index += 1) {
    if (safeTime < sectionStartTimes[index]) break;
    activeIndex = index;
  }
  return activeIndex;
}

export interface ThreeOutTtsProvider {
  readonly available: boolean;
  speak(source: ThreeOutSpeechSource, options: SpeakOptions): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}

export class BrowserSpeechThreeOutProvider implements ThreeOutTtsProvider {
  get available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(source: ThreeOutSpeechSource, options: SpeakOptions) {
    if (!this.available) return options.onError();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(source.text);
    utterance.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.lang.startsWith('en-US') && /male/i.test(voice.name)) ??
      voices.find((voice) => voice.lang.startsWith('en-US')) ??
      voices.find((voice) => voice.lang.startsWith('en')) ??
      null;
    utterance.onend = options.onEnd;
    utterance.onerror = options.onError;
    window.speechSynthesis.speak(utterance);
  }

  pause() {
    window.speechSynthesis?.pause();
  }
  resume() {
    window.speechSynthesis?.resume();
  }
  cancel() {
    window.speechSynthesis?.cancel();
  }
}

export class CachedAudioThreeOutProvider implements ThreeOutTtsProvider {
  private audio: HTMLAudioElement | null = null;
  get available() {
    return typeof Audio !== 'undefined';
  }
  speak(source: ThreeOutSpeechSource, options: SpeakOptions) {
    if (!this.available || !source.audioUrl) return options.onError();
    this.cancel();
    const audio = new Audio(source.audioUrl);
    audio.onended = options.onEnd;
    audio.onerror = options.onError;
    const syncActiveSection = () => {
      if (!options.onProgressIndex || source.sectionStartTimes?.length !== 3) return;
      options.onProgressIndex(
        getActiveThreeOutSection(audio.currentTime, source.sectionStartTimes) as 0 | 1 | 2,
      );
    };
    audio.ontimeupdate = syncActiveSection;
    audio.onseeking = syncActiveSection;
    audio.onseeked = syncActiveSection;
    audio.onplay = syncActiveSection;
    audio.onloadedmetadata = syncActiveSection;
    this.audio = audio;
    syncActiveSection();
    void audio.play().catch(options.onError);
  }
  pause() {
    this.audio?.pause();
  }
  resume() {
    void this.audio?.play();
  }
  cancel() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio = null;
  }
}
