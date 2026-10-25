// API keys only. Persisted to the device keychain only when the user opts in; never on web.
import { Platform } from 'react-native';
import type { KeyStore, ProviderId } from '../../contract/types';

const ITEM = 'voice-intake.groq-key';
let memory: Partial<Record<ProviderId, string>> = {};

const secureStore = () => import('expo-secure-store');

export const keyStore: KeyStore = {
  async load() {
    if (memory.groq || Platform.OS === 'web') return { ...memory };
    try {
      const groq = await (await secureStore()).getItemAsync(ITEM);
      if (groq) memory = { groq };
    } catch {
      /* keychain unavailable: behave as if nothing is stored */
    }
    return { ...memory };
  },

  async save(keys, remember) {
    memory = { ...keys };
    if (Platform.OS === 'web') return;
    const store = await secureStore();
    if (remember && keys.groq) {
      await store.setItemAsync(ITEM, keys.groq, { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    } else {
      await store.deleteItemAsync(ITEM);
    }
  },

  async clear() {
    memory = {};
    if (Platform.OS === 'web') return;
    try {
      await (await secureStore()).deleteItemAsync(ITEM);
    } catch {
      /* nothing stored */
    }
  },
};
