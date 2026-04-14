import React, { useEffect, useState } from 'react';

type MatrixData = {
  groups: Array<{ id: string; title: string }>;
  features: string[];
  matrix: Record<string, string[]>;
};

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  chat: { en: 'Chat', de: 'Chat' },
  translate: { en: 'Translate', de: 'Übersetzen' },
  manage_glossary: { en: 'DeepL Glossary', de: 'DeepL Glossar' },
  manage_tag_mappings: { en: 'Tag Mappings', de: 'Schlagwort-Mappings' },
  manage_prompts: { en: 'Prompt Manager', de: 'Promptmanager' },
  manage_settings: { en: 'Settings', de: 'Einstellungen' },
  assistant_run: { en: 'Assistant Run', de: 'Assistent ausführen' },
};

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Berechtigungsmatrix',
      description: 'Legen Sie fest, welche Gruppen welche Funktionen nutzen dürfen.',
      save: 'Speichern',
      saving: 'Speichert…',
      saved: 'Gespeichert!',
      error: 'Fehler beim Speichern.',
      loading: 'Lade…',
      close: 'Schließen',
    };
  }
  return {
    title: 'Permission Matrix',
    description: 'Configure which groups can use which features.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved!',
    error: 'Failed to save.',
    loading: 'Loading…',
    close: 'Close',
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  uiLanguage?: string;
};

const getAuthToken = () => document.cookie.match(/auth_token=([^;]+)/)?.[1] || '';

const PermissionMatrixPanel: React.FC<Props> = ({ open, onClose, uiLanguage }) => {
  const [data, setData] = useState<MatrixData | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const isDe = (uiLanguage || '').toLowerCase().startsWith('de');
  const t = getLabels(uiLanguage);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStatus('idle');
    const headers: Record<string, string> = { Accept: 'application/json' };
    const t = getAuthToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    fetch('/++api++/@ai-permission-matrix', { headers, credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: MatrixData) => {
        setData(d);
        setMatrix(JSON.parse(JSON.stringify(d.matrix)));
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false));
  }, [open]);

  const toggle = (feature: string, groupId: string) => {
    setStatus('idle');
    setMatrix((prev) => {
      const groups = prev[feature] || [];
      const has = groups.includes(groupId);
      return {
        ...prev,
        [feature]: has
          ? groups.filter((g) => g !== groupId)
          : [...groups, groupId],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      const saveHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const st = getAuthToken();
      if (st) saveHeaders['Authorization'] = `Bearer ${st}`;
      const resp = await fetch('/++api++/@ai-permission-matrix', {
        method: 'POST',
        headers: saveHeaders,
        credentials: 'same-origin',
        body: JSON.stringify({ matrix }),
      });
      if (resp.ok) {
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="kyra-ai-chat__drawer-backdrop" onClick={onClose}>
      <div
        className="kyra-ai-chat__permission-matrix"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kyra-ai-chat__permission-matrix-header">
          <div>
            <div className="kyra-ai-chat__permission-matrix-title">
              {t.title}
            </div>
            <div className="kyra-ai-chat__permission-matrix-desc">
              {t.description}
            </div>
          </div>
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button"
            onClick={onClose}
            aria-label={t.close}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="kyra-ai-chat__permission-matrix-body">
          {loading ? (
            <div className="kyra-ai-chat__permission-matrix-loading">{t.loading}</div>
          ) : data?.groups && data?.features ? (
            <div className="kyra-ai-chat__permission-matrix-table-wrap">
              <table className="kyra-ai-chat__permission-matrix-table">
                <thead>
                  <tr>
                    <th />
                    {data.groups.map((g) => (
                      <th key={g.id}>
                        <span className="kyra-ai-chat__permission-matrix-group-label">
                          {g.title}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((feature) => (
                    <tr key={feature}>
                      <td className="kyra-ai-chat__permission-matrix-feature-label">
                        {FEATURE_LABELS[feature]?.[isDe ? 'de' : 'en'] || feature}
                      </td>
                      {data.groups.map((g) => {
                        const checked = (matrix[feature] || []).includes(g.id);
                        return (
                          <td key={g.id} className="kyra-ai-chat__permission-matrix-cell">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(feature, g.id)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="kyra-ai-chat__permission-matrix-loading">
              {t.error || 'Berechtigungen konnten nicht geladen werden.'}
            </div>
          )}
        </div>
        <div className="kyra-ai-chat__permission-matrix-footer">
          {status === 'saved' && (
            <span className="kyra-ai-chat__permission-matrix-status kyra-ai-chat__permission-matrix-status--ok">
              {t.saved}
            </span>
          )}
          {status === 'error' && (
            <span className="kyra-ai-chat__permission-matrix-status kyra-ai-chat__permission-matrix-status--error">
              {t.error}
            </span>
          )}
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrixPanel;
