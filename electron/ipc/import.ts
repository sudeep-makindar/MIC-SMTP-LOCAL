import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { parseSpreadsheet, detectEmailColumn, type ParsedSpreadsheet } from "../lib/import-parser";
import { isValidEmail, findDuplicateEmails } from "../lib/validators";
import { campaignInputDir } from "../lib/paths";
import { ensureDir } from "../lib/fsutil";
import { replaceRecipients, recomputeCampaignStats } from "../db/recipients.repo";
import { updateCampaign } from "../db/campaigns.repo";
import type { ImportSummary, ColumnMapping, PlaceholderMapping, AttachmentConfig } from "../../shared/types";

// Cache of the most recently parsed spreadsheet per campaign, so the column
// mapping step can be adjusted interactively without re-reading the file.
const parseCache = new Map<string, { filePath: string; data: ParsedSpreadsheet }>();

export function registerImportHandlers(): void {
  ipcMain.handle("import:pickFile", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select recipient file",
      filters: [{ name: "Spreadsheets", extensions: ["csv", "xlsx", "xls"] }],
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("import:parse", (_e, campaignId: string, filePath: string): ImportSummary => {
    const data = parseSpreadsheet(filePath);
    parseCache.set(campaignId, { filePath, data });

    const detectedEmailColumn = detectEmailColumn(data.columns, data.rows);
    const stats = computeStats(data, detectedEmailColumn);

    return {
      totalRows: data.rows.length,
      totalColumns: data.columns.length,
      columns: data.columns,
      preview: data.rows.slice(0, 10),
      detectedEmailColumn,
      duplicateEmailCount: stats.duplicateEmailCount,
      invalidEmailCount: stats.invalidEmailCount,
      missingRequiredCount: stats.missingRequiredCount,
    };
  });

  ipcMain.handle("import:recheckColumn", (_e, campaignId: string, emailColumn: string): ImportSummary => {
    const cached = parseCache.get(campaignId);
    if (!cached) throw new Error("No import in progress for this campaign. Please re-select the file.");
    const stats = computeStats(cached.data, emailColumn);
    return {
      totalRows: cached.data.rows.length,
      totalColumns: cached.data.columns.length,
      columns: cached.data.columns,
      preview: cached.data.rows.slice(0, 10),
      detectedEmailColumn: emailColumn,
      duplicateEmailCount: stats.duplicateEmailCount,
      invalidEmailCount: stats.invalidEmailCount,
      missingRequiredCount: stats.missingRequiredCount,
    };
  });

  ipcMain.handle(
    "import:commit",
    (
      _e,
      params: {
        campaignId: string;
        columnMapping: ColumnMapping;
        placeholderMapping: PlaceholderMapping;
        attachmentConfig: AttachmentConfig;
      }
    ) => {
      const cached = parseCache.get(params.campaignId);
      if (!cached) throw new Error("No import in progress for this campaign. Please re-select the file.");
      const emailColumn = params.columnMapping.emailColumn;
      if (!emailColumn) throw new Error("An email column must be selected before importing.");

      const dupReport = findDuplicateEmails(
        cached.data.rows.map((row, idx) => ({ rowIndex: idx, email: row[emailColumn] ?? "" }))
      );
      const dupIndexSet = new Set(dupReport.duplicateIndices);

      const attachmentColumn = params.attachmentConfig.mode === "per_recipient" ? params.attachmentConfig.columnName : null;

      replaceRecipients(
        params.campaignId,
        cached.data.rows.map((row, idx) => ({
          rowIndex: idx,
          data: row,
          email: (row[emailColumn] ?? "").trim(),
          attachmentPath: attachmentColumn ? row[attachmentColumn] ?? null : null,
          isDuplicate: dupIndexSet.has(idx),
        }))
      );

      // Persist a copy of the input file into the campaign folder for
      // reproducibility (per the file-structure requirement).
      const inputDir = campaignInputDir(params.campaignId);
      ensureDir(inputDir);
      const destFile = path.join(inputDir, path.basename(cached.filePath));
      fs.copyFileSync(cached.filePath, destFile);

      updateCampaign(params.campaignId, {
        recipientFileName: path.basename(cached.filePath),
        columnMapping: params.columnMapping,
        placeholderMapping: params.placeholderMapping,
        attachmentConfig: params.attachmentConfig,
      });
      recomputeCampaignStats(params.campaignId);
      parseCache.delete(params.campaignId);
    }
  );
}

function computeStats(data: ParsedSpreadsheet, emailColumn: string | null) {
  if (!emailColumn) {
    return { duplicateEmailCount: 0, invalidEmailCount: 0, missingRequiredCount: data.rows.length };
  }
  let invalidEmailCount = 0;
  let missingRequiredCount = 0;
  const rows = data.rows.map((row, idx) => {
    const email = (row[emailColumn] ?? "").trim();
    if (!email) missingRequiredCount++;
    else if (!isValidEmail(email)) invalidEmailCount++;
    return { rowIndex: idx, email };
  });
  const dupReport = findDuplicateEmails(rows);
  return {
    duplicateEmailCount: dupReport.duplicateIndices.length,
    invalidEmailCount,
    missingRequiredCount,
  };
}
