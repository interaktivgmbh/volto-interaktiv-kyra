import React, { useState, useEffect } from 'react';

type ToolCallStep = {
  name: string;
  description: string;
};

type ThinkingStepsProps = {
  steps: ToolCallStep[];
  isRunning?: boolean;
  onRestoreState?: (messageUid: string) => void;
  messageUid?: string;
};

const ThinkingSteps = ({ steps, isRunning, onRestoreState, messageUid }: ThinkingStepsProps) => {
  const [expanded, setExpanded] = useState(!!isRunning);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isRunning) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [isRunning]);

  if (!steps || steps.length === 0) return null;

  const handleRestore = () => {
    if (!onRestoreState || !messageUid) return;
    onRestoreState(messageUid);
    setShowConfirm(false);
  };

  return (
    <div className={`kyra-thinking ${isRunning ? 'kyra-thinking--running' : ''}`}>
      <button className="kyra-thinking__toggle" onClick={() => setExpanded(e => !e)} type="button">
        <span className="kyra-thinking__icon">{expanded ? '▼' : '▶'}</span>
        <span className="kyra-thinking__label">
          {isRunning
            ? `${steps.length} Schritte\u2026`
            : `${steps.length} Schritte${expanded ? '' : ' anzeigen'}`}
        </span>
      </button>
      {expanded && (
        <ul className="kyra-thinking__steps">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const showSpinner = isRunning && isLast;
            return (
              <li
                key={`${step.name}-${i}`}
                className={`kyra-thinking__step ${showSpinner ? 'kyra-thinking__step--active' : ''}`}
              >
                <span className="kyra-thinking__step-icon">
                  {showSpinner ? '⟳' : '✓'}
                </span>
                <span className="kyra-thinking__step-text">
                  {step.description || step.name}
                </span>
              </li>
            );
          })}
          {!isRunning && onRestoreState && messageUid && !showConfirm && (
            <li className="kyra-thinking__step">
              <button
                type="button"
                className="kyra-thinking__restore-btn"
                onClick={() => setShowConfirm(true)}
              >
                ↩ Zu diesem Stand zurückkehren
              </button>
            </li>
          )}
          {showConfirm && (
            <li className="kyra-thinking__confirm">
              <p className="kyra-thinking__confirm-text">
                Seitenstand wiederherstellen? Ungespeicherte Änderungen gehen verloren.
              </p>
              <div className="kyra-thinking__confirm-actions">
                <button
                  type="button"
                  className="kyra-thinking__confirm-btn kyra-thinking__confirm-btn--yes"
                  onClick={handleRestore}
                >
                  Wiederherstellen
                </button>
                <button
                  type="button"
                  className="kyra-thinking__confirm-btn kyra-thinking__confirm-btn--no"
                  onClick={() => setShowConfirm(false)}
                >
                  Abbrechen
                </button>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ThinkingSteps;
