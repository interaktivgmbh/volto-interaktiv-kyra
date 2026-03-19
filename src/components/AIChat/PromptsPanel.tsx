import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { getPrompts, createPrompt, updatePrompt, deletePrompt } from './api';
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
      title: 'Promptmanager',
      close: 'Schlie\u00dfen',
      name: 'Name',
      description: 'Beschreibung',
      promptText: 'Prompt-Text',
      categories: 'Kategorien',
      create: 'Erstellen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      edit: 'Bearbeiten',
      delete: 'L\u00f6schen',
      apply: 'Ausf\u00fchren',
      empty: 'Noch keine Prompts gespeichert.',
      loading: 'Laden\u2026',
      hint: 'Erstelle und verwalte wiederverwendbare Prompts. Klicke auf "Ausf\u00fchren", um einen Prompt als Chat-Nachricht zu senden.',
      newPrompt: 'Neuer Prompt',
      namePlaceholder: 'z.B. Zusammenfassung',
      descriptionPlaceholder: 'Kurze Beschreibung (optional)',
      promptPlaceholder: 'Prompt-Text eingeben\u2026',
      categoriesPlaceholder: 'Kategorien (kommagetrennt)',
      freetext: 'Freitext',
      freetextHint: 'Eigenen Prompt direkt eingeben und ausf\u00fchren.',
      freetextPlaceholder: 'Freien Prompt eingeben\u2026',
      freetextApply: 'Ausf\u00fchren',
      confirmDelete: 'Wirklich l\u00f6schen?',
    };
  }
  return {
    title: 'Prompt Manager',
    close: 'Close',
    name: 'Name',
    description: 'Description',
    promptText: 'Prompt text',
    categories: 'Categories',
    create: 'Create',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    apply: 'Run',
    empty: 'No prompts saved yet.',
    loading: 'Loading\u2026',
    hint: 'Create and manage reusable prompts. Click "Run" to send a prompt as a chat message.',
    newPrompt: 'New Prompt',
    namePlaceholder: 'e.g. Summary',
    descriptionPlaceholder: 'Short description (optional)',
    promptPlaceholder: 'Enter prompt text\u2026',
    categoriesPlaceholder: 'Categories (comma-separated)',
    freetext: 'Free text',
    freetextHint: 'Type and run a custom prompt directly.',
    freetextPlaceholder: 'Enter a custom prompt\u2026',
    freetextApply: 'Run',
    confirmDelete: 'Really delete?',
  };
};

