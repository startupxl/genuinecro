const SETTINGS_KEY = "genuinecro_settings";

export interface UserSettings {
  emailNotifications: boolean;
  analysisAlerts: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  defaultDevice: "desktop" | "mobile" | "both";
  autoDetectPageType: boolean;
  language: string;
}

export const defaultSettings: UserSettings = {
  emailNotifications: true,
  analysisAlerts: true,
  weeklyDigest: false,
  marketingEmails: false,
  defaultDevice: "desktop",
  autoDetectPageType: true,
  language: "en",
};

export function getUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // ignore malformed storage, fall through to defaults
  }
  return defaultSettings;
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
