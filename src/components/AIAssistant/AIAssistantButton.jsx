import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useIntl } from 'react-intl';

import { getPrompts } from '../AIChat/api';

const groupPromptsByCategory = (prompts) => {
  const grouped = {};
  (prompts || []).forEach((p) => {
    const cats = p.categories?.length ? p.categories : ['Allgemein'];
    cats.forEach((cat) => {
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
  });
  return grouped;
};

const AIAssistantButton = ({ onSelectPrompt = () => {} }) => {
  const intl = useIntl();
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en);

  const token = useSelector(
    (state) => state?.userSession?.token,
  );

  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    if (loaded || loading) return;
    setLoading(true);
    getPrompts(token)
      .then((res) => {
        setPrompts(res.prompts || []);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [loaded, loading, token]);

  const grouped = groupPromptsByCategory(prompts);
  const categories = Object.keys(grouped);

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && categories.length === 0) {
    return (
      <div className="kyra-ai-menu-loading">
        {t('Prompts are loading\u2026', 'Prompts werden geladen \u2026')}
      </div>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <div className="kyra-ai-menu-loading">
        {t('No prompts available.', 'Keine Prompts verf\u00fcgbar.')}
      </div>
    );
  }

  const currentPrompts = activeCategory ? grouped[activeCategory] || [] : [];

  return (
    <div className="kyra-ai-menu">
      <div className="kyra-ai-menu-categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`kyra-ai-menu-category-btn${cat === activeCategory ? ' kyra-ai-menu-category-btn--active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="kyra-ai-menu-prompts">
        {currentPrompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="kyra-ai-menu-prompt-btn"
          >
            {prompt.name}
          </button>
        ))}

        {currentPrompts.length === 0 && (
          <div className="kyra-ai-menu-empty">
            {t('No prompts in this category.', 'Keine Prompts in dieser Kategorie.')}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistantButton;
