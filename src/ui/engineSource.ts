// Single switch point between the offline demo engine and the real engine.
// createDemoEngine is used whenever no Groq key was entered. Everything in src/ui reads engines only here.
import { createMockEngine } from '../contract/mockEngine';
import type { AudioInput, CreateIntakeEngine } from '../contract/types';
import { discardAudio } from './audioFiles';

export const engineIsReal = true;

/** Mock engine that also honours the "audio is deleted after transcription" rule. */
export const createDemoEngine: CreateIntakeEngine = (config) => {
  const inner = createMockEngine(config);
  return {
    ...inner,
    async submitAudio(audio: AudioInput) {
      try {
        return await inner.submitAudio(audio);
      } finally {
        await discardAudio(audio.uri);
      }
    },
  };
};

export { createIntakeEngine, keyStore } from '../engine';
