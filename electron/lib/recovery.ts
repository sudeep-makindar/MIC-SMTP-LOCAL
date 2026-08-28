import type { Campaign } from "../../shared/types";
import { listInterruptibleCampaigns, markInterrupted } from "../db/campaigns.repo";

/**
 * Runs once at app startup. Any campaign still marked "sending" means the
 * process died mid-run (a clean pause always leaves status "paused", never
 * "sending"). Those get flagged "interrupted" so the dashboard can surface
 * a recovery prompt. Campaigns already "paused" are normal resumable state,
 * not a crash, and are left alone.
 */
export function runStartupRecovery(): Campaign[] {
  const candidates = listInterruptibleCampaigns();
  const interrupted: Campaign[] = [];
  for (const c of candidates) {
    if (c.status === "sending") {
      markInterrupted(c.id);
      interrupted.push({ ...c, status: "interrupted" });
    }
  }
  return interrupted;
}
