import { contextBridge, ipcRenderer } from "electron";

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api = {
  campaigns: {
    list: () => invoke("campaigns:list"),
    get: (id: string) => invoke("campaigns:get", id),
    create: (name: string, description: string) => invoke("campaigns:create", name, description),
    clone: (id: string) => invoke("campaigns:clone", id),
    update: (id: string, update: unknown) => invoke("campaigns:update", id, update),
    delete: (id: string) => invoke("campaigns:delete", id),
    listInterrupted: () => invoke("campaigns:listInterrupted"),
    recipientStats: (id: string) => invoke("campaigns:recipientStats", id),
  },
  templates: {
    list: () => invoke("templates:list"),
    read: (id: string) => invoke("templates:read", id),
    pickHtmlFile: () => invoke("templates:pickHtmlFile"),
    pickTextFile: () => invoke("templates:pickTextFile"),
    pickBulkFiles: () => invoke("templates:pickBulkFiles"),
    pickFolder: () => invoke("templates:pickFolder"),
    pickAssetsFolder: () => invoke("templates:pickAssetsFolder"),
    import: (params: unknown) => invoke("templates:import", params),
    bulkImport: (items: unknown[]) => invoke("templates:bulkImport", items),
    save: (params: unknown) => invoke("templates:save", params),
    delete: (id: string) => invoke("templates:delete", id),
  },
  import: {
    pickFile: () => invoke("import:pickFile"),
    parse: (campaignId: string, filePath: string) => invoke("import:parse", campaignId, filePath),
    recheckColumn: (campaignId: string, emailColumn: string) => invoke("import:recheckColumn", campaignId, emailColumn),
    commit: (params: unknown) => invoke("import:commit", params),
  },
  recipients: {
    list: (campaignId: string) => invoke("recipients:list", campaignId),
    excludeDuplicates: (campaignId: string) => invoke("recipients:excludeDuplicates", campaignId),
    excludeRecent: (campaignId: string, hours: number) => invoke("recipients:excludeRecent", campaignId, hours),
    exclude: (ids: string[]) => invoke("recipients:exclude", ids),
    pickStaticAttachment: (campaignId: string) => invoke("recipients:pickStaticAttachment", campaignId),
  },
  smtp: {
    list: () => invoke("smtp:list"),
    upsert: (input: unknown, id?: string) => invoke("smtp:upsert", input, id),
    delete: (id: string) => invoke("smtp:delete", id),
    setPassword: (id: string, password: string) => invoke("smtp:setPassword", id, password),
    hasPassword: (id: string) => invoke("smtp:hasPassword", id),
    testConnection: (id: string) => invoke("smtp:testConnection", id),
    sendTestEmail: (params: unknown) => invoke("smtp:sendTestEmail", params),
  },
  preview: {
    renderRecipient: (campaignId: string, recipientId: string) => invoke("preview:renderRecipient", campaignId, recipientId),
    randomSample: (campaignId: string, count: number) => invoke("preview:randomSample", campaignId, count),
  },
  preflight: {
    run: (campaignId: string) => invoke("preflight:run", campaignId),
  },
  sending: {
    start: (campaignId: string, options?: unknown) => invoke("sending:start", campaignId, options),
    pause: (campaignId: string) => invoke("sending:pause", campaignId),
    stop: (campaignId: string) => invoke("sending:stop", campaignId),
    resume: (campaignId: string) => invoke("sending:resume", campaignId),
    getNextPending: (campaignId: string) => invoke("sending:getNextPending", campaignId),
    manualSendNext: (campaignId: string) => invoke("sending:manualSendNext", campaignId),
    manualSkipNext: (campaignId: string) => invoke("sending:manualSkipNext", campaignId),
    retryFailed: (campaignId: string, recipientIds?: string[]) => invoke("sending:retryFailed", campaignId, recipientIds),
    cancel: (campaignId: string) => invoke("sending:cancel", campaignId),
    onProgress: (callback: (progress: unknown) => void) => {
      const listener = (_e: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on("sending:progress", listener);
      return () => ipcRenderer.removeListener("sending:progress", listener);
    },
  },
  logs: {
    search: (filters: unknown) => invoke("logs:search", filters),
    recipientHistory: (email: string) => invoke("logs:recipientHistory", email),
    masterStats: () => invoke("logs:masterStats"),
    exportCampaign: (campaignId: string, format: "csv" | "xlsx") => invoke("logs:exportCampaign", campaignId, format),
  },
  dashboard: {
    stats: () => invoke("dashboard:stats"),
  },
  backup: {
    create: () => invoke("backup:create"),
    list: () => invoke("backup:list"),
    pickFolder: () => invoke("backup:pickFolder"),
    restore: (backupPath: string) => invoke("backup:restore", backupPath),
  },
  recovery: {
    check: () => invoke("recovery:check"),
    decide: (campaignId: string, decision: "resume" | "restart" | "discard") => invoke("recovery:decide", campaignId, decision),
  },
  settings: {
    get: (key: string) => invoke("settings:get", key),
    set: (key: string, value: string) => invoke("settings:set", key, value),
    dataRoot: () => invoke("settings:dataRoot"),
    openDataFolder: () => invoke("settings:openDataFolder"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
