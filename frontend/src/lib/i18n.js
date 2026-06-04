import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';

export const LANG_KEY = 'taskflow_lang';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇺🇸' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'ja', label: '日本語',    flag: '🇯🇵' },
];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    ja: { translation: ja },
  },
  lng: localStorage.getItem(LANG_KEY) || navigator.language?.slice(0, 2) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initImmediate: false,
  react: { useSuspense: false },
});

export function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang);
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default i18n;
