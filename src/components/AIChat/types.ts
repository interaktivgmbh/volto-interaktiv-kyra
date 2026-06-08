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

export type ChatPermissions = {
  chat: boolean;
  translate: boolean;
  manage_glossary: boolean;
  manage_tag_mappings: boolean;
  manage_prompts: boolean;
  manage_settings: boolean;
  assistant_run: boolean;
};

export type ChatModules = {
  chat: boolean;
  translate: boolean;
  manage_glossary: boolean;
  manage_tag_mappings: boolean;
  manage_prompts: boolean;
  assistant_run: boolean;
};

export type ChatCapabilities = {
  is_anonymous: boolean;
  can_edit: boolean;
  is_admin?: boolean;
  features: string[];
  permissions?: ChatPermissions;
  modules?: ChatModules;
};

export function hasPermission(
  caps: ChatCapabilities,
  perm: keyof ChatPermissions,
): boolean {
  if (caps.permissions) return caps.permissions[perm] ?? false;
  // Fallback for old backend without fine-grained permissions
  if (perm === 'chat') return true;
  return caps.can_edit;
}

/** Check if a module is globally enabled in the control panel. */
export function isModuleEnabled(
  caps: ChatCapabilities,
  mod: keyof ChatModules,
): boolean {
  if (caps.modules) return caps.modules[mod] ?? true;
  return true; // fallback: enabled
}

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

/** Machine-translation marker info returned by the backend. */
export type MachineTranslationMarker = {
  is_machine_translated: boolean;
  /** machine-translated AND not yet editorially reviewed */
  is_unreviewed: boolean;
  translated_at?: string;
  source_language?: string;
  gateway_used?: boolean;
};

export type TranslationStatusItem = {
  language: string;
  title: string;
  url: string;
  modified: string;
  is_outdated: boolean;
} & Partial<MachineTranslationMarker>;

export type TranslationStatus = {
  source_language: string;
  source_modified: string;
  translations: TranslationStatusItem[];
  outdated_count: number;
  /** Marker for the currently viewed object itself. */
  current?: MachineTranslationMarker;
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
