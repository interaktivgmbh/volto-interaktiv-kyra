import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { getGlossaryEntries, postGlossaryEntry, deleteGlossaryEntry, importGlossaryCsv } from './api';
import type { GlossaryEntries } from './api';

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
      title: 'DeepL Glossar',
      close: 'Schlie\u00dfen',
      sourceTerm: 'Quellbegriff',
      targetTerm: 'Zielbegriff',
      add: 'Hinzuf\u00fcgen',
      delete: 'L\u00f6schen',
      empty: 'Noch keine Glossar-Eintr\u00e4ge vorhanden.',
      hint: 'Glossar-Eintr\u00e4ge sorgen daf\u00fcr, dass bestimmte Begriffe bei der DeepL-\u00dcbersetzung immer gleich \u00fcbersetzt werden.',
      loading: 'Laden\u2026',
      sourcePlaceholder: 'z.B. Forschungszentrum',
      targetPlaceholder: 'z.B. Research Center',
      from: 'Von',
      to: 'Nach',
      synced: 'Synchronisiert',
      notSynced: 'Nicht synchronisiert',
      sync: 'Mit DeepL synchronisieren',
      syncing: 'Synchronisiere\u2026',
      importCsv: 'CSV importieren',
      importing: 'Importiere\u2026',
      importSuccess: (n: number) => `${n} Eintr\u00e4ge importiert`,
    };
  }
  return {
    title: 'DeepL Glossary',
    close: 'Close',
    sourceTerm: 'Source term',
    targetTerm: 'Target term',
    add: 'Add',
    delete: 'Delete',
    empty: 'No glossary entries yet.',
    hint: 'Glossary entries ensure that specific terms are always translated consistently by DeepL.',
    loading: 'Loading\u2026',
    sourcePlaceholder: 'e.g. Research Center',
    targetPlaceholder: 'e.g. Forschungszentrum',
    from: 'From',
    to: 'To',
    synced: 'Synced',
    notSynced: 'Not synced',
    sync: 'Sync with DeepL',
    syncing: 'Syncing\u2026',
    importCsv: 'Import CSV',
    importing: 'Importing\u2026',
    importSuccess: (n: number) => `${n} entries imported`,
  };
};

const LANGUAGE_PAIRS = [
  { source: 'de', target: 'en', label: 'DE \u2192 EN' },
  { source: 'en', target: 'de', label: 'EN \u2192 DE' },
];

const GlossaryPanel: React.FC<Props> = ({ open, onClose, uiLanguage }) => {
  const token = useSelector(
    (state: any) => state?.userSession?.token,
  ) as string | undefined;

  const [entries, setEntries] = useState<GlossaryEntries>({});
  const [glossaryId, setGlossaryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairIdx, setPairIdx] = useState(0);
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const pair = LANGUAGE_PAIRS[pairIdx];
  const t = getLabels(uiLanguage);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getGlossaryEntries(pair.source, pair.target, token)
      .then((res) => {
        setEntries(res.entries || {});
        setGlossaryId(res.glossary_id || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, pair.source, pair.target, token]);

  const handleAdd = async () => {
    const src = newSource.trim();
    const tgt = newTarget.trim();
    if (!src || !tgt) return;

    try {
      const res = await postGlossaryEntry(
        {
          source_term: src,
          target_term: tgt,
          source_lang: pair.source,
          target_lang: pair.target,
        },
        token,
      );
      setEntries(res.entries || {});
      setGlossaryId(res.glossary_id || '');
      setNewSource('');
      setNewTarget('');
    } catch (_err) {
      // Same pattern as PromptsPanel — all operations silently swallow errors. See comment there.
    }
  };

  const handleDelete = async (sourceTerm: string) => {
    try {
      const res = await deleteGlossaryEntry(
        { source_term: sourceTerm, source_lang: pair.source, target_lang: pair.target },
        token,
      );
      setEntries(res.entries || {});
      setGlossaryId(res.glossary_id || '');
    } catch (_err) {
      // ignore
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const csvData = reader.result as string;
        const res = await importGlossaryCsv(
          { csv_data: csvData, source_lang: pair.source, target_lang: pair.target },
          token,
        );
        setEntries(res.entries || {});
        setGlossaryId(res.glossary_id || '');
      } catch (_err) {
        // ignore
      } finally {
        setImporting(false);
        if (csvInputRef.current) csvInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await getGlossaryEntries(pair.source, pair.target, token);
      setEntries(res.entries || {});
      setGlossaryId(res.glossary_id || '');
    } catch (_err) {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  const rows = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));

  {// TS7016: Could not find a declaration file for module react/jsx-runtime.}
  return (
    <div
      className={`kyra-ai-chat__settings kyra-ai-chat__glossary${
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

        <div className="kyra-ai-chat__glossary-pair-selector">
          {LANGUAGE_PAIRS.map((lp, idx) => (
            <button
              key={lp.label}
              type="button"
              className={`kyra-ai-chat__glossary-pair-btn${
                idx === pairIdx ? ' kyra-ai-chat__glossary-pair-btn--active' : ''
              }`}
              onClick={() => setPairIdx(idx)}
            >
              {lp.label}
            </button>
          ))}
          <button
            type="button"
            className={`kyra-ai-chat__glossary-sync-btn${syncing ? ' kyra-ai-chat__glossary-sync-btn--syncing' : ''}`}
            disabled={syncing}
            onClick={handleSync}
            title={syncing ? t.syncing : t.sync}
            aria-label={t.sync}
          >
            {/* Inline SVGs — same issue as ChatPanel.tsx. */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
              <path d="M20.49 15a9 9 0 01-14.85 3.36L1 14" />
            </svg>
          </button>
        </div>

        {loading && <div className="kyra-ai-chat__tag-mappings-loading">{t.loading}</div>}

        {!loading && rows.length === 0 && (
          <div className="kyra-ai-chat__tag-mappings-empty">{t.empty}</div>
        )}

        {!loading && rows.length > 0 && (
          <div className="kyra-ai-chat__tag-mappings-table">
            <div className="kyra-ai-chat__tag-mappings-row kyra-ai-chat__tag-mappings-row--header kyra-ai-chat__glossary-row">
              <div>{t.sourceTerm}</div>
              <div>{t.targetTerm}</div>
              <div />
            </div>
            {rows.map(([src, tgt]) => (
              <div key={src} className="kyra-ai-chat__tag-mappings-row kyra-ai-chat__glossary-row">
                <div>{src}</div>
                <div>{tgt}</div> // TS2322
                <div>
                  <button
                    type="button"
                    className="kyra-ai-chat__tag-mappings-delete"
                    onClick={() => handleDelete(src)}
                    aria-label={t.delete}
                    title={t.delete}
                  >
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
            placeholder={t.sourcePlaceholder}
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
          />
          <input
            type="text"
            className="kyra-ai-chat__settings-input"
            placeholder={t.targetPlaceholder}
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            disabled={!newSource.trim() || !newTarget.trim()}
            onClick={handleAdd}
          >
            {t.add}
          </button>
        </div>

        <div className="kyra-ai-chat__glossary-csv">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.tsv,text/csv"
            style={{ display: 'none' }}
            onChange={handleCsvImport}
          />
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--secondary"
            disabled={importing}
            onClick={() => csvInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {importing ? t.importing : t.importCsv}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlossaryPanel;
