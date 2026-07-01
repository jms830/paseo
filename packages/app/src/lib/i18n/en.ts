// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
export const en = {
  "skills.title": "Skills",
  "skills.loading": "Loading skills…",
  "skills.none": "No skills installed.",
  "skills.installFrom": "Install from GitHub",
  "skills.scan": "Scan",
  "skills.sourcePlaceholder": "owner/repo or owner/repo/subpath",
} as const;

export type MessageKey = keyof typeof en;
