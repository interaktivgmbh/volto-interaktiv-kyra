import React, { useState } from 'react';

import { postAiActionsApply, postAiActionsPlan } from './api';
import type { AiActionPlan, ChatContextPayload, TranslationOptions } from './types';

type Props = {
  canEdit: boolean;
  pageContext?: ChatContextPayload;
  onApplied?: (result: { reload?: boolean }) => void;
  uiLanguage?: string;
};

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      eyebrow: 'Actions',
      title: 'Plan & anwenden',
      hint: 'Beschreibe deine Änderung. Kyra AI erstellt einen Plan mit Vorschau.',
      promptLabel: 'Was soll passieren?',
      promptPlaceholder:
        'z. B. Titel auf „Quarterly Report“ setzen und Beschreibung verbessern.',
      translate: 'Übersetzen',
      translateHint: 'Optional: Inhalt in eine Zielsprache kopieren.',
      targetLabel: 'Zielsprache',
      modeLabel: 'Modus',
      modeSingle: 'Nur diese Seite',
      modeSubtree: 'Mit Unterseiten',
      overwrite: 'Bestehende Übersetzungen überschreiben',
      plan: 'Plan',
      planning: 'Planung…',
      confirm: 'Ich bestätige die vorgeschlagenen Änderungen',
      apply: 'Übernehmen',
      applying: 'Übernehme…',
      planPreview: 'Plan-Vorschau',
      noSummary: 'Keine Zusammenfassung vorhanden.',
      actionsTitle: 'Actions',
      noActions: 'Noch keine Änderungen vorgeschlagen.',
      translationTitle: 'Übersetzung',
      translationLabel: (tl: string, mode?: string) =>
        `→ ${tl}${mode ? ` (${mode})` : ''}`,
      translationPlan: 'Translation plan',
    };
  }
  return {
    eyebrow: 'Actions',
    title: 'Plan & apply',
    hint: 'Describe the change. Kyra AI will propose a plan and preview.',
    promptLabel: 'What should happen?',
    promptPlaceholder:
      'e.g. Set the title to “Quarterly Report” and improve the description.',
    translate: 'Translate',
    translateHint: 'Optionally copy content to a target language.',
    targetLabel: 'Target language',
    modeLabel: 'Mode',
    modeSingle: 'Only this page',
    modeSubtree: 'Include subtree',
    overwrite: 'Overwrite existing translations',
    plan: 'Plan',
    planning: 'Planning…',
    confirm: 'I confirm the proposed changes',
    apply: 'Apply',
    applying: 'Applying…',
    planPreview: 'Plan preview',
    noSummary: 'No summary provided.',
    actionsTitle: 'Actions',
    noActions: 'No changes proposed yet.',
    translationTitle: 'Translation',
    translationLabel: (tl: string, mode?: string) =>
        `→ ${tl}${mode ? ` (${mode})` : ''}`,
    translationPlan: 'Translation plan',
  };
};

