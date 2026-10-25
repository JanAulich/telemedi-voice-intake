// Deterministic red-flag rules (pl, en, uk). No model involved, runs on every answer and edit.
//
// Design:
// - Recall over precision, except for simple, local negation ("no chest pain").
// - Polish text is matched on a diacritic-folded copy of the same length, so typed text
//   without diacritics ("bol w klatce") also matches. `matched` is cut from the ORIGINAL text.
// - Regexes avoid lookbehind and \p{..} so they also run on older JS engines.
// - Negation uses short negator PHRASES right before the symptom (not a bare "nie"/"don't"),
//   because speech-to-text output often has no punctuation:
//   "nie wiem chyba dusznosci" must still fire.

import type { RedFlagHit, RedFlagId } from '../../contract/types';

const L = 'A-Za-z\\u00C0-\\u024F\\u0400-\\u052F'; // letters (Latin incl. diacritics, Cyrillic)
const LD = `${L}0-9`;

/** Tiny DSL: ' ' -> \s+, '~' -> letters*, "'" -> optional apostrophe, '<a,b>' -> up to b filler words. */
function dsl(src: string): string {
  return src
    .replace(/<(\d+),(\d+)>/g, (_m, a: string, b: string) => `(?:[${L}]+\\s+){${a},${b}}?`)
    .replace(/ \?/g, '\\s*')
    .replace(/ /g, '\\s+')
    .replace(/~/g, `[${L}]*`)
    .replace(/'/g, "['’ʼ]?");
}

function compile(src: string): RegExp {
  // group 1 = boundary char before the match, lookahead = boundary after
  return new RegExp(`(^|[^${LD}])(${dsl(src)})(?![${LD}])`, 'gi');
}

const PL_FOLD: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};

/** Same length as the NFC input; Polish diacritics replaced by ASCII. */
function fold(text: string): string {
  let out = '';
  for (const ch of text) out += PL_FOLD[ch] ?? ch;
  return out;
}

interface Rule {
  id: RedFlagId;
  /** Diagnosis-type terms ("heart attack", "stroke") are ignored when clearly historical. */
  diag?: boolean;
  /** Patterns, Polish ones written without diacritics. */
  pats: string[];
}

