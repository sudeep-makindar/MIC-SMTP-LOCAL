import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import * as repo from "../db/templates.repo";
import { templateDir } from "../lib/paths";
import { detectPlaceholders } from "../lib/template-engine";
import { copyDirRecursive, ensureDir } from "../lib/fsutil";
import type { TemplateType } from "../../shared/types";

export function registerTemplateHandlers(): void {
  ipcMain.handle("templates:list", () => repo.listTemplates());

  ipcMain.handle("templates:read", (_e, id: string) => {
    const t = repo.getTemplate(id);
    if (!t) return null;
    return { ...t, body: fs.readFileSync(t.bodyPath, "utf-8") };
  });

  ipcMain.handle("templates:pickHtmlFile", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select HTML or HDB template file",
      filters: [
        { name: "Template files (*.hdb, *.html, *.htm, *.hbs)", extensions: ["hdb", "html", "htm", "hbs"] },
        { name: "HTML files (*.html, *.htm)", extensions: ["html", "htm"] },
        { name: "HDB files (*.hdb)", extensions: ["hdb"] },
        { name: "Handlebars files (*.hbs)", extensions: ["hbs"] },
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("templates:pickTextFile", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select plain-text template file",
      filters: [
        { name: "Text files (*.txt)", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("templates:pickBulkFiles", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select template files to bulk import (HDB, HTML, HBS, TXT)",
      filters: [
        { name: "Template files (*.hdb, *.html, *.htm, *.hbs, *.txt)", extensions: ["hdb", "html", "htm", "hbs", "txt"] },
        { name: "HDB files (*.hdb)", extensions: ["hdb"] },
        { name: "HTML files (*.html, *.htm)", extensions: ["html", "htm"] },
        { name: "Handlebars files (*.hbs)", extensions: ["hbs"] },
        { name: "Text files (*.txt)", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("templates:pickFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select folder containing template files",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return [];
    const folder = result.filePaths[0];
    const allowed = new Set([".hdb", ".html", ".htm", ".hbs", ".txt"]);
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowed.has(ext)) {
            files.push(path.join(folder, entry.name));
          }
        }
      }
    } catch (e) {
      console.error("Error reading directory for templates:", e);
    }
    return files;
  });

  ipcMain.handle("templates:pickAssetsFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: "Select assets folder (images, logos, banners)",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    "templates:import",
    (_e, params: { name: string; type: TemplateType; sourceFilePath: string; assetsFolderPath: string | null }) => {
      const id = uuid();
      const dir = templateDir(id);
      ensureDir(dir);

      const originalExt = path.extname(params.sourceFilePath);
      const ext = originalExt ? originalExt : (params.type === "html" ? ".html" : ".txt");
      const destBodyPath = path.join(dir, `body${ext}`);
      fs.copyFileSync(params.sourceFilePath, destBodyPath);

      let assetsPath: string | null = null;
      if (params.assetsFolderPath) {
        const destAssets = path.join(dir, "assets");
        copyDirRecursive(params.assetsFolderPath, destAssets);
        assetsPath = destAssets;
      }

      const bodyText = fs.readFileSync(destBodyPath, "utf-8");
      const placeholders = detectPlaceholders(bodyText);

      return repo.createTemplate(params.name.trim(), params.type, destBodyPath, assetsPath, placeholders);
    }
  );

  ipcMain.handle(
    "templates:bulkImport",
    (_e, items: Array<{ name: string; type: TemplateType; sourceFilePath: string; assetsFolderPath?: string | null }>) => {
      const createdTemplates = [];
      for (const item of items) {
        const id = uuid();
        const dir = templateDir(id);
        ensureDir(dir);

        const originalExt = path.extname(item.sourceFilePath);
        const ext = originalExt ? originalExt : (item.type === "html" ? ".html" : ".txt");
        const destBodyPath = path.join(dir, `body${ext}`);
        fs.copyFileSync(item.sourceFilePath, destBodyPath);

        let assetsPath: string | null = null;
        if (item.assetsFolderPath && fs.existsSync(item.assetsFolderPath)) {
          const destAssets = path.join(dir, "assets");
          copyDirRecursive(item.assetsFolderPath, destAssets);
          assetsPath = destAssets;
        }

        const bodyText = fs.readFileSync(destBodyPath, "utf-8");
        const placeholders = detectPlaceholders(bodyText);

        const created = repo.createTemplate(item.name.trim(), item.type, destBodyPath, assetsPath, placeholders);
        createdTemplates.push(created);
      }
      return createdTemplates;
    }
  );

  // Powers the in-app editor: creates a new template on first save (id is
  // null), or overwrites the body file + re-detects placeholders on
  // subsequent saves. Type is fixed at creation since it determines the
  // file extension and whether formatting controls apply.
  ipcMain.handle("templates:save", (_e, params: { id: string | null; name: string; type: TemplateType; body: string }) => {
    const placeholders = detectPlaceholders(params.body);

    if (params.id) {
      const t = repo.getTemplate(params.id);
      if (!t) throw new Error("Template not found");
      fs.writeFileSync(t.bodyPath, params.body, "utf-8");
      return repo.updateTemplateMeta(params.id, params.name, placeholders);
    }

    const id = uuid();
    const dir = templateDir(id);
    ensureDir(dir);
    const ext = params.type === "html" ? ".html" : ".txt";
    const destBodyPath = path.join(dir, `body${ext}`);
    fs.writeFileSync(destBodyPath, params.body, "utf-8");
    return repo.createTemplate(params.name, params.type, destBodyPath, null, placeholders);
  });

  ipcMain.handle("templates:delete", (_e, id: string) => {
    const t = repo.getTemplate(id);
    repo.deleteTemplate(id);
    if (t) {
      const dir = templateDir(id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
