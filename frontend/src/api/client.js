// src/api/client.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "https://web-production-e9298.up.railway.app";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 100000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error("API Error:", error.message, error.config?.url);
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────
//  КЭШ
// ─────────────────────────────────────────

const CACHE_PREFIX = "cache:";

async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCached(key, data) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {}
}

export function withCache(key, fetcher) {
  const cached = getCached(key);
  const fresh = fetcher().then(async (data) => {
    await setCached(key, data);
    return data;
  });
  return { cached, fresh };
}

// ─────────────────────────────────────────
//  SLEEP RECORDS
// ─────────────────────────────────────────

export const getSleepRecords = async (days = 30) => {
  const res = await api.get(`/api/sleep?days=${days}`);
  return res.data;
};

export const getSleepSummary = async () => {
  const res = await api.get("/api/sleep/summary");
  return res.data;
};

// ─────────────────────────────────────────
//  АНАЛИЗ
// ─────────────────────────────────────────

export const runAnalysis = async () => {
  const res = await api.post("/api/analyze");
  return res.data;
};

export const getAnomalies = async (days = 30) => {
  const res = await api.get(`/api/anomalies?days=${days}`);
  return res.data;
};

// ─────────────────────────────────────────
//  ДНЕВНИК
// ─────────────────────────────────────────

export const saveContext = async (data) => {
  const res = await api.post("/api/context", data);
  return res.data;
};

export const getContext = async (days = 30) => {
  const res = await api.get(`/api/context?days=${days}`);
  return res.data;
};

// ─────────────────────────────────────────
//  ДАННЫЕ
// ─────────────────────────────────────────

export const loadSimulation = async (days = 30) => {
  const res = await api.post(`/api/simulate?days=${days}`);
  return res.data;
};

/**
 * CSV upload через нативный fetch + FormData.
 * Никаких зависимостей от expo-file-system — работает в любой версии SDK.
 */
export const uploadCSV = async (fileUri, fileName) => {
  console.log("CSV upload:", fileName, fileUri);

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName || "data.csv",
    type: "text/csv",
  });

  const response = await fetch(`${BASE_URL}/api/upload/csv`, {
    method: "POST",
    body: formData,
    // Намеренно НЕ устанавливаем Content-Type — fetch добавит multipart boundary сам
  });

  const text = await response.text();
  console.log("CSV upload status:", response.status, text.substring(0, 200));

  if (!response.ok) {
    throw new Error(`Сервер вернул ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Некорректный ответ сервера: " + text);
  }
};

export default api;