const RULES: Rule[] = [
  {
    id: 'chest_pain',
    pats: [
      // en
      `(?:chest|sternum|breastbone) <0,2>(?:pain~|hurt~|ache|aches|aching|pressure|tight~|discomfort|squeez~|crush~|burning|stabbing|heaviness)`,
      `(?:pain~|pressure|tightness|discomfort|ache|squeezing|crushing|burning|heaviness) <0,3>(?:chest|sternum|breastbone)`,
      `tight~ <0,1>chest`,
      `pain <0,3>(?:radiat~|spread~|shoot~|going) (?:to|into|down) <0,2>(?:arm|jaw|shoulder)`,
      `angina`,
      // pl (folded)
      `(?:bol|bole|bolu|bolem|bolach|boli|bola|bolesc~|ucisk~|sciska~|piecze~|kluje~|kluci~|dlawi~|pali|rwie|dusi|rozpiera~) <0,4>(?:klatc~|klatk~|piersi~|mostk~)`,
      `(?:klatk~|klatc~|piersi~|mostk~) (?:piersiow~ )?<0,2>(?:boli|bola|sciska|piecze|dusi|kluje|pali|bol~|ucisk~)`,
      `(?:bol|boli|bola|bolu|sciska~|kluje~|piecze~|ucisk~) <0,1>(?:serc~)`,
      `serce <0,1>(?:boli|bola|sciska|kluje|piecze)`,
      `za mostkiem`,
      `dusznica bolesna`,
      // uk
      `(?:біль|болі|болю|болить|болять|боліло|тисне|тиснуть|давить|пече|коле|стискає|тиск|печіння) <0,4>(?:груд~|грудин~|серц~|серці)`,
      `(?:груд~|грудин~) <0,2>(?:болять|болить|стискає|тисне|давить|печуть|пече|коле)`,
      `за грудиною`,
      `стенокардія`,
    ],
  },
  {
    id: 'chest_pain',
    diag: true,
    pats: [
      `heart attack|myocardial infarction`,
      `zawal~`,
      `інфаркт~`,
    ],
  },
  {
    id: 'breathing_difficulty',
    pats: [
      // en
      `short(?:ness)? of breath`,
      `can'?t breathe`,
      `can'?t <0,1>breath~`,
      `can'?t catch <0,1>breath`,
      `cannot breathe`,
      `can not breathe`,
      `unable to breathe`,
      `(?:difficult~|trouble|hard|struggl~|problems?|labou?red) <0,2>breath~`,
      `breath~ (?:is |are )?(?:difficult|hard|laboured|labored|short)`,
      `gasping`,
      `choking`,
      `suffocat~`,
      `out of breath`,
      `wheez~`,
      `stopped breathing`,
      `not breathing`,
      // pl (folded)
      `dusznos~`,
      `dusze sie`,
      `dusi mnie`,
      `dlawie sie`,
      `nie moge <0,1>(?:odd~|zlapac|nabrac)`,
      `(?:brak|braku|brakuje) <0,2>(?:tchu|powietrza|oddechu)`,
      `(?:trudn~|ciezk~|problem~|utrudnion~) <0,3>(?:oddech~|oddycha~|oddychan~)`,
      `(?:trudno|ciezko) <0,3>oddychac`,
      `zadyszk~`,
      `krotk~ oddech~`,
      `swiszcz~`,
      `charcz~`,
      `przestal(?:a|em|am)? oddychac`,
      // uk
      `задих~`,
      `задуш~`,
      `задишк~`,
      `ядух~`,
      `не можу <0,1>(?:дихати|вдихнути|видихнути|віддихатись|відсапатись)`,
      `(?:важко|тяжко|тяжке|важке|утруднене) <0,2>(?:дихати|дихання|дихаю|вдихати)`,
      `утруднен~ диханн~`,
      `(?:нестача|не вистачає|бракує|брак) <0,1>(?:повітря|подиху)`,
      `перехоплює дих~`,
      `свистить в грудях`,
    ],
  },
  {
    id: 'stroke_signs',
    pats: [
      // en
      `face <0,2>(?:drooping|droopy|drooped|dropping|drooping|numb|crooked|lopsided)`,
      `(?:facial|face|mouth) droop~`,
      `droop~ <0,1>(?:face|mouth|lip|smile)`,
      `slurr~ <0,1>(?:speech|words|talk~)`,
      `speech <0,2>(?:slurred|garbled|jumbled)`,
      `can'?t (?:speak|talk|find (?:the )?words)`,
      `cannot (?:speak|talk)`,
      `(?:trouble|difficult~|hard|problems?) <0,2>(?:speaking|talking|finding words|understanding)`,
      `(?:arm|leg|hand|side|face|body) <0,3>(?:numb~|weak~|paraly~|limp|dead|tingling)`,
      `(?:numb~|weak~|paraly~|tingling) <0,3>(?:on |in )?(?:one|the left|the right|my left|my right|left|right) (?:side|arm|leg|hand|face)`,
      `(?:can'?t|cannot|unable to) (?:move|lift|raise|feel) <0,2>(?:arm|leg|hand|side|face|fingers)`,
      `paraly~`,
      `(?:sudden|suddenly) <0,3>(?:vision loss|loss of vision|blind~|double vision|confus~|weak~|numb~|trouble seeing)`,
      `double vision`,
      // pl (folded)
      `opad~ <0,2>(?:kacik|twarz|powiek|usta|warga)`,
      `opadni(?:e|ec)t~`,
      `twarz <0,2>(?:opada|dretwieje|krzywi|przekrzywi~|zdretwi~)`,
      `krzyw~ <0,1>(?:twarz|usta|usmiech)`,
      `skrzywion~`,
      `belkot~`,
      `niewyrazn~ mow~`,
      `zaburzen~ mow~`,
      `placze (?:mi )?(?:sie )?jezyk`,
      `mow~ <0,2>(?:placze|zanika|nieskladna|niewyrazna)`,
      `nie moge <0,1>(?:mowic|wypowiedziec|poruszyc|podniesc|ruszyc|ruszac|unies~)`,
      `trudn~ <0,2>(?:mowi|wypowiad)~`,
      `dretw~ <0,3>(?:rek|nog|twarz|polow|stron|ciala)~`,
      `(?:rek|nog|twarz|dlon|strona|polowa)~ <0,2>(?:dretw~|zdretwi~|sztywni~|oslab~|nie slucha~)`,
      `oslabi~ <0,3>(?:rek|nog|polow|stron)~`,
      `niedowlad~`,
      `paraliz~`,
      `polow(?:a|y|e|ie) (?:ciala|twarzy)`,
      `jedn~ stron~ (?:ciala|twarzy)`,
      `nagl~ <0,3>(?:oslabi|dretw|zaburzen|utrat~ wzrok|slepota|zaslab)~`,
      `widze podwojnie`,
      `podwojne widzenie`,
      // uk
      `обличчя <0,2>(?:перекосило|німіє|обвисло|кривиться|оніміло|перекосилось)`,
      `перекосил~ <0,2>(?:обличчя|рот|лице|губу)`,
      `(?:рот|губа|куточок) <0,2>(?:опустився|опустилась|обвис~|перекосило)`,
      `німі~ <0,3>(?:рук|ніг|обличч|половин|сторон|тіл)~`,
      `(?:рук|ніг|обличч|половин|сторон)~ <0,2>(?:німі~|заніміл~|оніміл~|слабк~|слабн~|не слухається|не слухаються)`,
      `заплітається язик`,
      `мова <0,2>(?:заплітається|нечітка|невиразна|порушилась)`,
      `(?:нечітк|невиразн|порушен)~ мов~`,
      `не можу <0,1>(?:говорити|вимовити|поворушити|підняти|рухати|ворушити|ворухнути)`,
      `(?:важко|тяжко) <0,1>(?:говорити|вимовляти|розмовляти)`,
      `параліч~`,
      `слабкість <0,3>(?:в |у )?(?:руці|нозі|половин~|сторон~|тіл~)`,
      `оніміння`,
      `раптов~ <0,3>(?:слабк|оніміння|втрат~ зору|сліпот|заніміл|нечітк)~`,
      `двоїться в очах`,
      `подвійний зір`,
    ],
  },
  {
    id: 'stroke_signs',
    diag: true,
    pats: [`stroke`, `udar~`, `інсульт~`],
  },
  {
    id: 'suicidal_ideation',
    pats: [
      // en
      `(?:kill|hurt|harm|injure|end|cut) my ?self`,
      `kill(?:ing)? myself`,
      `commit~ suicide`,
      `suicid~`,
      `self[- ]?harm~`,
      `want(?:ing)? to (?:die|be dead|disappear|end it)`,
      `wish (?:i |that i )?(?:was|were) dead`,
      `wish (?:i |that i )?(?:would|could) (?:just )?(?:die|disappear|not wake up)`,
      `end(?:ing)? (?:it all|my life|my own life|things)`,
      `(?:think~|thought~) (?:about|of) (?:dying|death|killing myself|ending (?:it|my life)|suicide)`,
      `take my (?:own )?life`,
      `(?:don'?t|do not) want to (?:live|be alive|be here|go on|wake up|exist)`,
      `(?:no|not any) (?:reason|point) (?:to|in) (?:live|living|go on|going on)`,
      `not worth living`,
      `life (?:is )?not worth`,
      `better off (?:dead|without me)`,
      `thoughts of (?:dying|death|killing)`,
      `overdos~`,
      // pl (folded)
      `samobojs~`,
      `samobojcz~`,
      `popelni~ samobojstw~`,
      `chce (?:sie )?(?:zabic|umrzec|zginac|skonczyc z (?:soba|zyciem|tym))`,
      `zabi~ sie`,
      `odebrac sobie zycie`,
      `targnac sie na (?:swoje )?zycie`,
      `nie chce (?:juz )?zyc`,
      `nie widze (?:sensu|powodu) (?:zyc|zycia|dalej)`,
      `mysl~ (?:o )?(?:smierci|samobojcz~|zabiciu)`,
      `skrzywdzic sie`,
      `okaleczac sie`,
      `samookalecz~`,
      `lepiej (?:by )?(?:bylo )?(?:gdyby )?mnie nie bylo`,
      `wolal(?:bym|abym) nie zyc`,
      `zycie nie ma sensu`,
      `nie warto zyc`,
      // uk
      `самогубств~`,
      `суїцид~`,
      `самоушкодж~`,
      `хочу (?:себе )?(?:вбити|померти|вмерти|зникнути)`,
      `хочу накласти на себе руки`,
      `вбити себе`,
      `накласти на себе руки`,
      `не хочу (?:більше |вже )?жити`,
      `не бачу сенсу (?:жити|життя|далі)`,
      `позбавити себе життя`,
      `покінчити (?:з собою|із собою|з життям|із життям)`,
      `думк~ (?:про )?(?:смерть|самогубств~|вбивств~ себе)`,
      `завдати собі (?:шкоди|болю)`,
      `поранити себе`,
      `краще б мене не було`,
      `життя не має сенсу`,
      `не варто жити`,
    ],
  },
  {
    id: 'anaphylaxis',
    pats: [
      // en
      `anaphyla~`,
      `(?:throat|tongue|lips?|face|mouth|airway) <0,3>(?:swell~|swollen|closing|closes|tight~|puffy|puffing|clos~)`,
      `swell~ <0,2>(?:of )?<0,2>(?:throat|tongue|lips?|face|mouth)`,
      `throat <0,2>clos~`,
      `epi ?pen`,
      `epinephrine`,
      `adrenaline (?:pen|auto|injector|shot)`,
      `(?:can'?t|cannot|trouble|difficult~) swallow~ <0,3>(?:after|since)`,
      // pl (folded)
      `anafilaks~`,
      `obrzek~ <0,2>(?:gardla|jezyka|warg~|twarzy|krtani|ust)`,
      `(?:gardlo|jezyk|wargi|usta|twarz|krtan) <0,2>(?:puchn~|opuchl~|spuchl~|obrzek~|zaciska~|zamyka~|puchnie)`,
      `(?:puchn~|puchnie|opuchl~|spuchl~) <0,2>(?:gardlo|jezyk|warg~|twarz|usta|krtan)`,
      `adrenalin~`,
      `epipen`,
      `zaciska~ <0,1>(?:mi )?(?:sie )?gardl~`,
      // uk
      `анафілакс~`,
      `набряк~ <0,2>(?:горла|язика|губ|обличчя|гортані|губи)`,
      `(?:горло|язик|губи|губа|обличчя|гортань) <0,2>(?:набряк~|розпух~|пухне|пухнуть|опухл~|стискає|перекриває|стискається|напухл~)`,
      `пухн~ <0,2>(?:горло|язик|губи|обличчя)`,
      `епіпен`,
      `адреналін~`,
      `горло <0,2>стискається`,
    ],
  },
  {
    id: 'severe_bleeding',
    pats: [
      // en
      `bleed~ <0,3>(?:heav~|profus~|a lot|badly|uncontrol~|everywhere|severe~|massiv~|non ?stop)`,
      `bleed~ <0,3>(?:won'?t|will not|doesn'?t|does not|can'?t|cannot|not) (?:stop|stopping)`,
      `(?:heavy|severe|profuse|massive|uncontrolled|major|serious) <0,2>(?:bleeding|blood loss|hemorrhage|haemorrhage)`,
      `(?:a lot of|so much|lots of) blood`,
      `blood <0,2>(?:won'?t|will not|doesn'?t|does not|can'?t|cannot) stop`,
      `blood (?:is )?(?:pouring|gushing|spurting|streaming)`,
      `(?:losing|lost) (?:a lot of )?blood`,
      `soak~ <0,2>(?:through|with blood)`,
      `(?:vomit~|throwing up|threw up|puking) <0,2>blood`,
      `blood in (?:my )?(?:vomit|stool)`,
      `(?:cough~|spitting) <0,1>(?:up )?blood`,
      `black tarry`,
      `hemorrhag~`,
      `haemorrhag~`,
      // pl (folded)
      `krwawi~ <0,3>(?:obficie|mocno|silnie|bardzo|duzo|nie moze przestac|nie chce przestac|nie przestaje|nie ustaje)`,
      `krwotok~`,
      `(?:obfit~|silne|mocne|duze) krwawieni~`,
      `krwawieni~ <0,2>(?:nie ustaje|nie ustepuje|nie przestaje|nie mija|obfite|silne)`,
      `(?:duzo|mase|mnostwo|sporo|litry) krwi`,
      `krew <0,2>(?:leci|plynie|tryska|sie leje|nie przestaje|nie chce przestac|bucha)`,
      `wymiotuj~ <0,1>krwi~`,
      `wymioty z krwi~`,
      `wymioty (?:z )?krwi~`,
      `krwi~ wymiot~`,
      `odkrztusz~ <0,1>krew`,
      `(?:kaszl~|plu~) <0,1>krwi~`,
      `czarne stolce`,
      `smolist~`,
      `trac[eaiy]~ <0,1>(?:duzo )?krew`,
      `stracil(?:a|em|am)? duzo krwi`,
      // uk
      `кровотеч~`,
      `кровотеча`,
      `кровоточ~ <0,3>(?:сильно|не зупиня~|багато|рясно|не спиня~)`,
      `(?:багато|сильно|дуже багато) крові`,
      `кров <0,2>(?:тече|ллється|хлюпає|не зупиняється|не спиняється|юшить|б'?є)`,
      `блюю <0,1>кров~`,
      `блювот~ (?:з )?кров~`,
      `харкаю <0,1>кров~`,
      `кашляю <0,1>кров~`,
      `втрат~ <0,2>крові`,
      `втрачаю <0,2>кров~`,
      `чорний стілець`,
      `дьогтеподібн~`,
    ],
  },
  {
    id: 'loss_of_consciousness',
    pats: [
      // en
      `pass~ out`,
      `passed ?out`,
      `black~ ?out`,
      `faint(?:ed|ing)`,
      `fainting (?:spell|episode)`,
      `feel~ faint`,
      `lost consciousness`,
      `loss of consciousness`,
      `lose consciousness`,
      `unconscious`,
      `unresponsive`,
      `collapse~`,
      `seizure~`,
      `convuls~`,
      `fell unconscious`,
      `(?:woke|wake) up on the (?:floor|ground)`,
      `came to on`,
      `knocked out`,
      `(?:don'?t|do not|can'?t) remember (?:falling|what happened|the fall)`,
      // pl (folded)
      `zemdl~`,
      `omdl~`,
      `omdlen~`,
      `(?:stracil~|stracic|strace|utrata|utracil~|utrac~) <0,1>(?:przytomnosc~|swiadomosc~|przytomnosci|swiadomosci)`,
      `nieprzytomn~`,
      `zaslab~`,
      `drgawk~`,
      `konwulsj~`,
      `atak padaczk~`,
      `padaczk~`,
      `urwal (?:mi )?(?:sie )?film`,
      `urwany film`,
      `ciemno przed oczami`,
      `zrobilo mi sie ciemno`,
      `nie pamietam (?:jak|co) (?:upadl~|sie stalo|sie dzialo)`,
      `obudzil(?:em|am) sie na (?:podlodze|ziemi)`,
      `odplynal~`,
      // uk
      `знепритомн~`,
      `втрат~ <0,1>свідом~`,
      `втрата свідомості`,
      `непритомн~`,
      `зомліл~`,
      `зомлів~`,
      `упав~ <0,2>без свідомості`,
      `судом~`,
      `напад <0,1>епілепс~`,
      `епілептичн~ напад`,
      `гасне свідомість`,
      `потемніло в очах`,
      `темніє в очах`,
      `прийшов до тями`,
      `прийшла до тями`,
      `очуняв~`,
      `не пам'?ятаю як (?:впав~|упав~|це сталось)`,
    ],
  },
];

