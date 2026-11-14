import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { ChildReply } from '@/types/hoicon';

/**
 * Câu con nhắn gần nhất, lưu trên máy để mẹ xem lại ở màn hình chính
 * kể cả khi đã đóng thẻ trả lời hoặc tắt hẳn app rồi mở lại.
 */
const KEY = 'hoicon.lastReply';
// Sau từng này thời gian thì thôi hiện, để mẹ không nhầm là con vừa nhắn.
const SHOW_FOR_MS = 6 * 60 * 60 * 1000;

let current: ChildReply | null = null;
const listeners = new Set<(reply: ChildReply | null) => void>();

export function spokenReply(reply: ChildReply): string {
  return `Con vừa trả lời: ${reply.text}`;
}

export function saveLastReply(reply: ChildReply): void {
  current = reply;
  listeners.forEach((listener) => listener(reply));
  AsyncStorage.setItem(KEY, JSON.stringify(reply)).catch(() => undefined);
}

export function clearLastReply(): Promise<void> {
  current = null;
  listeners.forEach((listener) => listener(null));
  return AsyncStorage.removeItem(KEY);
}

function isRecent(reply: ChildReply | null): reply is ChildReply {
  return !!reply && Date.now() - Date.parse(reply.at) < SHOW_FOR_MS;
}

export function useLastReply(): ChildReply | null {
  const [reply, setReply] = useState<ChildReply | null>(() => (isRecent(current) ? current : null));

  useEffect(() => {
    const listener = (next: ChildReply | null) => setReply(isRecent(next) ? next : null);
    listeners.add(listener);
    if (!current) {
      AsyncStorage.getItem(KEY)
        .then((raw) => {
          if (!raw || current) return;
          current = JSON.parse(raw) as ChildReply;
          listener(current);
        })
        .catch(() => undefined);
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return reply;
}
