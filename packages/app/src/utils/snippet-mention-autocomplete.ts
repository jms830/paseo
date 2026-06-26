// Detects a `#snippet` mention being typed in the composer and replaces it with the
// snippet body. Mirrors file-mention-autocomplete.ts (the `@` trigger).
export interface SnippetMentionRange {
  start: number;
  end: number;
  query: string;
}

interface FindActiveSnippetMentionInput {
  text: string;
  cursorIndex: number;
}

interface ApplySnippetReplacementInput {
  text: string;
  mention: SnippetMentionRange;
  body: string;
}

const INVALID_SNIPPET_QUERY_CHARS = /[\s\n\r\t]/;

export function findActiveSnippetMention(
  input: FindActiveSnippetMentionInput,
): SnippetMentionRange | null {
  const clampedCursor = Math.max(0, Math.min(input.cursorIndex, input.text.length));
  const beforeCursor = input.text.slice(0, clampedCursor);

  for (
    let hashIndex = beforeCursor.lastIndexOf("#");
    hashIndex >= 0;
    hashIndex = hashIndex === 0 ? -1 : beforeCursor.lastIndexOf("#", hashIndex - 1)
  ) {
    const query = beforeCursor.slice(hashIndex + 1);
    if (INVALID_SNIPPET_QUERY_CHARS.test(query)) {
      continue;
    }
    return {
      start: hashIndex,
      end: clampedCursor,
      query,
    };
  }

  return null;
}

export function applySnippetReplacement(input: ApplySnippetReplacementInput): string {
  const before = input.text.slice(0, input.mention.start);
  const after = input.text.slice(input.mention.end);
  return `${before}${input.body}${after}`;
}
