// Platform half of transcription: turns an AudioInput into an upload and ALWAYS deletes the
// recording afterwards, on success and on failure.
import { Platform } from 'react-native';
import type { AudioInput } from '../../contract/types';
import { transcribe, extensionForMime } from '../core/groq';
import { MAX_AUDIO_BYTES } from '../core/limits';
import { IntakeError } from '../core/errors';
import type { TranscribeFn } from '../core/session';

/** Deletes a recording without uploading it. Never throws, never reveals the path. */
export async function discardAudio(audio: AudioInput): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(audio.uri);
    } else {
      const { File } = await import('expo-file-system');
      const file = new File(audio.uri);
      if (file.exists) file.delete();
    }
  } catch {
    /* best effort */
  }
}

export const transcribeAudio: TranscribeFn = async (audio, ctx) => {
  try {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(audio.uri)).blob();
      if (blob.size > MAX_AUDIO_BYTES) throw new IntakeError('audio_too_long');
      const typed = blob.type ? blob : new Blob([blob], { type: audio.mimeType });
      return await transcribe(typed, ctx.apiKey, ctx.language, { signal: ctx.signal });
    }
    const form = new FormData();
    // React Native's FormData accepts a {uri, name, type} file part.
    form.append('file', {
      uri: audio.uri,
      name: `audio.${extensionForMime(audio.mimeType)}`,
      type: audio.mimeType,
    } as unknown as Blob);
    return await transcribe(form, ctx.apiKey, ctx.language, { signal: ctx.signal });
  } finally {
    await discardAudio(audio);
  }
};
