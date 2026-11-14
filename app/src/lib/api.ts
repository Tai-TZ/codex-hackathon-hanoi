import Constants from 'expo-constants';

import { photoBase64 } from '@/lib/photo';

import type { ChatResponse, HealthResponse } from '@/types/chat';
import type { AskEvent, ChildReply, ConfirmResponse } from '@/types/hoicon';

const BACKEND_PORT = 8000;
const CHAT_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;
const ASK_TIMEOUT_MS = 90_000;
const POLL_TIMEOUT_MS = 8_000;

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
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(await errorDetail(res));
    return (await res.json()) as T;
  } catch (e) {
    if (controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
      throw new Error('Mạng đang chậm, chưa có câu trả lời. Bấm thử lại nhé.');
    }
    if (e instanceof TypeError) {
      throw new Error(`Chưa kết nối được máy chủ (${API_BASE}). Kiểm tra mạng rồi thử lại nhé.`);
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

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Gửi ảnh hoặc chữ cho agent. `imageUri` là đường dẫn ảnh JPEG trên máy. */
export function ask(input: {
  imageUri?: string;
  text?: string;
  familyId: string;
  threadId?: string | null;
}): Promise<AskEvent> {
  const imageBase64 = input.imageUri ? photoBase64(input.imageUri) : undefined;
  if (input.imageUri && !imageBase64) {
    return Promise.reject(new Error('Con chưa đọc được ảnh. Mẹ chụp lại giúp con nhé.'));
  }
  return request<AskEvent>('/api/v1/ask-json', ASK_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64 ?? null,
      text: input.text ?? null,
      family_id: input.familyId,
      thread_id: input.threadId ?? null,
    }),
  });
}

export async function getEvents(familyId: string): Promise<AskEvent[]> {
  const data = await request<{ events: AskEvent[] }>(
    `/api/v1/events?family_id=${encodeURIComponent(familyId)}`,
    POLL_TIMEOUT_MS,
  );
  return data.events;
}

export function postReply(input: {
  familyId: string;
  eventId: string;
  text: string;
  fromName: string;
}): Promise<{ ok: boolean; id: number }> {
  return request('/api/v1/reply', POLL_TIMEOUT_MS, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      family_id: input.familyId,
      event_id: input.eventId,
      text: input.text,
      from_name: input.fromName,
    }),
  });
}

export async function getReplies(familyId: string, after: number): Promise<ChildReply[]> {
  const data = await request<{ replies: ChildReply[] }>(
    `/api/v1/replies?family_id=${encodeURIComponent(familyId)}&after=${after}`,
    POLL_TIMEOUT_MS,
  );
  return data.replies;
}

/**
 * Nhờ backend tạo giọng đọc tự nhiên cho một câu; trả đường dẫn file âm thanh để phát.
 * Lỗi hoặc quá `timeoutMs` thì ném lỗi để nơi gọi quay về giọng có sẵn của máy.
 */
export async function requestSpeech(text: string, timeoutMs: number): Promise<string> {
  const data = await request<{ id: string }>('/api/v1/tts', timeoutMs, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ text: text.slice(0, 1500) }),
  });
  return `${API_BASE}/api/v1/tts/${data.id}.wav`;
}

export function confirmPrescription(eventId: string, answers: Record<string, string>): Promise<ConfirmResponse> {
  return request<ConfirmResponse>('/api/v1/confirm', ASK_TIMEOUT_MS, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ event_id: eventId, answers }),
  });
}

/** Ghép đường dẫn ảnh tương đối của backend thành địa chỉ đầy đủ. */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}
