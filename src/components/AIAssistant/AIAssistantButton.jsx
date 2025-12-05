import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { selectPromptsGrouped } from '../../helpers/selectPromptsGrouped';
import { getPrompts } from '../../redux/actions';

const AIAssistantButton = ({ onSelectPrompt = () => {} }) => {
  const dispatch = useDispatch();

  const grouped = useSelector(selectPromptsGrouped) || {};
  const categories = Object.keys(grouped);

  const loading = useSelector((state) => state.kyra?.loading);
  const loaded = useSelector((state) => state.kyra?.loaded);
  const itemsLength = useSelector(
    (state) => (state.kyra?.items || []).length,
  );

  useEffect(() => {
    if (!loading && !loaded && itemsLength === 0) {
      dispatch(getPrompts());
    }
  }, [loading, loaded, itemsLength, dispatch]);

  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategory(null);
      return;
    }

    if (!activeCategory) {
      setActiveCategory(categories[0]);
      return;
    }

    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  if (loading && categories.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          fontSize: '0.85rem',
          color: '#666',
        }}
      >
        Prompts werden geladen …
      </div>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          fontSize: '0.85rem',
          color: '#666',
        }}
      >
        Keine Prompts verfügbar.
      </div>
    );
  }

  const prompts = activeCategory ? grouped[activeCategory] || [] : [];

  return (
    <div
      className="kyra-ai-menu"
      style={{
        display: 'flex',
        minWidth: 360,
        maxWidth: 480,
        maxHeight: 260,
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        className="kyra-ai-menu-categories"
        style={{
          flex: '0 0 160px',
          borderRight: '1px solid #eee',
          padding: '8px 0',
          overflowY: 'auto',
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              border: 'none',
              background:
                cat === activeCategory ? 'rgba(0,123,148,0.08)' : 'transparent',
              fontSize: '0.8rem',
              fontWeight: cat === activeCategory ? 600 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#444',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div
        className="kyra-ai-menu-prompts"
        style={{
          flex: 1,
          padding: '8px',
          overflowY: 'auto',
        }}
      >
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              marginBottom: 4,
              borderRadius: 4,
              border: '1px solid #e2e2e2',
              background: '#fafafa',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {prompt.name}
          </button>
        ))}

        {prompts.length === 0 && (
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              color: '#777',
            }}
          >
            Keine Prompts in dieser Kategorie.
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistantButton;
