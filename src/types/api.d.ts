import type {
  Campaign,
  Recipient,
  Template,
  TemplateType,
  SmtpProfile,
  SmtpSecurity,
  ImportSummary,
  ColumnMapping,
  PlaceholderMapping,
  AttachmentConfig,
  PreflightReport,
  SendProgress,
  RenderedEmail,
  SendLogEntry,
  FailureCategory,
  BackupManifest,
} from "@shared/types";

export interface SmtpProfileInput {
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromName: string;
  fromEmail: string;
}

export interface SmtpTestResult {
  ok: boolean;
  category?: FailureCategory;
  message?: string;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

export interface LogSearchFilters {
  email?: string;
  campaignId?: string;
  subject?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaign: Campaign | null;
  recentCampaigns: Campaign[];
  interruptedCount: number;
  totalSent: number;
  totalFailed: number;
}

export interface CampaignRecipientStats {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface Api {
  campaigns: {
    list: () => Promise<Campaign[]>;
    get: (id: string) => Promise<Campaign | null>;
    create: (name: string, description: string) => Promise<Campaign>;
    update: (id: string, update: Partial<Campaign>) => Promise<Campaign>;
    delete: (id: string) => Promise<void>;
    listInterrupted: () => Promise<Campaign[]>;
    recipientStats: (id: string) => Promise<CampaignRecipientStats>;
  };
  templates: {
    list: () => Promise<Template[]>;
    read: (id: string) => Promise<(Template & { body: string }) | null>;
    pickHtmlFile: () => Promise<string | null>;
    pickTextFile: () => Promise<string | null>;
    pickBulkFiles: () => Promise<string[]>;
    pickFolder: () => Promise<string[]>;
    pickAssetsFolder: () => Promise<string | null>;
    import: (params: {
      name: string;
      type: TemplateType;
      sourceFilePath: string;
      assetsFolderPath: string | null;
    }) => Promise<Template>;
    bulkImport: (items: Array<{
      name: string;
      type: TemplateType;
      sourceFilePath: string;
      assetsFolderPath?: string | null;
    }>) => Promise<Template[]>;
    save: (params: { id: string | null; name: string; type: TemplateType; body: string }) => Promise<Template>;
    delete: (id: string) => Promise<void>;
  };
  import: {
    pickFile: () => Promise<string | null>;
    parse: (campaignId: string, filePath: string) => Promise<ImportSummary>;
    recheckColumn: (campaignId: string, emailColumn: string) => Promise<ImportSummary>;
    commit: (params: {
      campaignId: string;
      columnMapping: ColumnMapping;
      placeholderMapping: PlaceholderMapping;
      attachmentConfig: AttachmentConfig;
    }) => Promise<void>;
  };
  recipients: {
    list: (campaignId: string) => Promise<Recipient[]>;
    excludeDuplicates: (campaignId: string) => Promise<unknown>;
    excludeRecent: (campaignId: string, hours: number) => Promise<unknown>;
    exclude: (ids: string[]) => Promise<void>;
    pickStaticAttachment: (campaignId: string) => Promise<string | null>;
  };
  smtp: {
    list: () => Promise<SmtpProfile[]>;
    upsert: (input: SmtpProfileInput, id?: string) => Promise<SmtpProfile>;
    delete: (id: string) => Promise<void>;
    setPassword: (id: string, password: string) => Promise<void>;
    hasPassword: (id: string) => Promise<boolean>;
    testConnection: (id: string) => Promise<SmtpTestResult>;
    sendTestEmail: (params: {
      campaignId: string;
      smtpProfileId: string;
      testRecipient: string;
      sampleRecipientId: string | null;
    }) => Promise<SmtpTestResult>;
  };
  preview: {
    renderRecipient: (campaignId: string, recipientId: string) => Promise<RenderedEmail>;
    randomSample: (campaignId: string, count: number) => Promise<Recipient[]>;
  };
  preflight: {
    run: (campaignId: string) => Promise<PreflightReport>;
  };
  sending: {
    start: (campaignId: string) => Promise<{ started: boolean }>;
    pause: (campaignId: string) => Promise<void>;
    stop: (campaignId: string) => Promise<void>;
    resume: (campaignId: string) => Promise<{ started: boolean }>;
    getNextPending: (campaignId: string) => Promise<Recipient | null>;
    manualSendNext: (campaignId: string) => Promise<{ done: boolean }>;
    manualSkipNext: (campaignId: string) => Promise<{ done: boolean }>;
    retryFailed: (campaignId: string, recipientIds?: string[]) => Promise<unknown>;
    cancel: (campaignId: string) => Promise<void>;
    onProgress: (callback: (progress: SendProgress) => void) => () => void;
  };
  logs: {
    search: (filters: LogSearchFilters) => Promise<SendLogEntry[]>;
    recipientHistory: (email: string) => Promise<SendLogEntry[]>;
    masterStats: () => Promise<{ totalSent: number; totalFailed: number }>;
    exportCampaign: (campaignId: string, format: "csv" | "xlsx") => Promise<{ path: string; sharedPath: string }>;
  };
  dashboard: {
    stats: () => Promise<DashboardStats>;
  };
  backup: {
    create: () => Promise<{ path: string }>;
    list: () => Promise<{ name: string; path: string; manifest: BackupManifest | null }[]>;
    pickFolder: () => Promise<string | null>;
    restore: (backupPath: string) => Promise<{ restored: boolean; dataRoot: string }>;
  };
  recovery: {
    check: () => Promise<Campaign[]>;
    decide: (campaignId: string, decision: "resume" | "restart" | "discard") => Promise<Campaign>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    dataRoot: () => Promise<string>;
    openDataFolder: () => Promise<void>;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}

export {};
