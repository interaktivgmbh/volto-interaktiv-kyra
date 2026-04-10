import { buildApiUrl, buildHeaders } from './core';

export type ChatHistoryData = {
  conversations: import('../types').ChatConversation[];
  chat_name: string | null;
};

export const getAiChatHistory = async (
  token?: string,
): Promise<ChatHistoryData> => {
  const response = await fetch(buildApiUrl('/@ai-chat-history'), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Failed to load chat history');
  return response.json();
};

export const patchAiChatHistory = async (
  data: { conversation?: Record<string, any>; chat_name?: string | null },
  token?: string,
): Promise<void> => {
  const response = await fetch(buildApiUrl('/@ai-chat-history'), {
    method: 'PATCH',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to save chat history');
};

export const putAiChatHistory = async (
  data: { conversations: Record<string, any>[]; chat_name?: string | null },
  token?: string,
): Promise<void> => {
  const response = await fetch(buildApiUrl('/@ai-chat-history'), {
    method: 'PUT',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to replace chat history');
};

export const deleteAiChatConversation = async (
  conversationId: string,
  token?: string,
): Promise<void> => {
  const response = await fetch(
    buildApiUrl(`/@ai-chat-history/${encodeURIComponent(conversationId)}`),
    {
      method: 'DELETE',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    },
  );
  if (!response.ok) throw new Error('Failed to delete conversation');
};

export const reportError = async (
  data: {
    error_message: string;
    error_type?: string;
    stack_trace?: string;
    page_url?: string;
    user_action?: string;
    component?: string;
    browser?: string;
    timestamp?: string;
  },
  token?: string,
): Promise<{ status: string; issue_url?: string; issue_number?: number }> => {
  try {
    const response = await fetch(buildApiUrl('/@ai-error-report'), {
      method: 'POST',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        ...data,
        browser: data.browser || navigator.userAgent,
        page_url: data.page_url || window.location.href,
        timestamp: data.timestamp || new Date().toISOString(),
      }),
    });
    if (!response.ok) return { status: 'failed' };
    return response.json();
  } catch (_err) {
    return { status: 'failed' };
  }
};
