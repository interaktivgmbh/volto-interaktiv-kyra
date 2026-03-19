import React, { useState } from 'react';

import { postAiActionsApply, postAiActionsPlan } from './api';
import type { ChatCapabilities, ChatContextPayload, TranslationOptions, TranslationStatus } from './types';
import { hasPermission } from './types';

type Props = {
  canEdit: boolean;
  capabilities?: ChatCapabilities;
  pageContext?: ChatContextPayload;
  onApplied?: (result: { reload?: boolean }) => void;
  uiLanguage?: string;
  translationStatus?: TranslationStatus | null;
  onRefetchTranslationStatus?: () => Promise<void>;
};

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      eyebrow: 'Übersetzung',
      translate: 'Übersetzen',
      translateHint: 'Inhalt in eine Zielsprache übersetzen.',
      targetLabel: 'Zielsprache',
      modeLabel: 'Modus',
      modeSingle: 'Nur diese Seite',
      modeSubtree: 'Mit Unterseiten',
      overwrite: 'Bestehende Übersetzungen überschreiben',
      apply: 'Übersetzen',
      applying: 'Übersetze…',
      syncTitle: 'Veraltete Übersetzungen',
      syncHint: 'Folgende Übersetzungen sind nicht mehr aktuell:',
      syncButton: 'Synchronisieren',
      syncing: 'Synchronisiere…',
      syncLastModified: 'Letzte Änderung',
    };
  }
  return {
    eyebrow: 'Translation',
    translate: 'Translate',
    translateHint: 'Translate content to a target language.',
    targetLabel: 'Target language',
    modeLabel: 'Mode',
    modeSingle: 'Only this page',
    modeSubtree: 'Include subtree',
    overwrite: 'Overwrite existing translations',
    apply: 'Translate',
    applying: 'Translating…',
    syncTitle: 'Outdated translations',
    syncHint: 'The following translations are out of date:',
    syncButton: 'Sync now',
    syncing: 'Syncing…',
    syncLastModified: 'Last modified',
  };
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
};

const DEFAULT_CAPS: ChatCapabilities = { is_anonymous: true, can_edit: false, features: [] };