// Remove accidental empty patterns (kept simple for readability above).
const COMPILED = RULES.map((r) => ({
  id: r.id,
  diag: !!r.diag,
  regs: r.pats.filter(Boolean).map(compile),
}));

// --- negation / history helpers (all operate on the folded text) ---

const BREAK_RE = new RegExp(
  `[.!?;:,\\n]|(?:^|[^${LD}])(?:and|but|however|although|though|ale|lecz|jednak|oraz|i|та|і|й|а|але|проте)(?![${LD}])`,
  'gi',
);

/** Text of the current clause before position `end` (after the last break char/word). */
function clauseBefore(folded: string, end: number): string {
  const before = folded.slice(Math.max(0, end - 80), end);
  let cut = 0;
  BREAK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BREAK_RE.exec(before))) {
    cut = m.index + m[0].length;
    if (m[0].length === 0) BREAK_RE.lastIndex++;
  }
  return before.slice(cut);
}

const NEGATOR = [
  // pl (folded)
  'nie mam', 'nie ma', 'nie czuje', 'nie odczuwam', 'nie wystepuje', 'nie wystepuja', 'nie cierpie', 'nie mialem', 'nie mialam',
  'brak', 'braku', 'bez', 'ani', `zadn[${L}]*`, 'nigdy', 'wykluczam',
  // en
  'no', 'not', 'never', 'without', 'denies', 'denied', 'deny', 'negative for', 'free of',
  "(?:don'?t|do not|doesn'?t|does not|didn'?t|did not|haven'?t|have not|hasn'?t) (?:have|had|feel|get|experience)",
  // uk
  'не маю', 'не має', 'немає', 'нема', 'не відчуваю', 'не було', 'без', 'ніколи', `жодн[${L}]*`, 'ані', `відсутн[${L}]*`,
];
const NEG_BEFORE = new RegExp(
  `(?:^|[^${LD}])(?:${NEGATOR.map((n) => n.replace(/ /g, '\\s+')).join('|')})\\s+(?:[${L}']+\\s+){0,3}$`,
  'i',
);
/** A bare negated verb directly before the symptom: "nie zemdlałem", "I haven't fainted". No filler allowed. */
const NEG_IMMEDIATE = new RegExp(
  `(?:^|[^${LD}])(?:nie|не|haven'?t|hasn'?t|hadn'?t|didn'?t|wasn'?t|weren'?t|isn'?t|aren'?t|not|never|nigdy|ніколи)\\s+$`,
  'i',
);
/** Negation after the symptom, within the same clause: "болю в грудях немає", "duszności nie mam", "chest pain: no". */
const NEG_AFTER = new RegExp(
  `^\\s*(?:[:?\\-\\u2013\\u2014]\\s*(?:no|nie|ni|none|brak|нема|немає|ні)(?![${LD}])|(?:[${L}']+\\s+){0,3}?(?:немає|нема|не було|відсутн[${L}]*|nie mam|nie ma|nie bylo|brak)(?![${LD}]))`,
  'i',
);
/** "I'm not sure", "nie wiem", "не знаю": uncertainty, never a denial. Keeps "not sure, maybe chest pain" firing. */
const UNCERTAIN = new RegExp(
  `(?:^|[^${LD}])(?:sure|know|certain|wiem|pewn[${L}]*|pamietam|знаю|впевнен[${L}]*|пам'?ятаю)(?![${LD}])`,
  'i',
);
/** "no X or Y": treat list joiners as transparent so the negation reaches Y. */
const JOINER = new RegExp(`(?:^|\\s)(?:or|lub|albo|czy|або|чи)(?=\\s)`, 'gi');

