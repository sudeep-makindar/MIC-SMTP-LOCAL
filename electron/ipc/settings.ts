import { ipcMain, shell } from "electron";
import * as settingsRepo from "../db/settings.repo";
import { DATA_ROOT } from "../lib/paths";

export function registerSettingsHandlers(): void {
  ipcMain.handle("settings:get", (_e, key: string) => settingsRepo.getSetting(key));
  ipcMain.handle("settings:set", (_e, key: string, value: string) => settingsRepo.setSetting(key, value));
  ipcMain.handle("settings:dataRoot", () => DATA_ROOT);
  ipcMain.handle("settings:openDataFolder", () => shell.openPath(DATA_ROOT));
}
