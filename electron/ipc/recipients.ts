import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as repo from "../db/recipients.repo";
import { getCampaign } from "../db/campaigns.repo";
import { getRecentlyContactedEmails } from "../db/sendlog.repo";
import { campaignAttachmentsDir } from "../lib/paths";
import { ensureDir } from "../lib/fsutil";
import { updateCampaign } from "../db/campaigns.repo";

export function registerRecipientHandlers(): void {
  ipcMain.handle("recipients:list", (_e, campaignId: string) => repo.listRecipients(campaignId));

  ipcMain.handle("recipients:excludeDuplicates", (_e, campaignId: string) => {
    const all = repo.listRecipients(campaignId);
    const ids = all.filter((r) => r.isDuplicate).map((r) => r.id);
    repo.excludeRecipients(ids);
    return repo.recomputeCampaignStats(campaignId);
  });

  ipcMain.handle("recipients:excludeRecent", (_e, campaignId: string, hours: number) => {
    const all = repo.listRecipients(campaignId).filter((r) => r.status === "pending");
    const recent = getRecentlyContactedEmails(all.map((r) => r.email), hours);
    const ids = all.filter((r) => recent.has(r.email.trim().toLowerCase())).map((r) => r.id);
    repo.excludeRecipients(ids);
    return repo.recomputeCampaignStats(campaignId);
  });

  ipcMain.handle("recipients:exclude", (_e, ids: string[]) => {
    repo.excludeRecipients(ids);
  });

  ipcMain.handle("recipients:pickStaticAttachment", async (_e, campaignId: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select attachment file",
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const src = result.filePaths[0];
    const dir = campaignAttachmentsDir(campaignId);
    ensureDir(dir);
    const destName = path.basename(src);
    fs.copyFileSync(src, path.join(dir, destName));
    const campaign = getCampaign(campaignId)!;
    updateCampaign(campaignId, {
      attachmentConfig: { ...campaign.attachmentConfig, mode: "static", staticFileName: destName },
    });
    return destName;
  });
}
