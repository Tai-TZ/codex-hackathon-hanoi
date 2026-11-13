import Constants from 'expo-constants';

import type { ChatResponse, HealthResponse } from '@/types/chat';

const BACKEND_PORT = 8000;
const CHAT_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;

/** Token khớp APP_TOKEN của backend public. Bỏ trống khi dev với backend trên máy. */
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN ?? '';

/**
 * Địa chỉ backend:
 * - Có EXPO_PUBLIC_API_URL (file .env) thì dùng nó. Bản Release bắt buộc phải có,
 *   vì giá trị được đóng cứng vào app lúc build.
 * - Khi dev, mặc định gọi tới máy đang chạy Metro (cũng là máy chạy backend),
 *   nên simulator và điện thoại thật cùng wifi đều gọi được mà không cần cấu hình.
 */
function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${metroHost ?? 'localhost'}:${BACKEND_PORT}`;
}

export const API_BASE = resolveApiBase();

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    // Body không phải JSON: dùng thông báo chung bên dưới.
  }
  return `Yêu cầu thất bại (HTTP ${res.status})`;
}

async function request<T>(path: string, timeoutMs: number, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init?.headers);
    if (APP_TOKEN) headers.set('X-App-Token', APP_TOKEN);
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
    if (!res.ok) throw new Error(await errorDetail(res));
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Backend phản hồi quá lâu, thử lại sau.');
    }
    if (e instanceof TypeError) {
      throw new Error(`Không kết nối được backend tại ${API_BASE}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function sendMessage(message: string, threadId: string | null): Promise<ChatResponse> {
  return request<ChatResponse>('/api/v1/chat', CHAT_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, thread_id: threadId }),
  });
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', HEALTH_TIMEOUT_MS);
}
