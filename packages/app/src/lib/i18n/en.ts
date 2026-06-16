// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
// English is the source-of-truth catalog; keys are dot-namespaced by surface. Templates use
// {name}-style placeholders interpolated at render time.
export const en = {
  // Project notes / todos panel
  "projectNotes.notes": "Notes",
  "projectNotes.todos": "Todos",
  "projectNotes.notesPlaceholder": "Project notes, reminders, links…",
  "projectNotes.todoPlaceholder": "Add a todo…",
  "projectNotes.empty": "No todos yet.",

  // Skills catalog section
  "skills.title": "Skills",
  "skills.loading": "Loading skills…",
  "skills.none": "No skills installed.",
  "skills.installFrom": "Install from GitHub",
  "skills.scan": "Scan",
  "skills.sourcePlaceholder": "owner/repo or owner/repo/subpath",

  // Git identity section
  "gitIdentity.title": "Git identity",
  "gitIdentity.current": "Current",
  "gitIdentity.add": "Add identity",
  "gitIdentity.apply": "Apply",
  "gitIdentity.remove": "Remove",
  "gitIdentity.applied": 'Applied "{label}" to this repository.',

  // Multi-run launcher
  "multiRun.title": "Multi-run",
  "multiRun.prompt": "Prompt",
  "multiRun.promptPlaceholder": "What should every model do?",
  "multiRun.modelsSelected": "Models ({count} selected)",
  "multiRun.cancel": "Cancel",
} as const;

export type MessageKey = keyof typeof en;
