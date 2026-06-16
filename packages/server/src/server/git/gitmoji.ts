// Ported concept from openchamber/openchamber (MIT): GitView KEYWORD_MAP.
// Maps a Conventional Commit type to its gitmoji (https://gitmoji.dev) and prefixes a generated
// commit message's subject line with the matching emoji.
const KEYWORD_MAP: Record<string, string> = {
  feat: "✨",
  feature: "✨",
  fix: "🐛",
  hotfix: "🚑️",
  docs: "📝",
  doc: "📝",
  style: "🎨",
  refactor: "♻️",
  perf: "⚡️",
  test: "✅",
  tests: "✅",
  build: "📦️",
  ci: "👷",
  chore: "🔧",
  revert: "⏪️",
  init: "🎉",
  security: "🔒️",
  deps: "⬆️",
  wip: "🚧",
  remove: "🔥",
  config: "🔧",
};

// type or type(scope), optional `!` for breaking changes, then `: subject`.
const CONVENTIONAL_PREFIX = /^([a-z]+)(?:\([^)]*\))?(!)?:\s/i;

// Detects a leading emoji (so we never double-prefix). Covers the gitmoji ranges plus VS-16.
const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

/**
 * Returns the gitmoji for a Conventional Commit `type`, or null when unmapped.
 */
export function gitmojiForType(type: string): string | null {
  return KEYWORD_MAP[type.trim().toLowerCase()] ?? null;
}

/**
 * Prefixes a commit message's first line with the gitmoji matching its Conventional Commit type.
 * Returns the message unchanged when there is no recognized type or it already starts with an emoji.
 */
export function applyGitmoji(message: string): string {
  if (!message) {
    return message;
  }
  const newlineIndex = message.indexOf("\n");
  const subject = newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  const rest = newlineIndex === -1 ? "" : message.slice(newlineIndex);

  if (LEADING_EMOJI.test(subject.trimStart())) {
    return message;
  }
  const match = subject.match(CONVENTIONAL_PREFIX);
  if (!match) {
    return message;
  }
  const emoji = gitmojiForType(match[1]);
  if (!emoji) {
    return message;
  }
  return `${emoji} ${subject}${rest}`;
}
