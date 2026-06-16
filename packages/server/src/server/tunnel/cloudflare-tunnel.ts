// Ported concept from openchamber/openchamber (MIT): cloudflare-tunnel.js / tunnels/providers/cloudflare.js.
// Wraps a `cloudflared tunnel --url http://127.0.0.1:<port>` quick tunnel: spawns the binary,
// parses the public trycloudflare.com URL from its output, and manages the process lifecycle.
// This is an OPTIONAL public-exposure path; Paseo's native remote access remains relay + pairing.
import type { ChildProcess } from "node:child_process";
import { spawnProcess, execCommand } from "../../utils/spawn.js";

const TRY_CF_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const STARTUP_TIMEOUT_MS = 30_000;

import type { TunnelState, TunnelStatus } from "@getpaseo/protocol/tunnel/types";

export type { TunnelState, TunnelStatus };

export async function isCloudflaredAvailable(): Promise<boolean> {
  try {
    await execCommand("cloudflared", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * A single Cloudflare quick tunnel. Not concurrency-safe across multiple simultaneous starts;
 * callers (TunnelService) serialize start/stop.
 */
export class CloudflareTunnel {
  private process: ChildProcess | null = null;
  private state: TunnelState = "stopped";
  private url: string | null = null;
  private error: string | null = null;
  private port: number | null = null;

  getStatus(): TunnelStatus {
    return { state: this.state, url: this.url, error: this.error, port: this.port };
  }

  isActive(): boolean {
    return this.state === "starting" || this.state === "running";
  }

  async start(port: number): Promise<TunnelStatus> {
    if (this.isActive()) {
      return this.getStatus();
    }
    if (!(await isCloudflaredAvailable())) {
      this.state = "error";
      this.error = "cloudflared is not installed on this host.";
      return this.getStatus();
    }

    this.state = "starting";
    this.error = null;
    this.url = null;
    this.port = port;

    const child = spawnProcess("cloudflared", [
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://127.0.0.1:${port}`,
    ]);
    this.process = child;

    return new Promise<TunnelStatus>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve(this.getStatus());
        }
      };

      const timeout = setTimeout(() => {
        if (this.state === "starting") {
          this.state = "error";
          this.error = "Timed out waiting for the tunnel URL.";
          this.stop();
        }
        finish();
      }, STARTUP_TIMEOUT_MS);

      const onData = (chunk: Buffer) => {
        const match = chunk.toString("utf8").match(TRY_CF_URL_REGEX);
        if (match && this.state === "starting") {
          this.url = match[0];
          this.state = "running";
          clearTimeout(timeout);
          finish();
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);

      child.on("exit", (code) => {
        clearTimeout(timeout);
        this.process = null;
        if (this.state !== "stopped") {
          this.state = "error";
          this.error = this.error ?? `cloudflared exited (code ${code ?? "unknown"}).`;
          this.url = null;
        }
        finish();
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        this.state = "error";
        this.error = err instanceof Error ? err.message : "Failed to start cloudflared.";
        finish();
      });
    });
  }

  stop(): TunnelStatus {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    this.state = "stopped";
    this.url = null;
    this.error = null;
    return this.getStatus();
  }
}
