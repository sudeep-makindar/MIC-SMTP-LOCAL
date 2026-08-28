import { app, BrowserWindow, session, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initDb, closeDb } from "./db";
import { registerCampaignHandlers } from "./ipc/campaigns";
import { registerTemplateHandlers } from "./ipc/templates";
import { registerImportHandlers } from "./ipc/import";
import { registerRecipientHandlers } from "./ipc/recipients";
import { registerSmtpHandlers } from "./ipc/smtp";
import { registerPreviewHandlers } from "./ipc/preview";
import { registerPreflightHandlers } from "./ipc/preflight";
import { registerSendingHandlers } from "./ipc/sending";
import { registerLogHandlers } from "./ipc/logs";
import { registerBackupHandlers } from "./ipc/backup";
import { registerRecoveryHandlers } from "./ipc/recovery";
import { registerSettingsHandlers } from "./ipc/settings";
import { clearAll as clearAllCredentials } from "./lib/credential-store";

const isDev = process.env.NODE_ENV === "development";

// A plain file:// load fails to run Vite's ES-module output in production —
// Chromium blocks <script type="module"> under the file: origin via CORS.
// Serving the built renderer through a registered "app://" origin instead
// gives it a real origin the module loader accepts.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.on("console-message", (event) => {
    console.log(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
  });
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[renderer] process gone:`, details);
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL("app://local/index.html");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDb();

  if (!isDev) {
    const distDir = path.join(__dirname, "..", "..", "dist");
    protocol.handle("app", (request) => {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "" || pathname === "/") pathname = "/index.html";
      const filePath = path.join(distDir, pathname);
      if (!filePath.startsWith(distDir)) {
        return new Response("Forbidden", { status: 403 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }

  // Restrict outbound requests from renderer content (no cloud backend, no
  // remote resource loading beyond what local templates/assets need).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self' 'unsafe-inline' data: blob: file: app:;"],
      },
    });
  });

  registerCampaignHandlers();
  registerTemplateHandlers();
  registerImportHandlers();
  registerRecipientHandlers();
  registerSmtpHandlers();
  registerPreviewHandlers();
  registerPreflightHandlers();
  registerSendingHandlers(() => mainWindow);
  registerLogHandlers();
  registerBackupHandlers();
  registerRecoveryHandlers();
  registerSettingsHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  clearAllCredentials();
  closeDb();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  clearAllCredentials();
});
