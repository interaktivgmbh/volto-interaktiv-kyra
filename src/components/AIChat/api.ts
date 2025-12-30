const API_PREFIX = '/++api++';

import type {
  ChatRequestPayload,
  ChatResponsePayload,
  FeedbackPayload,
  Citation,
  AiActionPlan,
  AiActionsApplyResponse,
  AiChatTranslations,
} from './types';
import type { AiChatUploadResponse } from './types';

const buildApiUrl = (path: string) => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_PREFIX}${suffix}`;
};

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const postAiChat = async (
  payload: ChatRequestPayload,
  token?: string,
): Promise<ChatResponsePayload> => {
  const response = await fetch(buildApiUrl('/@ai-chat'), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI chat request failed');
  }

  return response.json();
};

export const postAiFeedback = async (
  payload: FeedbackPayload,
  token?: string,
): Promise<void> => {
  const response = await fetch(buildApiUrl('/@ai-feedback'), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI feedback request failed');
  }
};

export const getAiCapabilities = async (
  context?: { uid?: string; url?: string },
  token?: string,
): Promise<ChatResponsePayload['capabilities']> => {
  const params = new URLSearchParams();
  if (context?.uid) {
    params.set('context', context.uid);
  } else if (context?.url) {
    params.set('context', context.url);
  }

  const query = params.toString();
  const response = await fetch(
    buildApiUrl(`/@ai-capabilities${query ? `?${query}` : ''}`),
    {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI capabilities request failed');
  }

  return response.json();
};

export const postAiActionsPlan = async (
  payload: {
    goal: string;
    page?: { uid?: string; url?: string };
    constraints?: Record<string, any>;
  },
  token?: string,
): Promise<AiActionPlan> => {
  const response = await fetch(buildApiUrl('/@ai-actions/plan'), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI actions plan request failed');
  }

  return response.json();
};

export const postAiActionsApply = async (
  payload: {
    plan_id?: string;
    actions?: any[];
    page?: { uid?: string; url?: string };
  },
  token?: string,
): Promise<AiActionsApplyResponse> => {
  const response = await fetch(buildApiUrl('/@ai-actions/apply'), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI actions apply request failed');
  }

  return response.json();
};

export const postAiChatUpload = async (
  file: File,
  token?: string,
): Promise<AiChatUploadResponse> => {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(buildApiUrl('/@ai-chat-upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'same-origin',
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI chat upload failed');
  }

  return response.json();
};

type StreamHandlers = {
  onToken?: (delta: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: (payload?: ChatResponsePayload) => void;
  onError?: (message: string) => void;
};

type StreamResult = {
  fallback: boolean;
  data?: ChatResponsePayload;
};

const parseSseEvent = (
  rawEvent: string,
  handlers: StreamHandlers,
  didFinish: { current: boolean },
) => {
  const lines = rawEvent.split('\n');
  let eventType = '';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventType = line.replace('event:', '').trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.replace('data:', '').trim());
    }
  });

  const dataText = dataLines.join('\n').trim();
  if (!dataText) return;

  if (dataText === '[DONE]') {
    didFinish.current = true;
    handlers.onDone?.();
    return;
  }

  let payload: any = dataText;
  try {
    payload = JSON.parse(dataText);
  } catch (_error) {
    // keep as text
  }

  if (!eventType && payload && typeof payload === 'object') {
    eventType = payload.type || payload.event || '';
  }

  if (eventType === 'error') {
    const message =
      payload?.message || payload?.error || dataText || 'Stream error';
    handlers.onError?.(message);
    didFinish.current = true;
    return;
  }

  if (eventType === 'citations') {
    const citations = payload?.citations || payload || [];
    handlers.onCitations?.(citations);
    return;
  }

  if (eventType === 'done') {
    handlers.onDone?.(payload);
    didFinish.current = true;
    return;
  }

  if (eventType === 'token' || !eventType) {
    const delta =
      payload?.delta ||
      payload?.token ||
      payload?.content ||
      payload?.text ||
      (typeof payload === 'string' ? payload : '');
    if (delta) {
      handlers.onToken?.(delta);
    }
  }
};

const consumeEventStream = async (
  stream: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const didFinish = { current: false };

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);
      if (rawEvent) {
        parseSseEvent(rawEvent, handlers, didFinish);
      }
      boundaryIndex = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) {
    parseSseEvent(buffer.trim(), handlers, didFinish);
  }

  if (!didFinish.current) {
    handlers.onDone?.();
  }
};

export const postAiChatStream = async (
  payload: ChatRequestPayload,
  handlers: StreamHandlers,
  signal?: AbortSignal,
  token?: string,
): Promise<StreamResult> => {
  const response = await fetch(buildApiUrl('/@ai-chat'), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'text/event-stream',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI chat stream request failed');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const data = await response.json().catch(() => undefined);
    return { fallback: true, data };
  }

  if (!response.body) {
    throw new Error('Streaming response not available');
  }

  await consumeEventStream(response.body, handlers, signal);
  return { fallback: false };
};

export const getAiChatTranslations = async (
  token?: string,
): Promise<AiChatTranslations> => {
  const response = await fetch(buildApiUrl('/@@ai-chat-translations'), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI chat translations request failed');
  }

  return response.json();
};