const PromptsPanel: React.FC<Props> = ({ open, onClose, onApplyPrompt, uiLanguage }) => {
  const token = useSelector(
    (state: any) => state?.userSession?.token,
  ) as string | undefined;

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Create form
  const [createName, setCreateName] = useState('');
  const [createText, setCreateText] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCats, setCreateCats] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCats, setEditCats] = useState('');

  // Freetext
  const [freetext, setFreetext] = useState('');

  const t = getLabels(uiLanguage);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await getPrompts(token);
      setPrompts(res.prompts || []);
    } catch (_err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchPrompts();
  }, [open, token]);

  const handleCreate = async () => {
    if (!createName.trim() || !createText.trim()) return;
    try {
      await createPrompt(
        {
          name: createName.trim(),
          text: createText.trim(),
          description: createDesc.trim(),
          categories: createCats
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        },
        token,
      );
      setCreateName('');
      setCreateText('');
      setCreateDesc('');
      setCreateCats('');
      setShowCreate(false);
      await fetchPrompts();
    } catch (_err) {
      // ignore
    }
  };

  const startEdit = (prompt: Prompt) => {
    setEditId(prompt.id);
    setEditName(prompt.name);
    setEditText(prompt.text);
    setEditDesc(prompt.description || '');
    setEditCats((prompt.categories || []).join(', '));
  };

  const handleSave = async () => {
    if (!editId || !editName.trim() || !editText.trim()) return;
    try {
      await updatePrompt(
        {
          id: editId,
          name: editName.trim(),
          text: editText.trim(),
          description: editDesc.trim(),
          categories: editCats
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        },
        token,
      );
      setEditId(null);
      await fetchPrompts();
    } catch (_err) {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePrompt({ id }, token);
      await fetchPrompts();
    } catch (_err) {
      // ignore
    }
  };

  const handleApply = (text: string) => {
    if (!text.trim()) return;
    onApplyPrompt?.(text.trim());
    onClose();
  };

  return (
    <div
      className={`kyra-ai-chat__settings kyra-ai-chat__prompts${
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

        {/* Freetext */}
        <div className="kyra-ai-chat__prompts-freetext">
          <div className="kyra-ai-chat__prompts-freetext-label">{t.freetext}</div>
          <div className="kyra-ai-chat__settings-hint" style={{ marginBottom: 8 }}>
            {t.freetextHint}
          </div>
          <textarea
            className="kyra-ai-chat__settings-input kyra-ai-chat__prompts-textarea"
            placeholder={t.freetextPlaceholder}
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            rows={3}
          />
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            disabled={!freetext.trim()}
            onClick={() => {
              handleApply(freetext);
              setFreetext('');
            }}
            style={{ marginTop: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {t.freetextApply}
          </button>
        </div>

        {/* Divider */}
        <div className="kyra-ai-chat__prompts-divider" />

        {/* Saved Prompts Header + Create Button */}
        <div className="kyra-ai-chat__prompts-section-header">
          <div className="kyra-ai-chat__prompts-freetext-label">{t.title}</div>
          {!showCreate && (
            <button
              type="button"
              className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
              onClick={() => setShowCreate(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              + {t.newPrompt}
            </button>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="kyra-ai-chat__prompts-form">
            <input
              type="text"
              className="kyra-ai-chat__settings-input"
              placeholder={t.namePlaceholder}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <textarea
              className="kyra-ai-chat__settings-input kyra-ai-chat__prompts-textarea"
              placeholder={t.promptPlaceholder}
              value={createText}
              onChange={(e) => setCreateText(e.target.value)}
              rows={3}
            />
            <input
              type="text"
              className="kyra-ai-chat__settings-input"
              placeholder={t.descriptionPlaceholder}
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
            />
            <input
              type="text"
              className="kyra-ai-chat__settings-input"
              placeholder={t.categoriesPlaceholder}
              value={createCats}
              onChange={(e) => setCreateCats(e.target.value)}
            />
            <div className="kyra-ai-chat__prompts-form-actions">
              <button
                type="button"
                className="kyra-ai-chat__button kyra-ai-chat__button--primary"
                disabled={!createName.trim() || !createText.trim()}
                onClick={handleCreate}
              >
                {t.create}
              </button>
              <button
                type="button"
                className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
                onClick={() => setShowCreate(false)}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="kyra-ai-chat__tag-mappings-loading">{t.loading}</div>}

        {/* Empty */}
        {!loading && prompts.length === 0 && !showCreate && (
          <div className="kyra-ai-chat__tag-mappings-empty">{t.empty}</div>
        )}

        {/* Prompt List */}
        {!loading && prompts.length > 0 && (
          <div className="kyra-ai-chat__prompts-list">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="kyra-ai-chat__prompts-item">
                {editId === prompt.id ? (
                  /* Edit Mode */
                  <div className="kyra-ai-chat__prompts-form">
                    <input
                      type="text"
                      className="kyra-ai-chat__settings-input"
                      placeholder={t.namePlaceholder}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <textarea
                      className="kyra-ai-chat__settings-input kyra-ai-chat__prompts-textarea"
                      placeholder={t.promptPlaceholder}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                    <input
                      type="text"
                      className="kyra-ai-chat__settings-input"
                      placeholder={t.descriptionPlaceholder}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <input
                      type="text"
                      className="kyra-ai-chat__settings-input"
                      placeholder={t.categoriesPlaceholder}
                      value={editCats}
                      onChange={(e) => setEditCats(e.target.value)}
                    />
                    <div className="kyra-ai-chat__prompts-form-actions">
                      <button
                        type="button"
                        className="kyra-ai-chat__button kyra-ai-chat__button--primary"
                        disabled={!editName.trim() || !editText.trim()}
                        onClick={handleSave}
                      >
                        {t.save}
                      </button>
                      <button
                        type="button"
                        className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
                        onClick={() => setEditId(null)}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <>
                    <div className="kyra-ai-chat__prompts-item-header">
                      <div className="kyra-ai-chat__prompts-item-name">{prompt.name}</div>
                      <div className="kyra-ai-chat__prompts-item-actions">
                        <button
                          type="button"
                          className="kyra-ai-chat__prompts-item-btn"
                          onClick={() => handleApply(prompt.text)}
                          title={t.apply}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="kyra-ai-chat__prompts-item-btn"
                          onClick={() => startEdit(prompt)}
                          title={t.edit}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="kyra-ai-chat__prompts-item-btn kyra-ai-chat__prompts-item-btn--danger"
                          onClick={() => handleDelete(prompt.id)}
                          title={t.delete}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {prompt.description && (
                      <div className="kyra-ai-chat__prompts-item-desc">{prompt.description}</div>
                    )}
                    <div className="kyra-ai-chat__prompts-item-text">{prompt.text}</div>
                    {prompt.categories && prompt.categories.length > 0 && (
                      <div className="kyra-ai-chat__prompts-item-cats">
                        {prompt.categories.map((cat) => (
                          <span key={cat} className="kyra-ai-chat__prompts-cat-badge">{cat}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptsPanel;
