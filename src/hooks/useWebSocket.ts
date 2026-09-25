import { useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions<T> {
  url: string;
  onMessage: (message: T) => void;
  /** First retry delay; doubles on each failure up to `maxDelayMs`. */
  initialDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Reconnecting WebSocket. A monitoring screen must never give up, so it
 * retries forever with capped exponential backoff.
 */
export function useWebSocket<T>({
  url,
  onMessage,
  initialDelayMs = 1000,
  maxDelayMs = 10_000,
}: UseWebSocketOptions<T>): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = initialDelayMs;
    let disposed = false;

    const connect = () => {
      setStatus('connecting');
      ws = new WebSocket(url);
      ws.onopen = () => {
        delay = initialDelayMs;
        setStatus('open');
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          handler.current(JSON.parse(event.data) as T);
        } catch {
          console.warn('[aegis] unparseable message dropped');
        }
      };
      ws.onerror = () => setStatus('error');
      ws.onclose = () => {
        if (disposed) return;
        setStatus('closed');
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, maxDelayMs);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [url, initialDelayMs, maxDelayMs]);

  return status;
}
