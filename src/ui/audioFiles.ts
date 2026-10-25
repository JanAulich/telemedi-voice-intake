import { Platform } from 'react-native';

/** Best-effort deletion of a recording. Used for the mock engine and for recordings the UI abandons. */
export async function discardAudio(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(uri);
    } else {
      const { File } = await import('expo-file-system');
      const file = new File(uri);
      if (file.exists) file.delete();
    }
  } catch {
    // Never surface paths or content.
  }
}

/** MIME type to report to the engine so it can name the upload correctly. */
export async function detectMimeType(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return 'audio/m4a';
  try {
    const blob = await (await fetch(uri)).blob();
    const base = blob.type.split(';')[0].trim();
    if (base) return base;
  } catch {
    // fall through
  }
  return webRecordingMimeType();
}

/** Preferred MediaRecorder type: webm/opus where supported (Chrome, Firefox), mp4 otherwise (Safari). */
export function webRecordingMimeType(): string {
  try {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  } catch {
    // ignore
  }
  return 'audio/mp4';
}
