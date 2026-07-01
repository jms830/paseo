// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
export const en = {
  "snippets.title": "Snippets",
  "snippets.hint": "Reusable text inserted in the composer by typing # then the snippet name.",
  "snippets.empty": "No snippets yet.",
  "snippets.namePlaceholder": "Name (e.g. review)",
  "snippets.bodyPlaceholder": "Snippet text…",
  "snippets.add": "Add snippet",
  "snippets.save": "Save",
  "snippets.cancel": "Cancel",
} as const;

export type MessageKey = keyof typeof en;