const ActionsTab: React.FC<Props> = ({ canEdit, pageContext, onApplied, uiLanguage }) => {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<AiActionPlan | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useTranslation, setUseTranslation] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translationMode, setTranslationMode] = useState<'single' | 'subtree'>('single');
  const [overwriteTranslations, setOverwriteTranslations] = useState(false);
  const t = getLabels(uiLanguage);

  if (!canEdit) {
    return (
      <div className="kyra-ai-chat__actions">
        <p>Actions are available for editors with permissions.</p>
      </div>
    );
  }

  const pagePayload = pageContext?.page
    ? { uid: pageContext.page.uid, url: pageContext.page.url }
    : undefined;

  const handlePlan = async () => {
    if (!goal.trim() && !useTranslation) return;
    setError(null);
    setSuccess(null);
    setIsPlanning(true);

    const translation: TranslationOptions | null = useTranslation
      ? {
          target_language: targetLanguage,
          mode: translationMode,
          overwrite: overwriteTranslations,
        }
      : null;

    try {
      const response = await postAiActionsPlan({
        goal: goal.trim() || 'Translate content',
        page: pagePayload,
        constraints: {
          allowlist: [
            'update_title',
            'update_description',
            'update_language',
            'translate_content',
            'insert_text_block',
            'insert_heading_block',
            'insert_list_block',
            'insert_quote_block',
            'insert_image_block',
            'insert_block',
          ],
        },
        translation,
      });
      setPlan(response);
      setConfirmApply(false);
    } catch (_error) {
      setError('Unable to generate a plan. Please try again.');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApply = async () => {
    if (!plan || !confirmApply) return;
    setError(null);
    setSuccess(null);
    setIsApplying(true);

    const translation: TranslationOptions | null = useTranslation
      ? {
          target_language: targetLanguage,
          mode: translationMode,
          overwrite: overwriteTranslations,
        }
      : null;

    try {
      const result = await postAiActionsApply({
        plan_id: plan.plan_id,
        page: pagePayload,
        translation,
      });
      setSuccess('Changes applied successfully.');
      setConfirmApply(false);
      onApplied?.(result);
    } catch (_error) {
      setError('Unable to apply changes. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="kyra-ai-chat__actions">
      <div className="kyra-ai-chat__actions-scroll">
      <div className="kyra-ai-chat__actions-card">
        <div className="kyra-ai-chat__actions-card-header">
          <div>
            <div className="kyra-ai-chat__eyebrow">{t.eyebrow}</div>
            <div className="kyra-ai-chat__title">{t.title}</div>
            <div className="kyra-ai-chat__hint">
              {t.hint}
            </div>
          </div>
          <div className="kyra-ai-chat__badges">
            <span className="kyra-ai-chat__badge">Editor</span>
          </div>
        </div>

        <label className="kyra-ai-chat__field">
          <span>{t.promptLabel}</span>
          <textarea
            className="kyra-ai-chat__actions-input"
            placeholder={t.promptPlaceholder}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={3}
          />
        </label>

        <div className="kyra-ai-chat__actions-translation">
          <div className="kyra-ai-chat__actions-translation-header">
            <label className="kyra-ai-chat__actions-toggle">
              <input
                type="checkbox"
                checked={useTranslation}
                onChange={(event) => setUseTranslation(event.target.checked)}
              />
              {t.translate}
            </label>
            <span className="kyra-ai-chat__hint">
              {t.translateHint}
            </span>
          </div>
          <div className="kyra-ai-chat__actions-translation-grid">
            <label className="kyra-ai-chat__field">
              <span>{t.targetLabel}</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                disabled={!useTranslation}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </label>
            <label className="kyra-ai-chat__field">
              <span>{t.modeLabel}</span>
              <select
                value={translationMode}
                onChange={(event) =>
                  setTranslationMode(event.target.value as 'single' | 'subtree')
                }
                disabled={!useTranslation}
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
                disabled={!useTranslation}
              />
              {t.overwrite}
            </label>
          </div>
        </div>

        <div className="kyra-ai-chat__actions-controls">
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
            onClick={handlePlan}
            disabled={isPlanning}
          >
            {isPlanning ? t.planning : t.plan}
          </button>
          <label className="kyra-ai-chat__actions-toggle kyra-ai-chat__actions-toggle--inline">
            <input
              type="checkbox"
              checked={confirmApply}
              onChange={(event) => setConfirmApply(event.target.checked)}
              disabled={!plan}
            />
            {t.confirm}
          </label>
          <button
            type="button"
            className="kyra-ai-chat__button kyra-ai-chat__button--primary"
            onClick={handleApply}
            disabled={!plan || !confirmApply || isApplying}
          >
            {isApplying ? t.applying : t.apply}
          </button>
        </div>
      </div>
      {error && <div className="kyra-ai-chat__error">{error}</div>}
      {success && <div className="kyra-ai-chat__success">{success}</div>}
      {plan && (
        <div className="kyra-ai-chat__actions-plan">
          <div className="kyra-ai-chat__actions-plan-inner">
            <div className="kyra-ai-chat__actions-section">
              <div className="kyra-ai-chat__actions-title">{t.planPreview}</div>
              <div className="kyra-ai-chat__actions-summary">
                {plan.preview?.summary || t.noSummary}
              </div>
              {plan.preview?.diff && (
                <pre className="kyra-ai-chat__actions-diff">
                  {plan.preview.diff}
                </pre>
              )}
              {plan.preview?.human_steps &&
                plan.preview.human_steps.length > 0 && (
                  <ul className="kyra-ai-chat__actions-steps">
                    {plan.preview.human_steps.map((step, index) => (
                      <li key={`${step}-${index}`}>{step}</li>
                    ))}
                  </ul>
                )}
            </div>
            <div className="kyra-ai-chat__actions-section">
              <div className="kyra-ai-chat__actions-title">{t.actionsTitle}</div>
              {plan.actions.length === 0 ? (
                <div className="kyra-ai-chat__actions-empty">
                  {t.noActions}
                </div>
              ) : (
                <ul className="kyra-ai-chat__actions-list">
                  {plan.actions.map((action, index) => (
                    <li key={`${action.type}-${index}`}>
                      <strong>{action.type}</strong>
                      {action.payload && (
                        <pre>{JSON.stringify(action.payload, null, 2)}</pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {plan.translation_report && (
              <div className="kyra-ai-chat__actions-section">
                <div className="kyra-ai-chat__actions-title">{t.translationTitle}</div>
                <div className="kyra-ai-chat__actions-summary">
                  {plan.translation_report.target_language
                    ? t.translationLabel(
                        plan.translation_report.target_language,
                        plan.translation_report.mode || 'single',
                      )
                    : t.translationPlan}
                </div>
                <pre className="kyra-ai-chat__actions-diff">
                  {JSON.stringify(plan.translation_report, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <label className="kyra-ai-chat__actions-confirm">
            <input
              type="checkbox"
              checked={confirmApply}
              onChange={(event) => setConfirmApply(event.target.checked)}
            />
            I understand this will change the page content.
          </label>
        </div>
      )}
      </div>
    </div>
  );
};

export default ActionsTab;
