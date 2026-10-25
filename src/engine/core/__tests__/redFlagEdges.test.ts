// Safety edge cases: uncertainty must never be read as a denial; plain denials must stay quiet.
import { expect, test } from 'vitest';
import { checkRedFlags } from '../redFlags';

const mustFire = [
  "I'm not sure, maybe chest pain",
  'not sure maybe chest pain',
  'nie wiem, chyba ból w klatce',
  'nie jestem pewien ale chyba duszności',
  'не знаю, може біль у грудях',
  'I have chest pain, no fever',
  'ból w klatce, nie mam gorączki',
  'I passed out this morning',
  "I've been thinking about ending my life",
  'zemdlałem rano',
];
const mustStayQuiet = ['No chest pain at all', 'Болю в грудях немає', "I haven't fainted", 'nie zemdlałem'];

test.each(mustFire)('fires: %s', (t) => expect(checkRedFlags(t, 't1')).not.toBeNull());
test.each(mustStayQuiet)('quiet: %s', (t) => expect(checkRedFlags(t, 't1')).toBeNull());
