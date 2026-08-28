import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

// Central resolver for the local-first data directory. In dev, data/ lives at
// the project root so it's easy to inspect. In a packaged build, it lives
// under the OS user-data directory since the install directory may be
// read-only.
function resolveDataRoot(): string {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "data");
  }
  // Compiled output lives at <project-root>/dist-electron/electron/lib/paths.js,
  // so climb three levels back to the project root, not two.
  return path.join(__dirname, "..", "..", "..", "data");
}

export const DATA_ROOT = resolveDataRoot();
export const CAMPAIGNS_DIR = path.join(DATA_ROOT, "campaigns");
export const TEMPLATES_DIR = path.join(DATA_ROOT, "templates");
export const DATABASE_DIR = path.join(DATA_ROOT, "database");
export const BACKUPS_DIR = path.join(DATA_ROOT, "backups");
export const EXPORTS_DIR = path.join(DATA_ROOT, "exports");

export function ensureDataDirs(): void {
  for (const dir of [DATA_ROOT, CAMPAIGNS_DIR, TEMPLATES_DIR, DATABASE_DIR, BACKUPS_DIR, EXPORTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function campaignDir(campaignId: string): string {
  return path.join(CAMPAIGNS_DIR, campaignId);
}

export function campaignInputDir(campaignId: string): string {
  return path.join(campaignDir(campaignId), "input");
}

export function campaignAttachmentsDir(campaignId: string): string {
  return path.join(campaignDir(campaignId), "attachments");
}

export function campaignExportsDir(campaignId: string): string {
  return path.join(campaignDir(campaignId), "exports");
}

export function templateDir(templateId: string): string {
  return path.join(TEMPLATES_DIR, templateId);
}
