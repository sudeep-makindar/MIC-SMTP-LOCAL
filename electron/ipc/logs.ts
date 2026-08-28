import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import * as sendlog from "../db/sendlog.repo";
import { listRecipients } from "../db/recipients.repo";
import { getCampaign, listCampaigns } from "../db/campaigns.repo";
import { campaignExportsDir, EXPORTS_DIR } from "../lib/paths";
import { ensureDir } from "../lib/fsutil";
import type { LogSearchFilters } from "../db/sendlog.repo";

export function registerLogHandlers(): void {
  ipcMain.handle("logs:search", (_e, filters: LogSearchFilters) => sendlog.searchLog(filters));

  ipcMain.handle("logs:recipientHistory", (_e, email: string) => sendlog.getRecipientHistory(email));

  ipcMain.handle("logs:masterStats", () => sendlog.getMasterStats());

  ipcMain.handle("logs:exportCampaign", (_e, campaignId: string, format: "csv" | "xlsx") => {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const recipients = listRecipients(campaignId);

    const rows = recipients.map((r) => ({
      Email: r.email,
      Status: r.status,
      Attempts: r.attempts,
      LastAttempt: r.lastAttemptAt ?? "",
      SentAt: r.sentAt ?? "",
      ErrorReason: r.errorReason ?? "",
      FailureCategory: r.failureCategory ?? "",
      Duplicate: r.isDuplicate ? "yes" : "no",
    }));

    const dir = campaignExportsDir(campaignId);
    ensureDir(dir);
    ensureDir(EXPORTS_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${sanitizeName(campaign.name)}_${timestamp}.${format}`;
    const destPath = path.join(dir, filename);

    if (format === "csv") {
      const header = Object.keys(rows[0] ?? { Email: "", Status: "" }).join(",");
      const body = rows
        .map((row) =>
          Object.values(row)
            .map((v) => csvEscape(String(v)))
            .join(",")
        )
        .join("\n");
      fs.writeFileSync(destPath, `${header}\n${body}`, "utf-8");
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, destPath);
    }

    // Also drop a copy into the shared exports/ folder for convenience.
    const sharedPath = path.join(EXPORTS_DIR, filename);
    fs.copyFileSync(destPath, sharedPath);

    return { path: destPath, sharedPath };
  });

  ipcMain.handle("dashboard:stats", () => {
    const campaigns = listCampaigns();
    const master = sendlog.getMasterStats();
    return {
      totalCampaigns: campaigns.length,
      activeCampaign: campaigns.find((c) => c.status === "sending" || c.status === "paused") ?? null,
      recentCampaigns: campaigns.slice(0, 8),
      interruptedCount: campaigns.filter((c) => c.status === "interrupted").length,
      totalSent: master.totalSent,
      totalFailed: master.totalFailed,
    };
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
}
