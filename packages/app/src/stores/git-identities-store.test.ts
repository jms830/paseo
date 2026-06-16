import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));

import { useGitIdentitiesStore } from "@/stores/git-identities-store";

describe("git-identities-store", () => {
  beforeEach(() => {
    useGitIdentitiesStore.setState({ profiles: [] });
  });

  it("adds a profile, defaulting label to name", () => {
    const store = useGitIdentitiesStore.getState();
    const created = store.addProfile({ label: "", name: "Ada", email: "ada@x.dev" });
    expect(created.label).toBe("Ada");
    expect(useGitIdentitiesStore.getState().profiles).toHaveLength(1);
  });

  it("trims fields on add", () => {
    const store = useGitIdentitiesStore.getState();
    const created = store.addProfile({ label: " Work ", name: " Grace ", email: " grace@x.dev " });
    expect(created.label).toBe("Work");
    expect(created.name).toBe("Grace");
    expect(created.email).toBe("grace@x.dev");
  });

  it("updates a profile", () => {
    const store = useGitIdentitiesStore.getState();
    const created = store.addProfile({ label: "Work", name: "Grace", email: "grace@x.dev" });
    store.updateProfile(created.id, { label: "Home", name: "Grace H", email: "grace@home.dev" });
    const updated = useGitIdentitiesStore.getState().profiles[0];
    expect(updated.label).toBe("Home");
    expect(updated.email).toBe("grace@home.dev");
  });

  it("removes a profile", () => {
    const store = useGitIdentitiesStore.getState();
    const created = store.addProfile({ label: "Work", name: "Grace", email: "grace@x.dev" });
    store.removeProfile(created.id);
    expect(useGitIdentitiesStore.getState().profiles).toEqual([]);
  });

  it("drops invalid entries during persistence merge", () => {
    const options = useGitIdentitiesStore.persist.getOptions();
    const restored = options.merge?.(
      {
        profiles: [
          { id: "1", label: "Ok", name: "A", email: "a@x.dev" },
          { id: "2", name: "", email: "b@x.dev" },
          { label: "no id", name: "C", email: "c@x.dev" },
        ],
      },
      useGitIdentitiesStore.getState(),
    );
    expect(restored?.profiles).toHaveLength(1);
    expect(restored?.profiles[0]?.id).toBe("1");
  });
});
