export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type Citation = {
  source_id: string;
  label: string;
  url: string;
  snippet: string;
};

export type ChatMessageAction = {
  label: string;
  value: string;
  variant?: 'default' | 'primary' | 'ghost';
  icon?: 'page' | 'folder';
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
  citations?: Citation[];
  feedback?: 'up' | 'down' | null;
  actions?: ChatMessageAction[];
  wizardMeta?: Record<string, any>;
};

export type ChatConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
  pinned?: boolean;
  archived?: boolean;
};

export type ChatCapabilities = {
  is_anonymous: boolean;
  can_edit: boolean;
  features: string[];
  edit_backend_url?: string;
};

export type AiAction = {
  type: string;
  payload?: Record<string, any>;
};

export type AiActionPreview = {
  summary?: string;
  diff?: string;
  human_steps?: string[];
};

export type AiActionPlan = {
  plan_id: string;
  actions: AiAction[];
  preview?: AiActionPreview;
  translation_report?: {
    created?: number;
    updated?: number;
    skipped?: number;
    failed?: number;
    details?: Array<Record<string, any>>;
    source_language?: string;
    target_language?: string;
    mode?: string;
  };
};

export type AiActionsApplyResponse = {
  result: 'ok' | 'error';
  changed?: string[];
  reload?: boolean;
  content_snapshot?: Record<string, any>;
  report?: AiActionPlan['translation_report'];
};

export type TranslationOptions = {
  target_language: string;
  mode: 'single' | 'subtree';
  overwrite?: boolean;
  incremental?: boolean;
};

export type ChatContextPayload = {
  mode: 'page' | 'summarize' | 'related' | 'search';
  page?: {
    uid?: string;
    url?: string;
  };
  page_content?: string;
  query?: string;
  selection_text?: string;
  uploads?: Array<{
    file_id: string;
    name?: string;
    text?: string;
  }>;
};

export type ChatQuickAction = {
  label: string;
  keyword: string;
  mode: ChatContextPayload['mode'];
};

export type ChatRequestPayload = {
  conversation_id?: string;
  messages: Array<{
    role: ChatRole;
    content: string;
  }>;
  context?: ChatContextPayload;
  params?: {
    language?: string;
    model?: string;
    temperature?: number;
  };
};

export type ChatResponsePayload = {
  conversation_id?: string;
  message?: {
    role: ChatRole;
    content: string;
  };
  citations?: Citation[];
  capabilities?: ChatCapabilities;
  used_context?: Array<{
    id?: string;
    title?: string;
    url?: string;
    type?: string;
    score?: number;
  }>;
};

export type FeedbackPayload = {
  message_id: string;
  rating: 'up' | 'down';
  comment?: string;
};

export type AiChatTranslations = {
  language?: string;
  notice?: string;
};

export type AiChatUploadResponse = {
  file_id: string;
  name: string;
  has_text?: boolean;
  text?: string;
};

export type TranslationStatusItem = {
  language: string;
  title: string;
  url: string;
  modified: string;
  is_outdated: boolean;
};

export type TranslationStatus = {
  source_language: string;
  source_modified: string;
  translations: TranslationStatusItem[];
  outdated_count: number;
};

export type Prompt = {
  id: string;
  name: string;
  description: string;
  text: string;
  categories: string[];
  actionType: 'replace' | 'append';
  created: string;
  updated: string;
};
