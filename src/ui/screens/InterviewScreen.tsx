import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import type { AudioInput, PatientLanguage, Question, Turn } from '../../contract/types';
import { detectMimeType, discardAudio, webRecordingMimeType } from '../audioFiles';
import { PATIENT } from '../i18n';
import { Button, Card, DemoBadge, ErrorText, H2, Page } from '../components/Primitives';
import { TurnEditor } from '../components/TurnEditor';
import { colors, radius, space, TAP } from '../theme';

// 16 kHz mono at ~32 kbps keeps uploads small; AAC/m4a on iOS and Android, webm or mp4 on web.
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { ...RecordingPresets.HIGH_QUALITY.android, sampleRate: 16000 },
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, sampleRate: 16000 },
  web: { mimeType: Platform.OS === 'web' ? webRecordingMimeType() : 'audio/webm', bitsPerSecond: 32000 },
};

type Phase = 'idle' | 'recording' | 'processing';

export function InterviewScreen({
  lang,
  demo,
  question,
  turns,
  total,
  onAudio,
  onText,
  onEdit,
  onFinish,
}: {
  lang: PatientLanguage;
  demo: boolean;
  question: Question | null;
  turns: Turn[];
  total: number;
  onAudio: (audio: AudioInput) => Promise<void>;
  onText: (text: string) => Promise<void>;
  onEdit: (turnId: string, text: string) => void;
  onFinish: () => Promise<void>;
}) {
  const t = PATIENT[lang];
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const mounted = useRef(true);
  const recording = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Abandon any recording that is still running (e.g. the session was wiped).
      if (recording.current) {
        recording.current = false;
        recorder
          .stop()
          .then(() => discardAudio(recorder.uri))
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const earlier = turns.slice(0, -1);
  const answered = turns.length;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setPhase('processing');
    try {
      await fn();
    } catch {
      // Engine errors may contain transcript text, so show a generic message only.
      if (mounted.current) setError(t.genericError);
    } finally {
      if (mounted.current) setPhase('idle');
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError(t.micDenied);
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      // Prepare before every take: on web stop() discards the underlying MediaRecorder.
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      setPhase('recording');
    } catch {
      setError(t.micDenied);
      setPhase('idle');
    }
  };

  const stopRecording = async () => {
    recording.current = false;
    setPhase('processing');
    setError(null);
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      if (!uri) throw new Error('no audio');
      const mimeType = await detectMimeType(uri);
      await onAudio({ uri, mimeType });
    } catch {
      if (uri) await discardAudio(uri); // safe if the engine already deleted it
      if (mounted.current) setError(t.genericError);
    } finally {
      if (mounted.current) setPhase('idle');
    }
  };

  const onMic = () => {
    if (phase === 'idle') void startRecording();
    else if (phase === 'recording') void stopRecording();
  };

  const sendTyped = () => {
    const text = typed.trim();
    if (!text) return;
    void run(async () => {
      await onText(text);
      if (mounted.current) {
        setTyped('');
        setTyping(false);
      }
    });
  };

  const micLabel = phase === 'recording' ? t.tapToStop : phase === 'processing' ? t.processing : t.tapToSpeak;
  const done = question === null;

  return (
    <Page>
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={styles.progressText}>{t.progress(Math.min(answered + 1, total), total)}</Text>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: answered }}
          >
            <View style={[styles.fill, { width: `${Math.min(100, (answered / total) * 100)}%` }]} />
          </View>
        </View>
        {demo ? <DemoBadge /> : null}
      </View>

      {done ? (
        <Card>
          <H2>{t.allDone}</H2>
        </Card>
      ) : (
        <Text accessibilityRole="header" style={styles.question}>
          {question.text}
        </Text>
      )}

      {!done ? (
        <View style={styles.micWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={micLabel}
            accessibilityState={{ disabled: phase === 'processing', busy: phase === 'processing' }}
            disabled={phase === 'processing'}
            onPress={onMic}
            style={({ pressed }) => [
              styles.mic,
              phase === 'recording' && { backgroundColor: colors.danger },
              phase === 'processing' && { backgroundColor: colors.muted },
              pressed && { opacity: 0.85 },
            ]}
          >
            {phase === 'processing' ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : phase === 'recording' ? (
              <View style={styles.stopSquare} />
            ) : (
              <MicGlyph />
            )}
          </Pressable>
          <Text style={styles.micLabel} accessibilityLiveRegion="polite">
            {phase === 'recording' ? t.recording : micLabel}
          </Text>
          {phase === 'recording' ? <Text style={styles.small}>{t.tapToStop}</Text> : null}
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {!done && phase !== 'recording' ? (
        typing ? (
          <Card>
            <TextInput
              accessibilityLabel={t.typePlaceholder}
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder={t.typePlaceholder}
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              editable={phase === 'idle'}
            />
            <View style={styles.actions}>
              <Button label={t.send} onPress={sendTyped} disabled={!typed.trim() || phase !== 'idle'} style={{ flexGrow: 1 }} />
              <Button label={t.cancel} variant="ghost" onPress={() => setTyping(false)} />
            </View>
          </Card>
        ) : (
          <Button label={t.typeInstead} variant="secondary" onPress={() => setTyping(true)} disabled={phase !== 'idle'} />
        )
      ) : null}

      {lastTurn ? (
        <Card>
          <View style={styles.cardHead}>
            <H2>{t.yourAnswer}</H2>
            <Text style={styles.small}>{t.latency(lastTurn.latencyMs)}</Text>
          </View>
          <TurnEditor turn={lastTurn} strings={t} open onSave={onEdit} />
        </Card>
      ) : null}

      {done ? (
        <Button label={t.createSummary} loading={phase === 'processing'} onPress={() => void run(onFinish)} />
      ) : null}

      {earlier.length > 0 ? (
        <Card>
          <H2>{t.earlierAnswers}</H2>
          {earlier.map((turn) => (
            <TurnEditor key={turn.id} turn={turn} strings={t} onSave={onEdit} />
          ))}
        </Card>
      ) : null}
    </Page>
  );
}

/** Simple microphone drawn with views so no icon package is needed. */
function MicGlyph() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.micBody} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  progressText: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.primary },
  question: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: colors.ink, paddingVertical: space.md },
  micWrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  mic: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLabel: { fontSize: 18, fontWeight: '700', color: colors.ink },
  small: { fontSize: 14, color: colors.muted },
  stopSquare: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#FFFFFF' },
  micBody: { width: 28, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF' },
  micArc: {
    width: 48,
    height: 24,
    marginTop: -14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 4,
    borderTopWidth: 0,
    borderColor: '#FFFFFF',
  },
  micStem: { width: 4, height: 10, backgroundColor: '#FFFFFF' },
  input: {
    minHeight: TAP * 2,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  actions: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
});
