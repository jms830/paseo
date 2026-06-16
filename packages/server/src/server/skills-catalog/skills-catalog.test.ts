import { describe, expect, it } from "vitest";
import { parseSkillRepoSource } from "./source.js";
import { parseSkillFrontmatter } from "./frontmatter.js";

describe("parseSkillRepoSource", () => {
  it("parses owner/repo shorthand", () => {
    const result = parseSkillRepoSource("anthropics/skills");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.owner).toBe("anthropics");
      expect(result.repo).toBe("skills");
      expect(result.host).toBe("github.com");
      expect(result.cloneUrlHttps).toBe("https://github.com/anthropics/skills.git");
      expect(result.effectiveSubpath).toBeNull();
    }
  });

  it("parses shorthand with subpath", () => {
    const result = parseSkillRepoSource("anthropics/skills/document-skills");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedRepo).toBe("anthropics/skills");
      expect(result.effectiveSubpath).toBe("document-skills");
    }
  });

  it("parses https URLs and strips .git", () => {
    const result = parseSkillRepoSource("https://github.com/owner/repo.git");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    }
  });

  it("parses ssh URLs", () => {
    const result = parseSkillRepoSource("git@github.com:owner/repo.git");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cloneUrlSsh).toBe("git@github.com:owner/repo.git");
    }
  });

  it("prefers explicit subpath option over shorthand subpath", () => {
    const result = parseSkillRepoSource("owner/repo/from-shorthand", { subpath: "from-option" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.effectiveSubpath).toBe("from-option");
    }
  });

  it("rejects empty and malformed sources", () => {
    expect(parseSkillRepoSource("").ok).toBe(false);
    expect(parseSkillRepoSource("notarepo").ok).toBe(false);
  });
});

describe("parseSkillFrontmatter", () => {
  it("extracts name and description from a YAML block", () => {
    const content = ["---", "name: pdf-tools", "description: Work with PDFs", "---", "# Body"].join(
      "\n",
    );
    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("pdf-tools");
    expect(result.description).toBe("Work with PDFs");
  });

  it("strips surrounding quotes", () => {
    const content = ["---", 'name: "quoted"', "description: 'single'", "---"].join("\n");
    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("quoted");
    expect(result.description).toBe("single");
  });

  it("returns nulls when there is no frontmatter", () => {
    const result = parseSkillFrontmatter("# Just a heading\n");
    expect(result.name).toBeNull();
    expect(result.description).toBeNull();
  });
});
