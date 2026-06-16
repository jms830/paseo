// Minimal SKILL.md frontmatter reader. Skills use a leading `---` YAML block with at least
// `name` and `description`; we only need those two scalar fields, so a dependency-free line parser
// is sufficient (avoids pulling a YAML lib into the server bundle).
export interface SkillFrontmatter {
  name: string | null;
  description: string | null;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const result: SkillFrontmatter = { name: null, description: null };
  if (!content.startsWith("---")) {
    return result;
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return result;
  }
  const block = content.slice(3, end);
  for (const line of block.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1));
    if (key === "name" && value) {
      result.name = value;
    } else if (key === "description" && value) {
      result.description = value;
    }
  }
  return result;
}
