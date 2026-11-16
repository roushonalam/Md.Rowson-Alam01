import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearSessionApiKey,
  fetchHealth,
  fetchModels,
  registerSessionApiKey,
} from '../lib/api.ts';
import {
  DEFAULT_APP_SETTINGS,
  loadSavedSettings,
  saveSettingsPreferences,
} from '../lib/storage.ts';
import type {
  AppSettings,
  ConnectionState,
  HealthResponse,
  ModelInfo,
  ToastMessage,
} from '../types/index.ts';

interface SettingsContextValue {
  settings: AppSettings;
  health: HealthResponse | null;
  connectionState: ConnectionState;
  models: ModelInfo[];
  modelsLoading: boolean;
  defaultModel: string;
  maskedSessionKey: string | null;
  toasts: ToastMessage[];
  updateDraftSettings: (next: Partial<AppSettings>) => void;
  saveSettings: (override?: AppSettings) => void;
  refreshHealthAndModels: () => Promise<void>;
  applySessionKey: (apiKey: string) => Promise<void>;
  removeSessionKey: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSavedSettings());
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('not_configured');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [maskedSessionKey, setMaskedSessionKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  const refreshHealthAndModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const healthData = await fetchHealth();
      setHealth(healthData);
      setDefaultModel(healthData.defaultModel);
      setConnectionState(healthData.status);

      const modelsData = await fetchModels();
      setModels(modelsData.models);
      if (modelsData.defaultModel) {
        setDefaultModel(modelsData.defaultModel);
      }

      setSettings((prev) => {
        if (!prev.model && (modelsData.defaultModel || modelsData.models[0]?.id)) {
          return {
            ...prev,
            model: modelsData.defaultModel || modelsData.models[0]?.id || '',
          };
        }
        return prev;
      });
    } catch {
      setConnectionState('error');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealthAndModels();
  }, [refreshHealthAndModels]);

  const updateDraftSettings = useCallback((next: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...next,
    }));
  }, []);

  const saveSettings = useCallback(
    (override?: AppSettings) => {
      const target = override ?? settings;
      const sanitized: AppSettings = {
        model: target.model || defaultModel || DEFAULT_APP_SETTINGS.model,
        temperature: Math.min(0.7, Math.max(0.2, Number(target.temperature.toFixed(2)))),
      };
      setSettings(sanitized);
      saveSettingsPreferences(sanitized);
      addToast({
        variant: 'success',
        title: 'Settings saved',
        description: 'Model and temperature preferences updated.',
      });
    },
    [settings, defaultModel, addToast]
  );

  const applySessionKey = useCallback(
    async (apiKey: string) => {
      const res = await registerSessionApiKey(apiKey);
      setMaskedSessionKey(res.maskedHint);
      await refreshHealthAndModels();
      addToast({
        variant: 'success',
        title: 'Session API key active',
        description: `Key ${res.maskedHint} is stored in server memory for this session only.`,
      });
    },
    [refreshHealthAndModels, addToast]
  );

  const removeSessionKey = useCallback(async () => {
    await clearSessionApiKey();
    setMaskedSessionKey(null);
    await refreshHealthAndModels();
    addToast({
      variant: 'info',
      title: 'Session API key cleared',
      description: 'Removed from server memory.',
    });
  }, [refreshHealthAndModels, addToast]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        health,
        connectionState,
        models,
        modelsLoading,
        defaultModel,
        maskedSessionKey,
        toasts,
        updateDraftSettings,
        saveSettings,
        refreshHealthAndModels,
        applySessionKey,
        removeSessionKey,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}
