// Ported concept from openchamber/openchamber (MIT): lib/i18n runtime.
// Minimal, typed i18n: a locale store (AsyncStorage-persisted) + a translate() with {placeholder}
// interpolation, exposed through the useI18n() hook. English is the fallback catalog.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { en, type MessageKey } from "./en";

export type { MessageKey };

export type Locale = "en";

export const SUPPORTED_LOCALES: Locale[] = ["en"];

const CATALOGS: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
};

export type TranslateParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? "" : String(value);
  });
}

/** Resolves a message for a locale, falling back to English then the raw key. */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = CATALOGS[locale]?.[key] ?? en[key] ?? key;
  return interpolate(template, params);
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as string[]).includes(value);
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "i18n",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { locale?: unknown } | undefined;
        return {
          ...currentState,
          locale: isLocale(persisted?.locale) ? persisted.locale : "en",
        };
      },
    },
  ),
);

export interface UseI18nResult {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

export function useI18n(): UseI18nResult {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );
  return { locale, setLocale, t };
}
