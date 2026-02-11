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
};

export type ChatContextPayload = {
  mode: 'page' | 'summarize' | 'related' | 'search';
  page?: {
    uid?: string;
    url?: string;
  };
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