/** Text after position `start`, up to the next clause break. */
function clauseAfter(folded: string, start: number): string {
  const after = folded.slice(start, start + 60);
  BREAK_RE.lastIndex = 0;
  const m = BREAK_RE.exec(after);
  return m ? after.slice(0, m.index) : after;
}
/** Matches that already contain a negation/inability ("can't breathe", "nie moge oddychac") are never suppressed. */
const SELF_NEG = new RegExp(
  `(?:^|[^${LD}])(?:nie|не|no|not|never|cannot|can'?t|won'?t|don'?t|doesn'?t|unable|without|bez|немає|нема|ні)(?![${LD}])`,
  'i',
);

const HIST_BEFORE = new RegExp(
  `(?:^|[^${LD}])(?:had|history|previous~|previously|past|father|mother|brother|sister|grand[a-z]*|family|mialem|mialam|mial|miala|przebyl[a-z]*|przebyt[a-z]*|historia|historii|w przeszlosci|ojciec|ojca|matka|matki|tata|mama|babcia|dziadek|brat|siostra|rodzin[a-z]*|мав|мала|мали|був|була|перенесен[${L}]*|переніс[${L}]*|анамнез[${L}]*|історі[${L}]*|батько|мати|мама|тато|бабус[${L}]*|дід[${L}]*|брат|сестра|родин[${L}]*)(?![${LD}])`.replace(/~/g, `[${L}]*`),
  'i',
);
const HIST_AFTER = new RegExp(
  `^\\s*(?:[${L}0-9]+\\s+){0,2}?(?:ago|temu|тому)(?![${LD}])|^\\s*(?:in|w|u|в|у)\\s+(?:19|20)\\d\\d`,
  'i',
);

