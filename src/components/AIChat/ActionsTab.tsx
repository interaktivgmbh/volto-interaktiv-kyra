import React, { useState } from 'react';

import { postAiActionsApply, postAiActionsPlan } from './api';
import type { AiActionPlan, ChatContextPayload } from './types';

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
    if (!goal.trim()) return;
    setError(null);
    setSuccess(null);
    setIsPlanning(true);
    try {
      const response = await postAiActionsPlan({
        goal: goal.trim(),
        page: pagePayload,
        constraints: { allowlist: ['update_title', 'update_description', 'update_language'] },
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
    try {
      const result = await postAiActionsApply({
        plan_id: plan.plan_id,
        page: pagePayload,
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
