import type { DoctorLanguage, PatientLanguage, QuestionId, RedFlagId } from '../contract/types';

/** Patient-facing strings (interview + escalation), in the patient's language. */
export interface PatientStrings {
  progress: (n: number, total: number) => string;
  tapToSpeak: string;
  tapToStop: string;
  recording: string;
  getReady: string;
  processing: string;
  notHeard: string;
  micDenied: string;
  genericError: string;
  yourAnswer: string;
  saveCorrection: string;
  saved: string;
  typeInstead: string;
  typePlaceholder: string;
  send: string;
  cancel: string;
  edit: string;
  earlierAnswers: string;
  allDone: string;
  createSummary: string;
  latency: (ms: number) => string;
  emergencyTitle: string;
  emergencyBody: string;
  call112: string;
  detected: string;
  continueAnyway: string;
  continueHint: string;
  flags: Record<RedFlagId, string>;
}

export const PATIENT: Record<PatientLanguage, PatientStrings> = {
  en: {
    progress: (n, t) => `Question ${n} of ${t}`,
    tapToSpeak: 'Tap to speak',
    tapToStop: 'Tap to stop',
    recording: 'Speak now',
    getReady: 'Get ready…',
    processing: 'Transcribing…',
    notHeard: 'I didn’t catch that. Tap the microphone and try again, a little slower, or type your answer.',
    micDenied: 'Microphone access was denied. Please allow it in your settings, or type your answer.',
    genericError: 'Something went wrong. Please try again or type your answer.',
    yourAnswer: 'Your answer (you can correct it)',
    saveCorrection: 'Save correction',
    saved: 'Saved',
    typeInstead: 'Type instead',
    typePlaceholder: 'Type your answer here',
    send: 'Send',
    cancel: 'Cancel',
    edit: 'Edit',
    earlierAnswers: 'Earlier answers',
    allDone: 'All questions answered. Check your last answer, then continue.',
    createSummary: 'Create summary for the doctor',
    latency: (ms) => `${(ms / 1000).toFixed(1)} s`,
    emergencyTitle: 'This may be an emergency',
    emergencyBody: 'Do not wait for a doctor’s message. Call the emergency number now.',
    call112: 'Call 112 now',
    detected: 'What we detected in your answer',
    continueAnyway: 'Continue the intake for the doctor anyway',
    continueHint: 'Only continue after you have called for help or if you are already safe.',
    flags: {
      chest_pain: 'Chest pain',
      breathing_difficulty: 'Difficulty breathing',
      stroke_signs: 'Possible stroke signs',
      suicidal_ideation: 'Thoughts of self-harm',
      anaphylaxis: 'Severe allergic reaction',
      severe_bleeding: 'Severe bleeding',
      loss_of_consciousness: 'Loss of consciousness',
    },
  },
  pl: {
    progress: (n, t) => `Pytanie ${n} z ${t}`,
    tapToSpeak: 'Dotknij, aby mówić',
    tapToStop: 'Dotknij, aby zakończyć',
    recording: 'Mów teraz',
    getReady: 'Przygotuj się…',
    processing: 'Przetwarzam nagranie…',
    notHeard: 'Nie usłyszałem odpowiedzi. Dotknij mikrofonu i spróbuj jeszcze raz, trochę wolniej, lub wpisz odpowiedź.',
    micDenied: 'Brak dostępu do mikrofonu. Zezwól na dostęp w ustawieniach lub wpisz odpowiedź.',
    genericError: 'Coś poszło nie tak. Spróbuj ponownie lub wpisz odpowiedź.',
    yourAnswer: 'Twoja odpowiedź (możesz ją poprawić)',
    saveCorrection: 'Zapisz poprawkę',
    saved: 'Zapisano',
    typeInstead: 'Wpisz zamiast mówić',
    typePlaceholder: 'Wpisz odpowiedź',
    send: 'Wyślij',
    cancel: 'Anuluj',
    edit: 'Edytuj',
    earlierAnswers: 'Wcześniejsze odpowiedzi',
    allDone: 'Odpowiedziano na wszystkie pytania. Sprawdź ostatnią odpowiedź i przejdź dalej.',
    createSummary: 'Utwórz podsumowanie dla lekarza',
    latency: (ms) => `${(ms / 1000).toFixed(1)} s`,
    emergencyTitle: 'To może być nagły przypadek',
    emergencyBody: 'Nie czekaj na wiadomość od lekarza. Zadzwoń teraz pod numer alarmowy.',
    call112: 'Zadzwoń pod 112',
    detected: 'Co wykryliśmy w Twojej odpowiedzi',
    continueAnyway: 'Mimo to kontynuuj wywiad dla lekarza',
    continueHint: 'Kontynuuj dopiero po wezwaniu pomocy lub jeśli jesteś już bezpieczny.',
    flags: {
      chest_pain: 'Ból w klatce piersiowej',
      breathing_difficulty: 'Trudności z oddychaniem',
      stroke_signs: 'Możliwe objawy udaru',
      suicidal_ideation: 'Myśli o zrobieniu sobie krzywdy',
      anaphylaxis: 'Ciężka reakcja alergiczna',
      severe_bleeding: 'Silne krwawienie',
      loss_of_consciousness: 'Utrata przytomności',
    },
  },
  uk: {
    progress: (n, t) => `Питання ${n} з ${t}`,
    tapToSpeak: 'Натисніть, щоб говорити',
    tapToStop: 'Натисніть, щоб зупинити',
    recording: 'Говоріть',
    getReady: 'Приготуйтеся…',
    processing: 'Обробка запису…',
    notHeard: 'Не вдалося почути відповідь. Натисніть мікрофон і спробуйте ще раз, трохи повільніше, або введіть відповідь.',
    micDenied: 'Немає доступу до мікрофона. Дозвольте доступ у налаштуваннях або введіть відповідь.',
    genericError: 'Щось пішло не так. Спробуйте ще раз або введіть відповідь.',
    yourAnswer: 'Ваша відповідь (можна виправити)',
    saveCorrection: 'Зберегти виправлення',
    saved: 'Збережено',
    typeInstead: 'Ввести текстом',
    typePlaceholder: 'Введіть відповідь',
    send: 'Надіслати',
    cancel: 'Скасувати',
    edit: 'Змінити',
    earlierAnswers: 'Попередні відповіді',
    allDone: 'Ви відповіли на всі питання. Перевірте останню відповідь і продовжуйте.',
    createSummary: 'Створити підсумок для лікаря',
    latency: (ms) => `${(ms / 1000).toFixed(1)} с`,
    emergencyTitle: 'Це може бути невідкладний стан',
    emergencyBody: 'Не чекайте повідомлення від лікаря. Негайно зателефонуйте за номером екстреної допомоги.',
    call112: 'Зателефонувати 112',
    detected: 'Що ми виявили у вашій відповіді',
    continueAnyway: 'Все одно продовжити опитування для лікаря',
    continueHint: 'Продовжуйте лише після виклику допомоги або якщо ви вже в безпеці.',
    flags: {
      chest_pain: 'Біль у грудях',
      breathing_difficulty: 'Утруднене дихання',
      stroke_signs: 'Можливі ознаки інсульту',
      suicidal_ideation: 'Думки про самопошкодження',
      anaphylaxis: 'Тяжка алергічна реакція',
      severe_bleeding: 'Сильна кровотеча',
      loss_of_consciousness: 'Втрата свідомості',
    },
  },
};

