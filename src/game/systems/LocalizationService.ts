import ru from '../../data/locales/ru.json';
import en from '../../data/locales/en.json';
import type { SupportedLanguage } from '../types/GameState';

const dictionaries: Record<SupportedLanguage, Record<string, string>> = {
  ru: ru as Record<string, string>,
  en: en as Record<string, string>,
};

const SUPPORTED: SupportedLanguage[] = ['ru', 'en'];

function resolveLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) return 'en';
  const prefix = value.toLowerCase().split('-')[0];
  return SUPPORTED.includes(prefix as SupportedLanguage)
    ? (prefix as SupportedLanguage)
    : 'en';
}

export class LocalizationService {
  private language: SupportedLanguage;

  constructor(
    platformLanguage: string,
    savedLanguage: SupportedLanguage | null = null,
  ) {
    this.language = resolveLanguage(savedLanguage ?? platformLanguage);
  }

  getLanguage(): SupportedLanguage {
    return this.language;
  }

  setLanguage(language: string): void {
    this.language = resolveLanguage(language);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dictionary = dictionaries[this.language];
    const fallback = dictionaries.en;
    let text = dictionary[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  }
}
