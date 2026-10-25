// App entry point: core engine wired to platform audio upload/deletion and the key store.
import type { CreateIntakeEngine } from '../contract/types';
import { createCoreEngine } from './core';
import { discardAudio, transcribeAudio } from './platform/audio';

export const createIntakeEngine: CreateIntakeEngine = (config) =>
  createCoreEngine(config, transcribeAudio, { discardAudio });

export { keyStore } from './platform/keyStore';
