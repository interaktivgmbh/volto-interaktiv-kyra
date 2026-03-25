const API_PREFIX = '/++api++';

import type {
  ChatRequestPayload,
  ChatResponsePayload,
  FeedbackPayload,
  Citation,
  AiActionPlan,
  AiActionsApplyResponse,
  AiChatTranslations,
  TranslationOptions,
  TranslationStatus,
  Prompt,
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

const parseErrorMessage = (text: string): string => {
  try {
    const json = JSON.parse(text);
    return json.error || json.message || json.detail || text;
  } catch {
    return text;
  }
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
    throw new Error(parseErrorMessage(errorText) || 'AI chat request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI feedback request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI capabilities request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI actions plan request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI actions apply request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI chat upload failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI chat stream request failed');
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
    throw new Error(parseErrorMessage(errorText) || 'Tag mapping save failed');
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
    throw new Error(parseErrorMessage(errorText) || 'Tag mapping delete failed');
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
    throw new Error(parseErrorMessage(errorText) || 'AI chat translations request failed');
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// DeepL Glossary
// ---------------------------------------------------------------------------

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
    throw new Error(parseErrorMessage(errorText) || 'Glossary entry save failed');
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
    throw new Error(parseErrorMessage(errorText) || 'Glossary entry delete failed');
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
    throw new Error(parseErrorMessage(errorText) || 'CSV import failed');
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Prompt Files
// ---------------------------------------------------------------------------

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
      throw new Error(parseErrorMessage(errorText) || 'File upload failed');
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
    throw new Error(parseErrorMessage(errorText) || 'File deletion failed');
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

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
    throw new Error(parseErrorMessage(errorText) || 'Prompt creation failed');
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
    throw new Error(parseErrorMessage(errorText) || 'Prompt update failed');
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
    throw new Error(parseErrorMessage(errorText) || 'Prompt deletion failed');
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Replace selected text in page blocks
// ---------------------------------------------------------------------------

function extractSlateText(nodes: any[]): string {
  return nodes
    .map((node) => {
      if (typeof node.text === 'string') return node.text;
      if (node.children) return extractSlateText(node.children);
      return '';
    })
    .join('');
}

const normalizeWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

function replaceInSlateNodes(
  nodes: any[],
  original: string,
  replacement: string,
): { result: any[]; replaced: boolean } {
  const fullText = extractSlateText(nodes);
  let idx = fullText.indexOf(original);
  // Fallback: normalised whitespace comparison
  if (idx === -1) {
    const normFull = normalizeWhitespace(fullText);
    const normOrig = normalizeWhitespace(original);
    const normIdx = normFull.indexOf(normOrig);
    if (normIdx === -1) return { result: nodes, replaced: false };
    // Map normalised index back to original text position
    let ni = 0;
    let oi = 0;
    while (ni < normIdx && oi < fullText.length) {
      if (/\s/.test(fullText[oi])) {
        while (oi < fullText.length && /\s/.test(fullText[oi])) oi++;
        ni++; // single space in normalised
      } else {
        oi++;
        ni++;
      }
    }
    const startOi = oi;
    let remaining = normOrig.length;
    while (remaining > 0 && oi < fullText.length) {
      if (/\s/.test(fullText[oi])) {
        while (oi < fullText.length && /\s/.test(fullText[oi])) oi++;
        remaining--; // single space in normalised
      } else {
        oi++;
        remaining--;
      }
    }
    // Use the mapped range in the original text
    original = fullText.substring(startOi, oi);
    idx = startOi;
  }

  const cloned: any[] = JSON.parse(JSON.stringify(nodes));

  type Leaf = { node: any; start: number; end: number };
  const leaves: Leaf[] = [];
  let pos = 0;

  const walk = (list: any[]) => {
    for (const n of list) {
      if (typeof n.text === 'string') {
        leaves.push({ node: n, start: pos, end: pos + n.text.length });
        pos += n.text.length;
      } else if (n.children) {
        walk(n.children);
      }
    }
  };
  walk(cloned);

  const matchEnd = idx + original.length;
  let inserted = false;

  for (const leaf of leaves) {
    if (leaf.end <= idx || leaf.start >= matchEnd) continue;

    const before =
      leaf.start < idx ? leaf.node.text.substring(0, idx - leaf.start) : '';
    const after =
      leaf.end > matchEnd
        ? leaf.node.text.substring(matchEnd - leaf.start)
        : '';

    if (!inserted) {
      leaf.node.text = before + replacement + after;
      inserted = true;
    } else {
      leaf.node.text = after;
    }
  }

  return { result: cloned, replaced: true };
}

/**
 * Fetches the page content and computes updated blocks with the text replaced.
 * Returns { blocks } ready to be PATCHed via Volto's updateContent action.
 */
export const computeBlocksWithReplacement = async (
  pageUrl: string,
  originalText: string,
  newText: string,
  token?: string,
): Promise<{ blocks: Record<string, any> }> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const getResponse = await fetch(buildApiUrl(path), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!getResponse.ok) throw new Error('Failed to fetch page content');
  const pageData = await getResponse.json();

  const blocks = pageData.blocks;
  const blocksLayout = pageData.blocks_layout;
  if (!blocks || !blocksLayout?.items) throw new Error('No blocks found');

  // Strip HTML tags from the replacement text (gateway may wrap in <p>, <br>, etc.)
  const cleanText = newText.replace(/<[^>]+>/g, '').trim();

  const updatedBlocks = { ...blocks };
  let modified = false;

  // Try to find and replace in any block's Slate value fields
  const slateFields = ['value', 'description', 'title'];

  for (const blockId of blocksLayout.items) {
    const block = blocks[blockId];
    if (!block) continue;
    if (modified) break;

    // Search all known Slate array fields
    for (const field of slateFields) {
      const slateValue = block[field];
      if (!Array.isArray(slateValue)) continue;

      const { result, replaced } = replaceInSlateNodes(
        slateValue,
        originalText,
        cleanText,
      );
      if (replaced) {
        updatedBlocks[blockId] = { ...block, [field]: result };
        modified = true;
        break;
      }
    }

    // Also check plain string fields (title, description, head_title, etc.)
    if (!modified) {
      const stringFields = ['plaintext', 'head_title', 'citation'];
      for (const field of stringFields) {
        if (typeof block[field] === 'string' && block[field].includes(originalText)) {
          updatedBlocks[blockId] = {
            ...block,
            [field]: block[field].replace(originalText, cleanText),
          };
          modified = true;
          break;
        }
        // Normalised fallback for string fields
        if (
          typeof block[field] === 'string' &&
          normalizeWhitespace(block[field]).includes(normalizeWhitespace(originalText))
        ) {
          updatedBlocks[blockId] = {
            ...block,
            [field]: block[field].replace(
              new RegExp(originalText.replace(/\s+/g, '\\s+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
              cleanText,
            ),
          };
          modified = true;
          break;
        }
      }
    }
  }

  // Multi-block: selection spans multiple paragraphs / blocks
  if (!modified) {
    const origParagraphs = originalText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const newParagraphs = cleanText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

    if (origParagraphs.length > 1) {
      const replacements: { blockId: string; field: string; origPara: string; newPara: string }[] = [];

      for (let i = 0; i < origParagraphs.length; i++) {
        const origPara = origParagraphs[i];
        const newPara = i < newParagraphs.length ? newParagraphs[i] : '';
        let found = false;

        for (const blockId of blocksLayout.items) {
          const block = updatedBlocks[blockId];
          if (!block) continue;

          for (const field of slateFields) {
            const slateValue = block[field];
            if (!Array.isArray(slateValue)) continue;
            const blockText = extractSlateText(slateValue);
            if (
              blockText.includes(origPara) ||
              normalizeWhitespace(blockText).includes(normalizeWhitespace(origPara))
            ) {
              replacements.push({ blockId, field, origPara, newPara });
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      if (replacements.length > 0) {
        for (const rep of replacements) {
          const block = updatedBlocks[rep.blockId];
          const slateValue = block[rep.field];
          if (!Array.isArray(slateValue)) continue;
          const { result, replaced } = replaceInSlateNodes(slateValue, rep.origPara, rep.newPara);
          if (replaced) {
            updatedBlocks[rep.blockId] = { ...block, [rep.field]: result };
            modified = true;
          }
        }
      }
    }
  }

  if (!modified) throw new Error('Original text not found in page blocks');

  return { blocks: updatedBlocks };
};

export const resolveListingBlockItems = async (
  querystring: Record<string, any>,
  contextPath: string,
  token?: string,
): Promise<any[]> => {
  const response = await fetch(buildApiUrl(`${contextPath}/@querystring-search`), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(querystring),
  });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    '@id': item['@id'],
    '@type': item['@type'],
    title: item.title,
    description: item.description,
    preview_image: item.preview_image || item.image || null,
  }));
};

const resolveListingsInBlocks = async (
  blocks: Record<string, any>,
  layoutItems: string[],
  contextPath: string,
  token?: string,
): Promise<Record<string, any>> => {
  const resolved = { ...blocks };

  for (const id of layoutItems) {
    const block = blocks[id];
    if (!block) continue;

    if (block['@type'] === 'listing' && block.querystring) {
      const items = await resolveListingBlockItems(block.querystring, contextPath, token);
      resolved[id] = { ...block, items };
    }

    if (block.blocks && block.blocks_layout?.items) {
      const nested = await resolveListingsInBlocks(
        block.blocks, block.blocks_layout.items, contextPath, token,
      );
      resolved[id] = { ...resolved[id], blocks: nested };
    }
    if (block.data?.blocks && block.data?.blocks_layout?.items) {
      const nested = await resolveListingsInBlocks(
        block.data.blocks, block.data.blocks_layout.items, contextPath, token,
      );
      resolved[id] = {
        ...resolved[id],
        data: { ...block.data, blocks: nested },
      };
    }
  }

  return resolved;
};

export const prepareBlocksForEditMode = async (
  pageUrl: string,
  token?: string,
): Promise<{
  blocks: Record<string, any>;
  blocks_layout: { items: string[] };
  title?: string;
  description?: string;
  preview_image?: string;
  subjects?: string[];
}> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const response = await fetch(buildApiUrl(path), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) throw new Error('Failed to fetch page content');
  const data = await response.json();

  const blocks = data.blocks || {};
  const blocksLayout = data.blocks_layout || { items: [] };

  const resolved = await resolveListingsInBlocks(blocks, blocksLayout.items, path, token);

  const previewImage = data.preview_image?.[0]?.['@id']
    || data.preview_image?.download
    || data.preview_image
    || '';

  return {
    blocks: resolved,
    blocks_layout: blocksLayout,
    title: data.title || '',
    description: data.description || '',
    preview_image: typeof previewImage === 'string' ? previewImage : '',
    subjects: data.subjects || [],
  };
};

export type LayoutJobStatus =
  | { status: 'running'; progress?: string }
  | { status: 'completed'; message?: string; state?: Record<string, any> }
  | { status: 'failed'; error?: string }
  | { status: 'cancelled' };

export const createLayoutConversation = async (
  _baseUrl: string,
  payload: { schema: string; version: string; state: Record<string, any>; permissions?: string[]; language?: string },
  token?: string,
): Promise<{ conversation_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-conversations'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(parseErrorMessage(errorText) || 'Failed to create layout conversation');
  }

  return response.json();
};

export const sendLayoutMessage = async (
  _baseUrl: string,
  conversationId: string,
  payload: { message: string; state?: Record<string, any>; context?: { text?: string; block_id?: string } },
  token?: string,
): Promise<{ job_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-messages'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ ...payload, conversation_id: conversationId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(parseErrorMessage(errorText) || 'Failed to send layout message');
  }

  return response.json();
};

export const pollLayoutJob = async (
  _baseUrl: string,
  jobId: string,
  token?: string,
): Promise<LayoutJobStatus> => {
  const response = await fetch(
    buildApiUrl(`/@ai-edit-jobs?job_id=${encodeURIComponent(jobId)}`),
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
    throw new Error(parseErrorMessage(errorText) || 'Failed to poll layout job');
  }

  return response.json();
};

export const cancelLayoutJob = async (
  _baseUrl: string,
  jobId: string,
  token?: string,
): Promise<{ status: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-job-cancel'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(parseErrorMessage(errorText) || 'Failed to cancel layout job');
  }

  return response.json();
};

export type ChatHistoryData = {
  conversations: import('./types').ChatConversation[];
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
