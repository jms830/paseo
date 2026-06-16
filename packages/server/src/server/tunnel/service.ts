import { CloudflareTunnel, type TunnelStatus } from "./cloudflare-tunnel.js";

/**
 * Owns the host's single Cloudflare quick tunnel. Stateless beyond the tunnel handle; the caller
 * supplies the daemon's bound TCP port at start time.
 */
export class TunnelService {
  private readonly tunnel = new CloudflareTunnel();

  status(): TunnelStatus {
    return this.tunnel.getStatus();
  }

  start(port: number): Promise<TunnelStatus> {
    return this.tunnel.start(port);
  }

  stop(): TunnelStatus {
    return this.tunnel.stop();
  }
}
