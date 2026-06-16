import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));

import { translate, useI18nStore } from "@/lib/i18n";

describe("i18n", () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: "en" });
  });

  it("resolves a known key", () => {
    expect(translate("en", "skills.title")).toBe("Skills");
  });

  it("interpolates placeholders", () => {
    expect(translate("en", "multiRun.modelsSelected", { count: 3 })).toBe("Models (3 selected)");
    expect(translate("en", "gitIdentity.applied", { label: "Work" })).toBe(
      'Applied "Work" to this repository.',
    );
  });

  it("leaves missing placeholders empty when params are provided", () => {
    expect(translate("en", "multiRun.modelsSelected", {})).toBe("Models ( selected)");
  });

  it("returns the template verbatim when no params are passed", () => {
    expect(translate("en", "multiRun.modelsSelected")).toBe("Models ({count} selected)");
  });

  it("exposes a settable locale", () => {
    useI18nStore.getState().setLocale("en");
    expect(useI18nStore.getState().locale).toBe("en");
  });

  it("falls back to en on unsupported persisted locale", () => {
    const options = useI18nStore.persist.getOptions();
    const restored = options.merge?.({ locale: "zz" }, useI18nStore.getState());
    expect(restored?.locale).toBe("en");
  });
});
