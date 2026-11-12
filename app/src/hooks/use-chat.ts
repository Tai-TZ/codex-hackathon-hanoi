import { useCallback, useRef, useState } from 'react';

import { sendMessage } from '@/lib/api';
import type { Message } from '@/types/chat';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadId = useRef<string | null>(null);
  const nextId = useRef(0);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content) return;

    setError(null);
    setMessages((prev) => [...prev, { id: `m${nextId.current++}`, role: 'user', content }]);
    setLoading(true);
    try {
      const data = await sendMessage(content, threadId.current);
      threadId.current = data.thread_id;
      setMessages((prev) => [
        ...prev,
        {
          id: `m${nextId.current++}`,
          role: 'assistant',
          content: data.response,
          toolsUsed: data.tools_used,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    threadId.current = null;
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, send, reset };
}
