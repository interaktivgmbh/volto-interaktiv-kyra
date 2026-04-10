import type {
  AiChatTranslations,
  AiChatUploadResponse,
  Prompt,
} from '../types';
import { buildApiUrl, buildHeaders } from './core';

export type TagMappings = Record<string, Record<string, string>>;

export const getTagMappings = async (
  token?: string,
): Promise<{ mappings: TagMappings }> => {
  const response = await fetch(buildApiUrl('/@ai-tag-mappings'), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { mappings: {} };
  }

  return response.json();
};

export const postTagMapping = async (
  payload: { tag: string; language: string; translated: string },
  token?: string,
): Promise<{ result: string; mappings: TagMappings }> => {
  const response = await fetch(buildApiUrl('/@ai-tag-mappings'), {
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
    throw new Error(errorText || 'Tag mapping save failed');
  }

  return response.json();
};

export const deleteTagMapping = async (
  payload: { tag: string; language?: string },
  token?: string,
): Promise<{ result: string; mappings: TagMappings }> => {
  const response = await fetch(buildApiUrl('/@ai-tag-mappings'), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Tag mapping delete failed');
  }

  return response.json();
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

export type GlossaryEntries = Record<string, string>;

export const getGlossaryEntries = async (
  sourceLang: string,
  targetLang: string,
  token?: string,
): Promise<{ source_lang: string; target_lang: string; entries: GlossaryEntries; glossary_id: string }> => {
  const params = new URLSearchParams({ source: sourceLang, target: targetLang });
  const response = await fetch(buildApiUrl(`/@ai-glossary?${params}`), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { source_lang: sourceLang, target_lang: targetLang, entries: {}, glossary_id: '' };
  }

  return response.json();
};

export const postGlossaryEntry = async (
  payload: { source_term: string; target_term: string; source_lang: string; target_lang: string },
  token?: string,
): Promise<{ result: string; entries: GlossaryEntries; glossary_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-glossary'), {
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
    throw new Error(errorText || 'Glossary entry save failed');
  }

  return response.json();
};

export const deleteGlossaryEntry = async (
  payload: { source_term: string; source_lang: string; target_lang: string },
  token?: string,
): Promise<{ result: string; entries: GlossaryEntries; glossary_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-glossary'), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Glossary entry delete failed');
  }

  return response.json();
};

export const importGlossaryCsv = async (
  payload: { csv_data: string; source_lang: string; target_lang: string },
  token?: string,
): Promise<{ result: string; entries: GlossaryEntries; glossary_id: string; imported: number }> => {
  const response = await fetch(buildApiUrl('/@ai-glossary'), {
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
    throw new Error(errorText || 'CSV import failed');
  }

  return response.json();
};

export const getPrompts = async (
  token?: string,
): Promise<{ prompts: Prompt[] }> => {
  const response = await fetch(buildApiUrl('/@ai-prompts'), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { prompts: [] };
  }

  return response.json();
};

export const createPrompt = async (
  payload: { name: string; text: string; description?: string; categories?: string[]; actionType?: string },
  token?: string,
): Promise<{ result: string; prompt: Prompt }> => {
  const response = await fetch(buildApiUrl('/@ai-prompts'), {
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
    throw new Error(errorText || 'Prompt creation failed');
  }

  return response.json();
};

export const updatePrompt = async (
  payload: { id: string; name?: string; text?: string; description?: string; categories?: string[]; actionType?: string },
  token?: string,
): Promise<{ result: string; prompt: Prompt }> => {
  const response = await fetch(buildApiUrl('/@ai-prompts'), {
    method: 'PATCH',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Prompt update failed');
  }

  return response.json();
};

export const deletePrompt = async (
  payload: { id: string },
  token?: string,
): Promise<{ result: string; id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-prompts'), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Prompt deletion failed');
  }

  return response.json();
};

export const getPromptFiles = async (
  promptId: string,
  token?: string,
): Promise<{ files: any[] }> => {
  const response = await fetch(buildApiUrl(`/@ai-prompt-files/${promptId}`), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { files: [] };
  }

  return response.json();
};

export const getPromptFile = async (
  promptId: string,
  fileId: string,
  token?: string,
): Promise<any> => {
  const response = await fetch(buildApiUrl(`/@ai-prompt-files/${promptId}/${fileId}`), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Failed to load file');
  }

  return response.json();
};

export const uploadPromptFiles = async (
  promptId: string,
  files: File[],
  token?: string,
): Promise<any[]> => {
  const results: any[] = [];

  for (const file of files) {
    const form = new FormData();
    form.append('file', file);

    const response = await fetch(buildApiUrl(`/@ai-prompt-files/${promptId}`), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'same-origin',
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'File upload failed');
    }

    const result = await response.json();
    results.push(result);
  }

  return results;
};

export const deletePromptFile = async (
  promptId: string,
  fileId: string,
  token?: string,
): Promise<{ result: string; id: string }> => {
  const response = await fetch(buildApiUrl(`/@ai-prompt-files/${promptId}/${fileId}`), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'File deletion failed');
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
