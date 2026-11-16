import type { AppSettings, TutorMessage } from '../types/index.ts';

const SETTINGS_STORAGE_KEY = 'edugenius_preferences_v1';
const TUTOR_HISTORY_STORAGE_KEY = 'edugenius_tutor_history_v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  model: '',
  temperature: 0.4,
};

export function loadSavedSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const temp =
      typeof parsed.temperature === 'number' &&
      parsed.temperature >= 0.2 &&
      parsed.temperature <= 0.7
        ? Number(parsed.temperature.toFixed(2))
        : 0.4;
    const model = typeof parsed.model === 'string' ? parsed.model.trim() : '';
    return { model, temperature: temp };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveSettingsPreferences(settings: AppSettings): void {
  // Store strictly non-secret preferences (never store API keys)
  const sanitized: AppSettings = {
    model: settings.model.trim(),
    temperature: Math.min(0.7, Math.max(0.2, Number(settings.temperature.toFixed(2)))),
  };
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
}

export function loadTutorHistory(): TutorMessage[] {
  try {
    const raw = window.localStorage.getItem(TUTOR_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is TutorMessage =>
          typeof m === 'object' &&
          m !== null &&
          typeof m.id === 'string' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .slice(-40);
  } catch {
    return [];
  }
}

export function saveTutorHistory(messages: TutorMessage[]): void {
  try {
    // Strip transient error objects before persisting clean chat text
    const clean = messages.slice(-40).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      ...(m.studyPlan ? { studyPlan: m.studyPlan } : {}),
    }));
    window.localStorage.setItem(TUTOR_HISTORY_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearTutorHistory(): void {
  window.localStorage.removeItem(TUTOR_HISTORY_STORAGE_KEY);
}
