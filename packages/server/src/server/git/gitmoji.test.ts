import { describe, expect, it } from "vitest";
import { applyGitmoji, gitmojiForType } from "./gitmoji.js";

describe("gitmojiForType", () => {
  it("maps known conventional types", () => {
    expect(gitmojiForType("feat")).toBe("✨");
    expect(gitmojiForType("fix")).toBe("🐛");
    expect(gitmojiForType("FEAT")).toBe("✨");
  });

  it("returns null for unknown types", () => {
    expect(gitmojiForType("bogus")).toBeNull();
  });
});

describe("applyGitmoji", () => {
  it("prefixes a conventional commit subject", () => {
    expect(applyGitmoji("feat: add thing")).toBe("✨ feat: add thing");
    expect(applyGitmoji("fix(parser): handle eof")).toBe("🐛 fix(parser): handle eof");
  });

  it("handles breaking-change marker", () => {
    expect(applyGitmoji("feat!: drop v1")).toBe("✨ feat!: drop v1");
  });

  it("preserves the body across newlines", () => {
    expect(applyGitmoji("feat: x\n\nbody line")).toBe("✨ feat: x\n\nbody line");
  });

  it("does not double-prefix when an emoji is already present", () => {
    expect(applyGitmoji("✨ feat: add thing")).toBe("✨ feat: add thing");
  });

  it("leaves non-conventional messages unchanged", () => {
    expect(applyGitmoji("update files")).toBe("update files");
    expect(applyGitmoji("")).toBe("");
  });

  it("leaves unmapped types unchanged", () => {
    expect(applyGitmoji("frobnicate: stuff")).toBe("frobnicate: stuff");
  });
});
