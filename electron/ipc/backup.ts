import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { BACKUPS_DIR, CAMPAIGNS_DIR, TEMPLATES_DIR, DATABASE_DIR, DATA_ROOT } from "../lib/paths";
import { copyDirRecursive, ensureDir } from "../lib/fsutil";
import { listCampaigns } from "../db/campaigns.repo";
import { listTemplates } from "../db/templates.repo";
import type { BackupManifest } from "../../shared/types";

export function registerBackupHandlers(): void {
  ipcMain.handle("backup:create", () => {
    ensureDir(BACKUPS_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(BACKUPS_DIR, `backup_${timestamp}`);
    ensureDir(dest);

    // SMTP passwords are never written to disk anywhere in this app, so a
    // plain copy of the database and campaign/template folders cannot leak
    // credentials.
    copyDirRecursive(DATABASE_DIR, path.join(dest, "database"));
    copyDirRecursive(CAMPAIGNS_DIR, path.join(dest, "campaigns"));
    copyDirRecursive(TEMPLATES_DIR, path.join(dest, "templates"));

    const manifest: BackupManifest = {
      createdAt: new Date().toISOString(),
      appVersion: "0.1.0",
      campaignIds: listCampaigns().map((c) => c.id),
      templateIds: listTemplates().map((t) => t.id),
    };
    fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    return { path: dest };
  });

  ipcMain.handle("backup:list", () => {
    ensureDir(BACKUPS_DIR);
    return fs
      .readdirSync(BACKUPS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const manifestPath = path.join(BACKUPS_DIR, e.name, "manifest.json");
        let manifest: BackupManifest | null = null;
        if (fs.existsSync(manifestPath)) {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        }
        return { name: e.name, path: path.join(BACKUPS_DIR, e.name), manifest };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  });

  ipcMain.handle("backup:pickFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select a backup folder to restore",
      defaultPath: BACKUPS_DIR,
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("backup:restore", (_e, backupPath: string) => {
    const manifestPath = path.join(backupPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("Not a valid backup folder (missing manifest.json).");

    // Note: caller must restart the app after restore since the DB
    // connection held by the running process would otherwise be stale.
    const dbDir = path.join(backupPath, "database");
    const campaignsDir = path.join(backupPath, "campaigns");
    const templatesDir = path.join(backupPath, "templates");

    if (fs.existsSync(dbDir)) {
      fs.rmSync(DATABASE_DIR, { recursive: true, force: true });
      copyDirRecursive(dbDir, DATABASE_DIR);
    }
    if (fs.existsSync(campaignsDir)) {
      fs.rmSync(CAMPAIGNS_DIR, { recursive: true, force: true });
      copyDirRecursive(campaignsDir, CAMPAIGNS_DIR);
    }
    if (fs.existsSync(templatesDir)) {
      fs.rmSync(TEMPLATES_DIR, { recursive: true, force: true });
      copyDirRecursive(templatesDir, TEMPLATES_DIR);
    }
    return { restored: true, dataRoot: DATA_ROOT };
  });
}
