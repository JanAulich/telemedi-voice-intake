import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
import { Button, Card, DemoBadge, ErrorText, Field, H2, Page } from '../components/Primitives';
import { MicButton, RecordingTimer } from '../components/MicButton';
import { TurnEditor } from '../components/TurnEditor';
import { space, TAP, type, useTheme } from '../theme';
import type { Palette } from '../theme';

/** Mirrors MAX_AUDIO_MS in engine/core/limits.ts (the engine rejects longer takes). Display only. */
const MAX_TAKE_S = 60;

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

type Phase = 'idle' | 'preparing' | 'recording' | 'processing';

/** Recording already runs during "Get ready…", so the first word is never cut off. */
const GET_READY_MS = 700;
/** Keep recording briefly after "stop" so the last syllable is not clipped. */
const TAIL_MS = 400;
/** Very short takes are padded to this length; Whisper struggles with clips under ~1 s. */
const MIN_TAKE_MS = 1200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const errorCode = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;

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
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const mounted = useRef(true);
  const recording = useRef(false);
  const startedAt = useRef(0);

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
      setPhase('preparing');
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      startedAt.current = Date.now();
      // Give the microphone a moment to warm up before telling the patient to speak.
      await sleep(GET_READY_MS);
      if (mounted.current && recording.current) setPhase('recording');
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
      const elapsed = Date.now() - startedAt.current;
      await sleep(Math.max(TAIL_MS, MIN_TAKE_MS - elapsed));
      await recorder.stop();
      uri = recorder.uri;
      if (!uri) throw new Error('no audio');
      const mimeType = await detectMimeType(uri);
      await onAudio({ uri, mimeType, durationMs: Date.now() - startedAt.current } as AudioInput);
    } catch (e) {
      if (uri) await discardAudio(uri); // safe if the engine already deleted it
      // Only the error code is used; engine messages are never shown.
      if (mounted.current) setError(errorCode(e) === 'empty_transcript' ? t.notHeard : t.genericError);
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

  const micLabel =
    phase === 'recording'
      ? t.tapToStop
      : phase === 'preparing'
        ? t.getReady
        : phase === 'processing'
          ? t.processing
          : t.tapToSpeak;
  const done = question === null;

  return (
    <Page>
      <View style={styles.topRow}>
        <View style={styles.progressBlock}>
          <Text style={styles.progressText}>{t.progress(Math.min(answered + 1, total), total)}</Text>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: answered }}
          >
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.tick, i < answered && styles.tickDone]} />
            ))}
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
          <MicButton
            phase={phase}
            accessibilityLabel={micLabel}
            accessibilityState={{
              disabled: phase === 'processing' || phase === 'preparing',
              busy: phase === 'processing' || phase === 'preparing',
            }}
            disabled={phase === 'processing' || phase === 'preparing'}
            onPress={onMic}
          />
          <Text style={styles.micLabel} accessibilityLiveRegion="polite">
            {phase === 'recording' ? t.recording : micLabel}
          </Text>
          {phase === 'recording' ? <Text style={styles.small}>{t.tapToStop}</Text> : null}
          <RecordingTimer active={phase === 'recording'} maxSeconds={MAX_TAKE_S} />
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {!done && phase !== 'recording' && phase !== 'preparing' ? (
        typing ? (
          <Card>
            <Field
              accessibilityLabel={t.typePlaceholder}
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder={t.typePlaceholder}
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
    progressBlock: { flexGrow: 1, flexBasis: 140, gap: space.sm },
    progressText: { ...type.caption, fontWeight: '700', color: c.accentInk },
    track: { flexDirection: 'row', gap: 4 },
    tick: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.fieldBorder },
    tickDone: { backgroundColor: c.accent, borderColor: c.accent },
    question: { ...type.question, color: c.ink, paddingTop: space.sm },
    micWrap: { alignItems: 'center', gap: space.xs, paddingBottom: space.sm },
    micLabel: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: c.ink, textAlign: 'center' },
    small: { ...type.body, color: c.muted, textAlign: 'center' },
    input: { minHeight: TAP * 2, paddingTop: space.md },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
    cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  });
}
