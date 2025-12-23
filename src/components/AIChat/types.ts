export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type Citation = {
  source_id: string;
  label: string;
  url: string;
  snippet: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
  citations?: Citation[];
  feedback?: 'up' | 'down' | null;
};

export type ChatConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

export type ChatCapabilities = {
  is_anonymous: boolean;
  can_edit: boolean;
  features: string[];
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
};

export type AiActionsApplyResponse = {
  result: 'ok' | 'error';
  changed?: string[];
  reload?: boolean;
  content_snapshot?: Record<string, any>;
};

export type ChatContextPayload = {
  mode: 'page' | 'summarize' | 'related' | 'search';
  page?: {
    uid?: string;
    url?: string;
  };
  query?: string;
  selection_text?: string;
};

export type ChatQuickAction = {
  label: string;
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
