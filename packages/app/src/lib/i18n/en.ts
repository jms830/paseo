// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
export const en = {
  "multiRun.title": "Multi-run",
  "multiRun.prompt": "Prompt",
  "multiRun.promptPlaceholder": "What should every model do?",
  "multiRun.modelsSelected": "Models ({count} selected)",
  "multiRun.cancel": "Cancel",
} as const;

export type MessageKey = keyof typeof en;
