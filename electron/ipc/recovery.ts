import { ipcMain } from "electron";
import { getCampaign, updateCampaign } from "../db/campaigns.repo";
import { getFailedRecipients, updateRecipient, recomputeCampaignStats } from "../db/recipients.repo";
import { runStartupRecovery } from "../lib/recovery";

export function registerRecoveryHandlers(): void {
  ipcMain.handle("recovery:check", () => runStartupRecovery());

  ipcMain.handle("recovery:decide", (_e, campaignId: string, decision: "resume" | "restart" | "discard") => {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (decision === "resume") {
      updateCampaign(campaignId, { status: "paused" });
    } else if (decision === "restart") {
      const failed = getFailedRecipients(campaignId);
      for (const r of failed) {
        updateRecipient(r.id, { status: "pending", errorReason: null, failureCategory: null });
      }
      updateCampaign(campaignId, { status: "paused" });
      recomputeCampaignStats(campaignId);
    } else if (decision === "discard") {
      updateCampaign(campaignId, { status: "cancelled" });
    }
    return getCampaign(campaignId);
  });
}
