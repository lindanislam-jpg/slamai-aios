import { db, type Tx } from "./db";
import { DEFAULT_PHOTO_CATEGORIES, DEFAULT_PRODUCTION_STAGES } from "./domain/constants";
import type { RolePermissionMap } from "./permissions";

/**
 * Release gate configuration. Every rule can be switched off, because not
 * every project needs every check — but switching one off is itself an
 * audited change made by an administrator.
 */
export interface ReleaseRules {
  requireFinalInspectionPass: boolean;
  requireNoUnresolvedInspections: boolean;
  requireNoOpenNcrs: boolean;
  requireNoOpenActions: boolean;
  requireMaterialsAccepted: boolean;
  requireCertificatesVerified: boolean;
  requireWeldsAccepted: boolean;
  requireNdtComplete: boolean;
  requiredPhotoCategories: string[];
  /** Project release needs every ITP Hold Point signed or marked not applicable. */
  requireHoldPointsSigned: boolean;
  allowConcession: boolean;
}

export interface UploadLimits {
  maxFileMb: number;
  maxFilesPerBatch: number;
}

export interface NotificationThresholds {
  ncrDueSoonDays: number;
  actionDueSoonDays: number;
  calibrationDueSoonDays: number;
  ndtOutstandingDays: number;
  quarantineReviewDays: number;
  /** Days after NCR closure before the effectiveness check is due (0 = off). */
  ncrEffectivenessDays: number;
}

/** Scheduled whole-system review (09:00, 12:00, 18:00 Europe/Dublin). */
export interface SystemMonitorSettings {
  enabled: boolean;
  /** Set the first time the monitor runs; earlier slots are never reported as missed. */
  enabledSince: string | null;
  /** A slot may still run this many hours late (e.g. after an outage); after that it is recorded as missed. */
  catchUpHours: number;
  /** Per-check time limit. */
  checkTimeoutSeconds: number;
  /** Run reports older than this are deleted (system reports only, never quality records). */
  retentionDays: number;
  /** Open alerts older than this are flagged overdue in the review. */
  alertOverdueDays: number;
  /** In-app recipients for scheduled review reports (user ids). Administrators always receive failures. */
  recipientUserIds: string[];
  /** "changes" = notify only on new issues, failures or escalations; "every" = every run. */
  notifyOn: "changes" | "every";
  /** Notify immediately on a critical technical failure or new critical quality alert. */
  escalateCritical: boolean;
}

export interface Vocabulary {
  photoCategories: string[];
  productionStages: string[];
}

export interface Branding {
  companyName: string;
  departmentName: string;
  reportFooter: string;
}

export const SETTING_DEFAULTS = {
  releaseRules: {
    requireFinalInspectionPass: true,
    requireNoUnresolvedInspections: true,
    requireNoOpenNcrs: true,
    requireNoOpenActions: true,
    requireMaterialsAccepted: true,
    requireCertificatesVerified: true,
    requireWeldsAccepted: true,
    requireNdtComplete: true,
    requiredPhotoCategories: ["Final inspection", "Completed module"],
    requireHoldPointsSigned: true,
    allowConcession: true,
  } satisfies ReleaseRules as ReleaseRules,
  uploadLimits: { maxFileMb: 25, maxFilesPerBatch: 40 } satisfies UploadLimits as UploadLimits,
  notificationThresholds: {
    ncrDueSoonDays: 3,
    actionDueSoonDays: 3,
    calibrationDueSoonDays: 30,
    ndtOutstandingDays: 7,
    quarantineReviewDays: 5,
    ncrEffectivenessDays: 30,
  } satisfies NotificationThresholds as NotificationThresholds,
  systemMonitor: {
    enabled: true,
    enabledSince: null,
    catchUpHours: 3,
    checkTimeoutSeconds: 20,
    retentionDays: 365,
    alertOverdueDays: 7,
    recipientUserIds: [],
    notifyOn: "changes",
    escalateCritical: true,
  } satisfies SystemMonitorSettings as SystemMonitorSettings,
  vocabulary: {
    photoCategories: [...DEFAULT_PHOTO_CATEGORIES],
    productionStages: [...DEFAULT_PRODUCTION_STAGES],
  } satisfies Vocabulary as Vocabulary,
  branding: {
    companyName: "ASGARD Modular Manufacturing",
    departmentName: "Quality Department",
    reportFooter: "Controlled when printed from the ASGARD Quality Command Centre. Verify revision before use.",
  } satisfies Branding as Branding,
  rolePermissions: null as RolePermissionMap | null,
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

export async function getSetting<K extends SettingKey>(key: K, client: Tx = db): Promise<SettingValue<K>> {
  const row = await client.setting.findUnique({ where: { key } });
  const fallback = SETTING_DEFAULTS[key];
  if (!row) return fallback;
  if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
    // Merge so settings saved by an older version gain new keys' defaults.
    return { ...fallback, ...(row.value as object) } as SettingValue<K>;
  }
  return row.value as SettingValue<K>;
}
