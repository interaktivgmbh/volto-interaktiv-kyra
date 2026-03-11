import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { getPrompts } from './api';
import type { Prompt } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  onApplyPrompt?: (text: string) => void;
  uiLanguage?: string;
};

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Prompt ausw\u00e4hlen',
      empty: 'Noch keine Prompts gespeichert.',
      loading: 'Laden\u2026',
      allCategories: 'Alle',
      back: 'Zur\u00fcck',
    };
  }
  return {
    title: 'Select prompt',
    empty: 'No prompts saved yet.',
    loading: 'Loading\u2026',
    allCategories: 'All',
    back: 'Back',
  };
};

const groupByCategory = (prompts: Prompt[]) => {
  const groups: Record<string, Prompt[]> = {};
  for (const prompt of prompts) {
    const cats = prompt.categories && prompt.categories.length > 0
      ? prompt.categories
      : ['Allgemein'];
    for (const cat of cats) {
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(prompt);
    }
  }
  return groups;
};

const PromptPicker: React.FC<Props> = ({ open, onClose, onApplyPrompt, uiLanguage }) => {
  const token = useSelector(
    (state: any) => state?.userSession?.token,
  ) as string | undefined;

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const t = getLabels(uiLanguage);

  useEffect(() => {
    if (!open) return;
    setActiveCategory(null);
    setLoading(true);
    getPrompts(token)
      .then((res) => setPrompts(res.prompts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token]);

  if (!open) return null;

  const grouped = groupByCategory(prompts);
  const categories = Object.keys(grouped).sort();
  const displayPrompts = activeCategory
    ? grouped[activeCategory] || []
    : prompts;

  return (
    <div className="kyra-ai-chat__prompt-picker-inline">
      {/* Header */}
      <div className="kyra-ai-chat__prompt-picker-header">
        <button
          type="button"
          className="kyra-ai-chat__prompt-picker-back"
          onClick={onClose}
          aria-label={t.back}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="kyra-ai-chat__prompt-picker-title">{t.title}</span>
      </div>

      {loading && (
        <div className="kyra-ai-chat__prompt-picker-status">{t.loading}</div>
      )}

      {!loading && prompts.length === 0 && (
        <div className="kyra-ai-chat__prompt-picker-status">{t.empty}</div>
      )}

      {!loading && prompts.length > 0 && (
        <>
          {/* Category pills */}
          {categories.length > 1 && (
            <div className="kyra-ai-chat__prompt-picker-cats">
              <button
                type="button"
                className={`kyra-ai-chat__prompt-picker-cat${!activeCategory ? ' kyra-ai-chat__prompt-picker-cat--active' : ''}`}
                onClick={() => setActiveCategory(null)}
              >
                {t.allCategories}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`kyra-ai-chat__prompt-picker-cat${activeCategory === cat ? ' kyra-ai-chat__prompt-picker-cat--active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Prompt items */}
          <div className="kyra-ai-chat__prompt-picker-list">
            {displayPrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                className="kyra-ai-chat__prompt-picker-item"
                onClick={() => {
                  onApplyPrompt?.(prompt.text);
                  onClose();
                }}
              >
                <div className="kyra-ai-chat__prompt-picker-item-name">
                  {prompt.name}
                </div>
                {prompt.description && (
                  <div className="kyra-ai-chat__prompt-picker-item-desc">
                    {prompt.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PromptPicker;
