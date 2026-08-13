import AsyncStorage from "@react-native-async-storage/async-storage";

const CONFIG_URL =
  "https://raw.githubusercontent.com/brianMugatsia/lec_backend/main/lecturermind-config.json";

const CACHE_KEY = "lecturermind_app_config_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
}

const DEFAULT_CONFIG: AppConfig = {
  apiUrl: "https://lecturemind.roberms.com",
  wsUrl: "wss://lecturemind.roberms.com",
};

interface CachedConfig {
  config: AppConfig;
  fetchedAt: number;
}

let currentConfig: AppConfig = DEFAULT_CONFIG;
let initPromise: Promise<AppConfig> | null = null;

async function loadCache(): Promise<CachedConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedConfig) : null;
  } catch {
    return null;
  }
}

async function saveCache(config: AppConfig) {
  try {
    const payload: CachedConfig = { config, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("⚠️ Failed to cache LecturerMind config:", err);
  }
}

function isValidConfig(data: any): data is AppConfig {
  return (
    data &&
    typeof data.apiUrl === "string" &&
    typeof data.wsUrl === "string" &&
    data.apiUrl.startsWith("http") &&
    (data.wsUrl.startsWith("ws://") || data.wsUrl.startsWith("wss://"))
  );
}

async function fetchRemoteConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    const data = await res.json();
    if (!isValidConfig(data)) throw new Error("Malformed config JSON");
    return { apiUrl: data.apiUrl, wsUrl: data.wsUrl };
  } catch (err) {
    console.warn("⚠️ Could not fetch remote LecturerMind config:", err);
    return null;
  }
}

export async function initConfig(): Promise<AppConfig> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const cached = await loadCache();

    if (cached) {
      currentConfig = cached.config;
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        refreshConfig();
      }
      return currentConfig;
    }

    const remote = await fetchRemoteConfig();
    if (remote) {
      currentConfig = remote;
      await saveCache(remote);
    }
    return currentConfig;
  })();

  return initPromise;
}

export async function refreshConfig() {
  const remote = await fetchRemoteConfig();
  if (remote) {
    currentConfig = remote;
    await saveCache(remote);
  }
}

export function getApiUrl(): string {
  return currentConfig.apiUrl;
}

export function getWsUrl(): string {
  return currentConfig.wsUrl;
}

export function getConfig(): AppConfig {
  return currentConfig;
}