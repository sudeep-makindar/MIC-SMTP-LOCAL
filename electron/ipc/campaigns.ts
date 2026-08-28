import { ipcMain } from "electron";
import fs from "node:fs";
import * as repo from "../db/campaigns.repo";
import { listRecipients } from "../db/recipients.repo";
import { campaignDir } from "../lib/paths";
import type { CampaignUpdate } from "../db/campaigns.repo";

export function registerCampaignHandlers(): void {
  ipcMain.handle("campaigns:list", () => repo.listCampaigns());

  ipcMain.handle("campaigns:get", (_e, id: string) => repo.getCampaign(id));

  ipcMain.handle("campaigns:create", (_e, name: string, description: string) => {
    const campaign = repo.createCampaign(name, description);
    fs.mkdirSync(campaignDir(campaign.id), { recursive: true });
    return campaign;
  });

  ipcMain.handle("campaigns:update", (_e, id: string, update: CampaignUpdate) => repo.updateCampaign(id, update));

  ipcMain.handle("campaigns:delete", (_e, id: string) => {
    repo.deleteCampaign(id);
    const dir = campaignDir(id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  ipcMain.handle("campaigns:listInterrupted", () => repo.listInterruptibleCampaigns());

  ipcMain.handle("campaigns:recipientStats", (_e, id: string) => {
    const recipients = listRecipients(id);
    return {
      total: recipients.length,
      sent: recipients.filter((r) => r.status === "sent").length,
      failed: recipients.filter((r) => r.status === "failed").length,
      skipped: recipients.filter((r) => r.status === "skipped" || r.status === "excluded").length,
      pending: recipients.filter((r) => r.status === "pending").length,
    };
  });
}
