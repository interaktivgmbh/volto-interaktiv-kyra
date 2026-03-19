import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { getTagMappings, postTagMapping, deleteTagMapping } from './api';
import type { TagMappings } from './api';

type Props = {
  open: boolean;
  onClose: () => void;
  uiLanguage?: string;
};

// Same react-intl issue.
const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Schlagwort-Mappings',
      close: 'Schlie\u00dfen',
      tag: 'Schlagwort',
      language: 'Sprache',
      translation: '\u00dcbersetzung',
      add: 'Hinzuf\u00fcgen',
      delete: 'L\u00f6schen',
      empty: 'Noch keine Mappings vorhanden.',
      hint: 'Lege fest, wie Schlagw\u00f6rter bei der \u00dcbersetzung \u00fcbertragen werden. Tags ohne Mapping werden in der \u00dcbersetzung weggelassen.',
      loading: 'Laden\u2026',
      tagPlaceholder: 'z.B. Forschung',
      translationPlaceholder: 'z.B. Research',
    };
  }
  return {
    title: 'Tag Mappings',
    close: 'Close',
    tag: 'Tag',
    language: 'Language',
    translation: 'Translation',
    add: 'Add',
    delete: 'Delete',
    empty: 'No mappings yet.',
    hint: 'Define how tags are mapped during translation. Tags without a mapping will be omitted from the translation.',
    loading: 'Loading\u2026',
    tagPlaceholder: 'e.g. Research',
    translationPlaceholder: 'e.g. Forschung',
  };
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

const TagMappingsPanel: React.FC<Props> = ({ open, onClose, uiLanguage }) => {
  const token = useSelector(
    (state: any) => state?.userSession?.token,
  ) as string | undefined;

  const [mappings, setMappings] = useState<TagMappings>({});
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newLang, setNewLang] = useState(LANGUAGES[0].code);
  const [newTranslated, setNewTranslated] = useState('');

  const t = getLabels(uiLanguage);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getTagMappings(token)
      .then((res) => setMappings(res.mappings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token]);

  const handleAdd = async () => {
    const tag = newTag.trim();
    const translated = newTranslated.trim();
    if (!tag || !translated) return;

    try {
      const res = await postTagMapping(
        { tag, language: newLang, translated },
        token,
      );
      setMappings(res.mappings || {});
      setNewTag('');
      setNewTranslated('');
    } catch (_err) {
      // Same silent error pattern. See PromptsPanel.tsx.
    }
  };

  const handleDelete = async (tag: string, language: string) => {
    try {
      const res = await deleteTagMapping({ tag, language }, token);
      setMappings(res.mappings || {});
    } catch (_err) {
      // ignore
    }
  };

  // Flatten mappings into rows for display
  const rows: Array<{ tag: string; language: string; translated: string }> = [];
  Object.entries(mappings).forEach(([tag, langMap]) => {
    Object.entries(langMap).forEach(([lang, translated]) => {
      rows.push({ tag, language: lang, translated });
    });
  });
  rows.sort((a, b) => a.tag.localeCompare(b.tag) || a.language.localeCompare(b.language));

    {// TS7016: Could not find a declaration file for module react/jsx-runtime.}
  return (
    <div
      className={`kyra-ai-chat__settings kyra-ai-chat__tag-mappings${
        open ? ' kyra-ai-chat__settings--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__settings-header">
        <div className="kyra-ai-chat__settings-title">{t.title}</div>
        <button type="button" onClick={onClose}>
          {t.close}
        </button>
      </div>
      <div className="kyra-ai-chat__settings-scroll">
        <div className="kyra-ai-chat__settings-hint" style={{ marginBottom: 12 }}>
          {t.hint}
        </div>

        {loading && <div className="kyra-ai-chat__tag-mappings-loading">{t.loading}</div>}

        {!loading && rows.length === 0 && (
          <div className="kyra-ai-chat__tag-mappings-empty">{t.empty}</div>
        )}

        {!loading && rows.length > 0 && (
          <div className="kyra-ai-chat__tag-mappings-table">
            <div className="kyra-ai-chat__tag-mappings-row kyra-ai-chat__tag-mappings-row--header">
              <div>{t.tag}</div>
              <div>{t.language}</div>
              <div>{t.translation}</div>
              <div />
            </div>
            {rows.map((row) => (
              <div key={`${row.tag}-${row.language}`} className="kyra-ai-chat__tag-mappings-row">
                <div>{row.tag}</div>
                <div>{row.language.toUpperCase()}</div>
                <div>{row.translated}</div>
                <div>
                  <button
                    type="button"
                    className="kyra-ai-chat__tag-mappings-delete"
                    onClick={() => handleDelete(row.tag, row.language)}
                    aria-label={t.delete}
                    title={t.delete}
                  >
                    {/* Inline SVG — same issue as ChatPanel.tsx. */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="kyra-ai-chat__tag-mappings-form">
          <input
            type="text"
            className="kyra-ai-chat__settings-input"
            placeholder={t.tagPlaceholder}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
          <select
            className="kyra-ai-chat__settings-input kyra-ai-chat__tag-mappings-select"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="kyra-ai-chat__settings-input"
            placeholder={t.translationPlaceholder}
            value={newTranslated}
            onChange={(e) => setNewTranslated(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            disabled={!newTag.trim() || !newTranslated.trim()}
            onClick={handleAdd}
          >
            {t.add}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagMappingsPanel;
