const API_PREFIX = '/++api++';

import type {
  AiActionPlan,
  AiActionsApplyResponse,
  TranslationOptions,
  TranslationStatus,
} from './types';

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

export const getAiCapabilities = async (
  context?: { uid?: string; url?: string },
  token?: string,
): Promise<{ is_anonymous: boolean; can_edit: boolean; features: string[] }> => {
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
    translation?: TranslationOptions | null;
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
    translation?: TranslationOptions | null;
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

export const getTranslationStatus = async (
  pageUrl: string,
  token?: string,
): Promise<TranslationStatus> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const response = await fetch(buildApiUrl(`${path}/@ai-translation-status`), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { source_language: '', source_modified: '', translations: [], outdated_count: 0 };
  }

  return response.json();
};
