// Ported concept from openchamber/openchamber (MIT): lib/i18n message catalogs.
export const en = {
  "gitIdentity.title": "Git identity",
  "gitIdentity.current": "Current",
  "gitIdentity.add": "Add identity",
  "gitIdentity.apply": "Apply",
  "gitIdentity.remove": "Remove",
  "gitIdentity.applied": 'Applied "{label}" to this repository.',
} as const;

export type MessageKey = keyof typeof en;
