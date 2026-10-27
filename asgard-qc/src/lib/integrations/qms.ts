/**
 * Integration point for an external QMS / document system (e.g. SharePoint,
 * a commercial QMS). No connector is implemented: there is no supported
 * system or credential configured for this installation. This adapter
 * reports that honestly so the UI never implies a live connection.
 *
 * To add one, implement QmsAdapter for the target system using its
 * documented API, register it in `adapters`, and set QMS_PROVIDER plus the
 * provider's credentials in the environment. See docs/INTEGRATIONS.md.
 */
export interface QmsAdapter {
  id: string;
  label: string;
  /** Verify credentials and reachability without changing anything. */
  testConnection(): Promise<{ ok: boolean; message: string }>;
  /** Push a read-only copy of an NCR / document reference outward. Must
   *  never overwrite records in the remote system without approval. */
  exportNcr?(ncrCode: string, payload: Record<string, unknown>): Promise<{ remoteId: string }>;
}

const adapters: Record<string, () => QmsAdapter> = {};

export function qmsStatus(): { connected: boolean; provider: string | null; label: string; detail: string } {
  const provider = process.env.QMS_PROVIDER?.trim() || null;
  if (!provider) return { connected: false, provider: null, label: "Not connected", detail: "No QMS integration configured. The Command Centre is the system of record for the data shown here." };
  if (!adapters[provider]) return { connected: false, provider, label: "Not connected", detail: `QMS_PROVIDER is "${provider}" but no adapter for it is installed.` };
  return { connected: false, provider, label: "Configured — untested", detail: "Run a connection test from Settings → Integrations." };
}

export function getAdapter(): QmsAdapter | null {
  const p = process.env.QMS_PROVIDER?.trim();
  return p && adapters[p] ? adapters[p]() : null;
}
