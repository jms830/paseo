// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
export const en = {
  "projectNotes.notes": "Notes",
  "projectNotes.todos": "Todos",
  "projectNotes.notesPlaceholder": "Project notes, reminders, links…",
  "projectNotes.todoPlaceholder": "Add a todo…",
  "projectNotes.empty": "No todos yet.",
} as const;

export type MessageKey = keyof typeof en;
