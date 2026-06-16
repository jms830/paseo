import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnProcessMock = vi.fn();
const execCommandMock = vi.fn();

vi.mock("../../utils/spawn.js", () => ({
  spawnProcess: (...args: unknown[]) => spawnProcessMock(...args),
  execCommand: (...args: unknown[]) => execCommandMock(...args),
}));

import { CloudflareTunnel } from "./cloudflare-tunnel.js";

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe("CloudflareTunnel", () => {
  beforeEach(() => {
    spawnProcessMock.mockReset();
    execCommandMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports an error when cloudflared is unavailable", async () => {
    execCommandMock.mockRejectedValue(new Error("not found"));
    const tunnel = new CloudflareTunnel();
    const status = await tunnel.start(4096);
    expect(status.state).toBe("error");
    expect(status.error).toContain("cloudflared is not installed");
    expect(spawnProcessMock).not.toHaveBeenCalled();
  });

  it("transitions to running when the trycloudflare URL appears", async () => {
    execCommandMock.mockResolvedValue({ stdout: "cloudflared version 1", stderr: "" });
    const child = new FakeChild();
    spawnProcessMock.mockReturnValue(child);

    const tunnel = new CloudflareTunnel();
    const startPromise = tunnel.start(4096);
    // Wait until cloudflared has been spawned (after the async availability check) so listeners
    // are attached, then simulate it emitting the public URL on stderr.
    await vi.waitFor(() => expect(spawnProcessMock).toHaveBeenCalled());
    child.stderr.emit("data", Buffer.from("INF |  https://brave-fox-1.trycloudflare.com  |\n"));

    const status = await startPromise;
    expect(status.state).toBe("running");
    expect(status.url).toBe("https://brave-fox-1.trycloudflare.com");
    expect(status.port).toBe(4096);
    expect(spawnProcessMock).toHaveBeenCalledWith(
      "cloudflared",
      expect.arrayContaining(["tunnel", "--url", "http://127.0.0.1:4096"]),
    );
  });

  it("stops the tunnel and kills the process", async () => {
    execCommandMock.mockResolvedValue({ stdout: "v1", stderr: "" });
    const child = new FakeChild();
    spawnProcessMock.mockReturnValue(child);
    const tunnel = new CloudflareTunnel();
    const startPromise = tunnel.start(4096);
    await vi.waitFor(() => expect(spawnProcessMock).toHaveBeenCalled());
    child.stdout.emit("data", Buffer.from("https://x-y-z.trycloudflare.com"));
    await startPromise;

    const status = tunnel.stop();
    expect(status.state).toBe("stopped");
    expect(status.url).toBeNull();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("errors when cloudflared exits before producing a URL", async () => {
    execCommandMock.mockResolvedValue({ stdout: "v1", stderr: "" });
    const child = new FakeChild();
    spawnProcessMock.mockReturnValue(child);
    const tunnel = new CloudflareTunnel();
    const startPromise = tunnel.start(4096);
    await vi.waitFor(() => expect(spawnProcessMock).toHaveBeenCalled());
    child.emit("exit", 1);
    const status = await startPromise;
    expect(status.state).toBe("error");
    expect(status.error).toContain("exited");
  });
});
