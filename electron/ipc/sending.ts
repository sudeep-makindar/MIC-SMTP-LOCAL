import { ipcMain, BrowserWindow } from "electron";
import { getEngine, isPermanentFailure } from "../lib/sending-engine";
import { getCampaign, updateCampaign } from "../db/campaigns.repo";
import { getFailedRecipients, getPendingRecipients, updateRecipient, recomputeCampaignStats } from "../db/recipients.repo";
import type { SendProgress } from "../../shared/types";

const wiredCampaigns = new Set<string>();

function ensureWired(campaignId: string, getWindow: () => BrowserWindow | null) {
  if (wiredCampaigns.has(campaignId)) return;
  wiredCampaigns.add(campaignId);
  const engine = getEngine(campaignId);
  engine.on("progress", (progress: SendProgress) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("sending:progress", progress);
    }
  });
}

export function registerSendingHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("sending:start", async (_e, campaignId: string, options?: { testEmail?: string }) => {
    ensureWired(campaignId, getWindow);
    const engine = getEngine(campaignId);
    void engine.runAutomatic(options);
    return { started: true };
  });

  ipcMain.handle("sending:pause", (_e, campaignId: string) => {
    getEngine(campaignId).pause();
  });

  ipcMain.handle("sending:stop", (_e, campaignId: string) => {
    getEngine(campaignId).stop();
  });

  ipcMain.handle("sending:resume", async (_e, campaignId: string) => {
    ensureWired(campaignId, getWindow);
    const engine = getEngine(campaignId);
    void engine.runAutomatic();
    return { started: true };
  });

  ipcMain.handle("sending:getNextPending", (_e, campaignId: string) => {
    const pending = getPendingRecipients(campaignId);
    return pending.length > 0 ? pending[0] : null;
  });

  ipcMain.handle("sending:manualSendNext", async (_e, campaignId: string) => {
    ensureWired(campaignId, getWindow);
    const pending = getPendingRecipients(campaignId);
    if (pending.length === 0) return { done: true };
    const engine = getEngine(campaignId);
    await engine.sendManualOne(pending[0].id);
    return { done: false };
  });

  ipcMain.handle("sending:manualSkipNext", (_e, campaignId: string) => {
    const pending = getPendingRecipients(campaignId);
    if (pending.length === 0) return { done: true };
    getEngine(campaignId).skipManualOne(pending[0].id);
    return { done: false };
  });

  ipcMain.handle("sending:retryFailed", (_e, campaignId: string, recipientIds?: string[]) => {
    const failed = getFailedRecipients(campaignId);
    const targets = recipientIds ? failed.filter((r) => recipientIds.includes(r.id)) : failed.filter((r) => !isPermanentFailure(r.failureCategory));
    for (const r of targets) {
      updateRecipient(r.id, { status: "pending" });
    }
    const stats = recomputeCampaignStats(campaignId);
    const campaign = getCampaign(campaignId);
    if (campaign && (campaign.status === "completed" || campaign.status === "failed")) {
      updateCampaign(campaignId, { status: "paused" });
    }
    return { requeued: targets.length, stats };
  });

  ipcMain.handle("sending:cancel", (_e, campaignId: string) => {
    getEngine(campaignId).stop();
    updateCampaign(campaignId, { status: "cancelled" });
  });
}
