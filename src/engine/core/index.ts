// Node-safe entry point (no expo / react-native imports). Used by eval and by src/engine/index.ts.
export { createCoreEngine } from './session';
export type { CoreDeps, CoreEngine, EngineUsage, TimedAudioInput, TranscribeContext, TranscribeFn } from './session';
export { checkRedFlags, findRedFlags } from './redFlags';
export { verifyQuotes } from './verifyQuotes';
export { buildFhir } from './fhir';
export { IntakeError, isIntakeError } from './errors';
export { STT_MODEL, SUMMARY_MODEL } from './groq';
export * from './limits';