const ActionsTab: React.FC<Props> = ({ canEdit, capabilities = DEFAULT_CAPS, pageContext, onApplied, uiLanguage, translationStatus, onRefetchTranslationStatus }) => {
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translationMode, setTranslationMode] = useState<'single' | 'subtree'>('single');
  const [overwriteTranslations, setOverwriteTranslations] = useState(false);
  const [syncingLang, setSyncingLang] = useState<string | null>(null);
  const t = getLabels(uiLanguage);

  if (!hasPermission(capabilities, 'translate')) {
    return (
      <div className="kyra-ai-chat__actions">
        <p>Actions are available for editors with permissions.</p>
      </div>
    );
  }

  const pagePayload = pageContext?.page
    ? { uid: pageContext.page.uid, url: pageContext.page.url }
    : undefined;

  const handleTranslate = async () => {
    setError(null);
    setSuccess(null);
    setIsApplying(true);

    const translation: TranslationOptions = {
      target_language: targetLanguage,
      mode: translationMode,
      overwrite: overwriteTranslations,
    };

    try {
      const planResponse = await postAiActionsPlan({
        goal: 'Translate content',
        page: pagePayload,
        constraints: { allowlist: ['translate_content'] },
        translation,
      });
      const result = await postAiActionsApply({
        plan_id: planResponse.plan_id,
        actions: planResponse.actions,
        page: pagePayload,
        translation,
      });
      setSuccess(
        uiLanguage?.startsWith('de')
          ? `Übersetzung nach ${LANGUAGE_NAMES[targetLanguage] || targetLanguage} erfolgreich.`
          : `Translation to ${LANGUAGE_NAMES[targetLanguage] || targetLanguage} completed successfully.`,
      );
      await onRefetchTranslationStatus?.();
      onApplied?.(result);
    } catch (_error) {
      setError(
        uiLanguage?.startsWith('de')
          ? 'Übersetzung fehlgeschlagen.'
          : 'Translation failed. Please try again.',
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleSync = async (lang: string) => {
    setSyncingLang(lang);
    setError(null);
    setSuccess(null);

    const translation: TranslationOptions = {
      target_language: lang,
      mode: 'single',
      overwrite: true,
    };

    try {
      const planResponse = await postAiActionsPlan({
        goal: 'Translate content',
        page: pagePayload,
        constraints: { allowlist: ['translate_content'] },
        translation,
      });
      await postAiActionsApply({
        plan_id: planResponse.plan_id,
        actions: planResponse.actions,
        page: pagePayload,
        translation,
      });
      setSuccess(
        uiLanguage?.startsWith('de')
          ? `Übersetzung nach ${LANGUAGE_NAMES[lang] || lang} synchronisiert.`
          : `Translation to ${LANGUAGE_NAMES[lang] || lang} synced successfully.`,
      );
      await onRefetchTranslationStatus?.();
      onApplied?.({ reload: false });
    } catch (_error) {
      setError(
        uiLanguage?.startsWith('de')
          ? 'Synchronisation fehlgeschlagen.'
          : 'Sync failed. Please try again.',
      );
    } finally {
      setSyncingLang(null);
    }
  };

  const outdatedTranslations = (translationStatus?.translations || []).filter(
    (item) => item.is_outdated,
  );

  return (
    <div className="kyra-ai-chat__actions">
      <div className="kyra-ai-chat__actions-scroll">
      <div className="kyra-ai-chat__actions-card">
        <div className="kyra-ai-chat__actions-card-header">
          <div>
            <div className="kyra-ai-chat__eyebrow">{t.eyebrow}</div>
            <div className="kyra-ai-chat__title">{t.translate}</div>
            <div className="kyra-ai-chat__hint">
              {t.translateHint}
            </div>
          </div>
          <div className="kyra-ai-chat__badges">
            <span className="kyra-ai-chat__badge">Editor</span>
          </div>
        </div>

        <div className="kyra-ai-chat__actions-translation">
          <div className="kyra-ai-chat__actions-translation-grid">
            <label className="kyra-ai-chat__field">
              <span>{t.targetLabel}</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </label>
            <label className="kyra-ai-chat__field">
              <span>{t.modeLabel}</span>
              <select
                value={translationMode}
                onChange={(event) =>
                  setTranslationMode(event.target.value as 'single' | 'subtree')
                }
              >
                <option value="single">{t.modeSingle}</option>
                <option value="subtree">{t.modeSubtree}</option>
              </select>
            </label>
            <label className="kyra-ai-chat__actions-toggle kyra-ai-chat__actions-toggle--inline">
              <input
                type="checkbox"
                checked={overwriteTranslations}
                onChange={(event) => setOverwriteTranslations(event.target.checked)}
              />
              {t.overwrite}
            </label>
          </div>
        </div>

        {outdatedTranslations.length > 0 && (
          <div className="kyra-ai-chat__sync-card">
            <div className="kyra-ai-chat__sync-title">{t.syncTitle}</div>
            <div className="kyra-ai-chat__hint">{t.syncHint}</div>
            <div className="kyra-ai-chat__sync-list">
              {outdatedTranslations.map((item) => (
                <div key={item.language} className="kyra-ai-chat__sync-item">
                  <div className="kyra-ai-chat__sync-item-info">
                    <span className="kyra-ai-chat__sync-badge" />
                    <strong>{LANGUAGE_NAMES[item.language] || item.language}</strong>
                    {item.title && <span> — &ldquo;{item.title}&rdquo;</span>}
                    <div className="kyra-ai-chat__sync-modified">
                      {t.syncLastModified}: {new Date(item.modified).toLocaleDateString(
                        uiLanguage?.startsWith('de') ? 'de-DE' : 'en-US',
                        { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="kyra-ai-chat__button kyra-ai-chat__button--primary kyra-ai-chat__button--small"
                    onClick={() => handleSync(item.language)}
                    disabled={syncingLang !== null}
                  >
                    {syncingLang === item.language ? t.syncing : t.syncButton}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="kyra-ai-chat__actions-controls">
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            onClick={handleTranslate}
            disabled={isApplying}
          >
            {isApplying ? t.applying : t.apply}
          </button>
        </div>
      </div>
      {error && <div className="kyra-ai-chat__error">{error}</div>}
      {success && <div className="kyra-ai-chat__success">{success}</div>}
      </div>
    </div>
  );
};

export default ActionsTab;
