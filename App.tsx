import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type {
  AudioInput,
  IntakeEngine,
  IntakeRecord,
  Question,
  RedFlagHit,
  Turn,
  TurnResult,
} from './src/contract/types';
import { createDemoEngine, createIntakeEngine, engineIsReal } from './src/ui/engineSource';
import { DoctorCardScreen } from './src/ui/screens/DoctorCardScreen';
import { EscalationScreen } from './src/ui/screens/EscalationScreen';
import { InterviewScreen } from './src/ui/screens/InterviewScreen';
import { KeysScreen } from './src/ui/screens/KeysScreen';
import { SetupScreen, type SetupResult } from './src/ui/screens/SetupScreen';
import { colors } from './src/ui/theme';

type Screen = 'keys' | 'setup' | 'interview' | 'escalation' | 'card';

const TOTAL_QUESTIONS = 8;
const BACKGROUND_WIPE_MS = 2 * 60 * 1000;

export default function App() {
  const [screen, setScreen] = useState<Screen>('keys');
  const [groqKey, setGroqKey] = useState('');
  const [setup, setSetup] = useState<SetupResult>({ patientLanguage: 'pl', doctorLanguage: 'en' });
  const [question, setQuestion] = useState<Question | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [hits, setHits] = useState<RedFlagHit[]>([]);
  const [record, setRecord] = useState<IntakeRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Patient data lives only in React state and in the engine instance.
  const engineRef = useRef<IntakeEngine | null>(null);
  const sessionRef = useRef(0);
  const screenRef = useRef<Screen>('keys');
  screenRef.current = screen;

  const demo = !engineIsReal || groqKey.trim().length === 0;

  /** Disposes the engine and clears every piece of patient state. */
  const wipe = useCallback((message: string | null = null) => {
    sessionRef.current += 1; // late results from the old session are dropped
    engineRef.current?.dispose();
    engineRef.current = null;
    setQuestion(null);
    setTurns([]);
    setHits([]);
    setRecord(null);
    setNotice(message);
  }, []);

  // Wipe after 2 minutes in the background. The timestamp check covers native timers that freeze in background.
  useEffect(() => {
    let backgroundedAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hasSession = () => screenRef.current !== 'keys' && screenRef.current !== 'setup';
    const expire = () => {
      if (hasSession()) {
        wipe('The session was cleared because the app was in the background for more than 2 minutes.');
        setScreen('setup');
      }
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (timer) clearTimeout(timer);
        timer = null;
        if (backgroundedAt !== null && Date.now() - backgroundedAt > BACKGROUND_WIPE_MS) expire();
        backgroundedAt = null;
      } else if (backgroundedAt === null) {
        backgroundedAt = Date.now();
        timer = setTimeout(expire, BACKGROUND_WIPE_MS + 500);
      }
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [wipe]);

  // Dispose on unmount.
  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const startInterview = (r: SetupResult) => {
    wipe();
    setSetup(r);
    const key = groqKey.trim();
    const create = demo ? createDemoEngine : createIntakeEngine;
    const engine = create({
      patientLanguage: r.patientLanguage,
      doctorLanguage: r.doctorLanguage,
      apiKeys: key ? { groq: key } : {},
    });
    engineRef.current = engine;
    setQuestion(engine.start());
    setScreen('interview');
  };

  const handleResult = (sid: number, result: TurnResult) => {
    if (sid !== sessionRef.current) return; // session was wiped while the engine was working
    setTurns((prev) => [...prev, result.turn]);
    setQuestion(result.next);
    if (result.redFlag) {
      const hit = result.redFlag;
      setHits((prev) => [...prev, hit]);
      setScreen('escalation');
    }
  };

  const submitAudio = async (audio: AudioInput) => {
    const engine = engineRef.current;
    if (!engine) return;
    const sid = sessionRef.current;
    handleResult(sid, await engine.submitAudio(audio));
  };

  const submitText = async (text: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const sid = sessionRef.current;
    handleResult(sid, await engine.submitText(text));
  };

  const editTurn = (turnId: string, text: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const hit = engine.editTurn(turnId, text);
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answerText: text } : t)));
    if (hit) {
      setHits((prev) => [...prev, hit]);
      setScreen('escalation');
    }
  };

  const finish = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const sid = sessionRef.current;
    const result = await engine.finish();
    if (sid !== sessionRef.current) return;
    setRecord(result);
    setScreen('card');
  };

  const endSession = () => {
    wipe();
    setScreen('setup');
  };

  let body: ReactNode = null;
  switch (screen) {
    case 'keys':
      body = (
        <KeysScreen
          onContinue={(r) => {
            setGroqKey(r.groqKey);
            setScreen('setup');
          }}
        />
      );
      break;
    case 'setup':
      body = (
        <SetupScreen
          demo={demo}
          notice={notice}
          initial={setup}
          onStart={startInterview}
          onBack={() => setScreen('keys')}
        />
      );
      break;
    case 'interview':
      body = (
        <InterviewScreen
          lang={setup.patientLanguage}
          demo={demo}
          question={question}
          turns={turns}
          total={TOTAL_QUESTIONS}
          onAudio={submitAudio}
          onText={submitText}
          onEdit={editTurn}
          onFinish={finish}
        />
      );
      break;
    case 'escalation':
      body = <EscalationScreen lang={setup.patientLanguage} hits={hits} onContinue={() => setScreen('interview')} />;
      break;
    case 'card':
      body = record ? <DoctorCardScreen record={record} demo={demo} onWipe={endSession} /> : null;
      break;
  }

  return (
    <View style={[styles.root, screen === 'escalation' && { backgroundColor: colors.danger }]}>
      <StatusBar style={screen === 'escalation' ? 'light' : 'dark'} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.select({ ios: 44, android: RNStatusBar.currentHeight ?? 24, default: 0 }),
  },
});
