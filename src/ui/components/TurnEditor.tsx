import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Turn } from '../../contract/types';
import type { PatientStrings } from '../i18n';
import { Button } from './Primitives';
import { colors, radius, space, TAP } from '../theme';

/**
 * Shows one transcribed answer. In `open` mode the text is always editable;
 * otherwise it is a compact row with an Edit button.
 */
export function TurnEditor({
  turn,
  strings,
  open,
  onSave,
}: {
  turn: Turn;
  strings: PatientStrings;
  open?: boolean;
  onSave: (turnId: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(!!open);
  const [draft, setDraft] = useState(turn.answerText);

  // Keep the draft in sync when the engine's text changes (e.g. a new turn replaces the latest one).
  useEffect(() => {
    setDraft(turn.answerText);
  }, [turn.id, turn.answerText]);

  const dirty = draft.trim() !== turn.answerText.trim() && draft.trim().length > 0;
  const isEditing = open || editing;

  const save = () => {
    onSave(turn.id, draft.trim());
    if (!open) setEditing(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>{turn.questionText}</Text>
      {isEditing ? (
        <>
          <TextInput
            accessibilityLabel={strings.yourAnswer}
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <Button
              label={strings.saveCorrection}
              variant="secondary"
              disabled={!dirty}
              onPress={save}
              style={{ flexGrow: 1 }}
            />
            {!open ? (
              <Button
                label={strings.cancel}
                variant="ghost"
                onPress={() => {
                  setDraft(turn.answerText);
                  setEditing(false);
                }}
              />
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <Text style={styles.answer}>{turn.answerText}</Text>
          <Button label={strings.edit} variant="ghost" onPress={() => setEditing(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  question: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  answer: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
});