/** All red-flag hits in `text`, at most one per RedFlagId, highest-priority first. */
export function findRedFlags(text: string, turnId: string): RedFlagHit[] {
  if (!text) return [];
  const orig = text.normalize('NFC');
  const folded = fold(orig);
  const hits: RedFlagHit[] = [];
  const seen = new Set<RedFlagId>();

  for (const rule of COMPILED) {
    if (seen.has(rule.id)) continue;
    let best: { start: number; end: number } | null = null;

    for (const re of rule.regs) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(folded))) {
        const start = m.index + m[1].length;
        const end = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
        const matched = folded.slice(start, end);

        const selfNeg = SELF_NEG.test(matched);
        const head = clauseBefore(folded, start);
        const tail = folded.slice(end, end + 24);
        const negHead = head.replace(JOINER, ' ');
        const negated =
          !selfNeg &&
          !UNCERTAIN.test(head) &&
          (NEG_BEFORE.test(negHead + ' ') || NEG_IMMEDIATE.test(head) || NEG_AFTER.test(clauseAfter(folded, end)));
        if (negated) continue;
        if (rule.diag) {
          // historical or family mention: "had a heart attack in 2019", "my father had a stroke"
          if (HIST_BEFORE.test(head) || HIST_AFTER.test(tail)) continue;
        }
        if (!best || start < best.start) best = { start, end };
      }
    }
    if (best) {
      seen.add(rule.id);
      hits.push({ id: rule.id, matched: orig.slice(best.start, best.end), turnId });
    }
  }
  return hits;
}

/** First (highest-priority) red flag in `text`, or null. */
export function checkRedFlags(text: string, turnId: string): RedFlagHit | null {
  return findRedFlags(text, turnId)[0] ?? null;
}