/** Doctor-card strings, in the doctor's language. */
export interface DoctorStrings {
  cardTitle: string;
  sample: string;
  opqrst: string;
  chiefComplaint: string;
  onset: string;
  provocation: string;
  quality: string;
  region: string;
  severity: string;
  time: string;
  signsSymptoms: string;
  allergies: string;
  medications: string;
  pastHistory: string;
  lastIntake: string;
  events: string;
  missing: string;
  missingNone: string;
  stated: string;
  inferred: string;
  patientSaid: string;
  tapForQuote: string;
  dropped: (n: number) => string;
  redFlags: string;
  fhir: string;
  showFhir: string;
  hideFhir: string;
  copy: string;
  copied: string;
  endWipe: string;
  none: string;
  questionNames: Record<QuestionId, string>;
  disclaimer: string;
}

export const DOCTOR: Record<DoctorLanguage, DoctorStrings> = {
  en: {
    cardTitle: 'Pre-consultation intake card',
    sample: 'SAMPLE history',
    opqrst: 'OPQRST (chief complaint)',
    chiefComplaint: 'Chief complaint',
    onset: 'Onset',
    provocation: 'Provocation / palliation',
    quality: 'Quality',
    region: 'Region / radiation',
    severity: 'Severity',
    time: 'Time course',
    signsSymptoms: 'Signs & symptoms',
    allergies: 'Allergies',
    medications: 'Medications',
    pastHistory: 'Past medical history',
    lastIntake: 'Last oral intake',
    events: 'Events leading up',
    missing: 'Missing',
    missingNone: 'Nothing missing.',
    stated: 'Patient said',
    inferred: 'Inferred',
    patientSaid: 'Patient said',
    tapForQuote: 'Tap a fact to see the quote',
    dropped: (n) => `${n} unsupported fact${n === 1 ? '' : 's'} removed (quote not found in transcript)`,
    redFlags: 'Red flags reported during intake',
    fhir: 'FHIR R4 bundle',
    showFhir: 'Show FHIR JSON',
    hideFhir: 'Hide FHIR JSON',
    copy: 'Copy JSON',
    copied: 'Copied',
    endWipe: 'End session & wipe',
    none: 'None reported',
    questionNames: {
      chief_complaint: 'Chief complaint',
      onset: 'Onset',
      severity: 'Severity',
      associated_symptoms: 'Associated symptoms',
      medications: 'Medications',
      allergies: 'Allergies',
      past_history: 'Past history',
      events: 'Last intake / events',
    },
    disclaimer: 'Intake summary only. Not a diagnosis. Review with the patient.',
  },
  pl: {
    cardTitle: 'Karta wywiadu przed konsultacją',
    sample: 'Wywiad SAMPLE',
    opqrst: 'OPQRST (główna dolegliwość)',
    chiefComplaint: 'Główna dolegliwość',
    onset: 'Początek',
    provocation: 'Czynniki nasilające / łagodzące',
    quality: 'Charakter',
    region: 'Lokalizacja / promieniowanie',
    severity: 'Nasilenie',
    time: 'Przebieg w czasie',
    signsSymptoms: 'Objawy',
    allergies: 'Alergie',
    medications: 'Leki',
    pastHistory: 'Choroby przebyte i przewlekłe',
    lastIntake: 'Ostatni posiłek / płyny',
    events: 'Zdarzenia poprzedzające',
    missing: 'Braki',
    missingNone: 'Brak braków.',
    stated: 'Pacjent powiedział',
    inferred: 'Wywnioskowane',
    patientSaid: 'Pacjent powiedział',
    tapForQuote: 'Dotknij informacji, aby zobaczyć cytat',
    dropped: (n) => `Usunięto niepotwierdzone informacje: ${n} (brak cytatu w transkrypcji)`,
    redFlags: 'Czerwone flagi zgłoszone podczas wywiadu',
    fhir: 'Pakiet FHIR R4',
    showFhir: 'Pokaż JSON FHIR',
    hideFhir: 'Ukryj JSON FHIR',
    copy: 'Kopiuj JSON',
    copied: 'Skopiowano',
    endWipe: 'Zakończ sesję i usuń dane',
    none: 'Brak zgłoszeń',
    questionNames: {
      chief_complaint: 'Główna dolegliwość',
      onset: 'Początek',
      severity: 'Nasilenie',
      associated_symptoms: 'Objawy towarzyszące',
      medications: 'Leki',
      allergies: 'Alergie',
      past_history: 'Choroby przebyte',
      events: 'Ostatni posiłek / zdarzenia',
    },
    disclaimer: 'Tylko podsumowanie wywiadu. To nie jest diagnoza. Zweryfikuj z pacjentem.',
  },
};

export const RED_FLAG_DOCTOR: Record<DoctorLanguage, Record<RedFlagId, string>> = {
  en: {
    chest_pain: 'Chest pain',
    breathing_difficulty: 'Difficulty breathing',
    stroke_signs: 'Possible stroke signs',
    suicidal_ideation: 'Suicidal ideation / self-harm',
    anaphylaxis: 'Anaphylaxis / severe allergic reaction',
    severe_bleeding: 'Severe bleeding',
    loss_of_consciousness: 'Loss of consciousness',
  },
  pl: {
    chest_pain: 'Ból w klatce piersiowej',
    breathing_difficulty: 'Duszność',
    stroke_signs: 'Możliwe objawy udaru',
    suicidal_ideation: 'Myśli samobójcze / samouszkodzenie',
    anaphylaxis: 'Anafilaksja / ciężka reakcja alergiczna',
    severe_bleeding: 'Silne krwawienie',
    loss_of_consciousness: 'Utrata przytomności',
  },
};

export const LANGUAGE_NAMES: Record<PatientLanguage, string> = {
  pl: 'Polski',
  en: 'English',
  uk: 'Українська',
};
