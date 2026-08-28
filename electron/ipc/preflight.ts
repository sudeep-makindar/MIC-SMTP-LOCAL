import { ipcMain } from "electron";
import { getCampaign } from "../db/campaigns.repo";
import { runPreflight } from "../lib/preflight";

export function registerPreflightHandlers(): void {
  ipcMain.handle("preflight:run", async (_e, campaignId: string) => {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    return runPreflight(campaign);
  });
}
