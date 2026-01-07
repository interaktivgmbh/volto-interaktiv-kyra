import React, { useState } from 'react';

import { postAiActionsApply, postAiActionsPlan } from './api';
import type { AiActionPlan, ChatContextPayload, TranslationOptions } from './types';

type Props = {
  canEdit: boolean;
  pageContext?: ChatContextPayload;
  onApplied?: (result: { reload?: boolean }) => void;
};

const ActionsTab: React.FC<Props> = ({ canEdit, pageContext, onApplied }) => {
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
      <p>
        Describe the change you want. Kyra AI will propose a plan and preview
        before applying any edits.
      </p>
      <textarea
        className="kyra-ai-chat__actions-input"
        placeholder="e.g. Update the title to “Quarterly Report” and improve the description."
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        rows={3}
      />
      <div className="kyra-ai-chat__actions-translation">
        <div className="kyra-ai-chat__actions-translation-header">
          <label className="kyra-ai-chat__actions-toggle">
            <input
              type="checkbox"
              checked={useTranslation}
              onChange={(event) => setUseTranslation(event.target.checked)}
            />
            Translate
          </label>
          <div className="kyra-ai-chat__actions-translation-grid">
            <label>
              Target language
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
            <label>
              Mode
              <select
                value={translationMode}
                onChange={(event) =>
                  setTranslationMode(event.target.value as 'single' | 'subtree')
                }
                disabled={!useTranslation}
              >
                <option value="single">Only this page</option>
                <option value="subtree">Include subtree</option>
              </select>
            </label>
            <label className="kyra-ai-chat__actions-toggle">
              <input
                type="checkbox"
                checked={overwriteTranslations}
                onChange={(event) => setOverwriteTranslations(event.target.checked)}
                disabled={!useTranslation}
              />
              Overwrite existing translations
            </label>
          </div>
        </div>
      </div>
      <div className="kyra-ai-chat__actions-controls">
        <button type="button" onClick={handlePlan} disabled={isPlanning}>
          {isPlanning ? 'Planning…' : 'Plan'}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!plan || !confirmApply || isApplying}
        >
          {isApplying ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {error && <div className="kyra-ai-chat__error">{error}</div>}
      {success && <div className="kyra-ai-chat__success">{success}</div>}
      {plan && (
        <div className="kyra-ai-chat__actions-plan">
          <div className="kyra-ai-chat__actions-plan-inner">
            <div className="kyra-ai-chat__actions-section">
              <div className="kyra-ai-chat__actions-title">Plan preview</div>
              <div className="kyra-ai-chat__actions-summary">
                {plan.preview?.summary || 'No summary provided.'}
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
              <div className="kyra-ai-chat__actions-title">Actions</div>
              {plan.actions.length === 0 ? (
                <div className="kyra-ai-chat__actions-empty">
                  No changes proposed yet.
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
                <div className="kyra-ai-chat__actions-title">Translation</div>
                <div className="kyra-ai-chat__actions-summary">
                  {plan.translation_report.target_language
                    ? `→ ${plan.translation_report.target_language} (${plan.translation_report.mode || 'single'})`
                    : 'Translation plan'}
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
  );
};

export default ActionsTab;
