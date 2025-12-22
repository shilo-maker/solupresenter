import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import he from './locales/he.json';

// Function to update document direction based on language
const updateDocumentDirection = (lng) => {
  const language = lng || 'en';
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

// Listen for language changes to update document direction
i18n.on('languageChanged', (lng) => {
  updateDocumentDirection(lng);
});

// Function to change language and update document direction
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  // Direction update is handled by the 'languageChanged' event listener
};

// Set initial direction after i18n is initialized
// Use resolvedLanguage which is more reliable than language
updateDocumentDirection(i18n.resolvedLanguage || i18n.language);

export default i18n;
