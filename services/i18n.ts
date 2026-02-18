import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "../locales/en.json";
import vi from "../locales/vi.json";

const LANGUAGE_KEY = "appLanguage";

const languageDetector = {
  type: "languageDetector" as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    callback(saved || "vi");
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lng);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, vi: { translation: vi } },
    fallbackLng: "vi",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
