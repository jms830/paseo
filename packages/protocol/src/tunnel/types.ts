// Shared tunnel types. Single source of truth consumed by the server
// (tunnel/cloudflare-tunnel) and the app (tunnel-section).

export type TunnelState = "stopped" | "starting" | "running" | "error";

export interface TunnelStatus {
  state: TunnelState;
  url: string | null;
  error: string | null;
  port: number | null;
}
