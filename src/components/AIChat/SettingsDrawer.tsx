import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { SketchPicker } from 'react-color';

import { Icon } from '@plone/volto/components';
import { robotSVG } from '../../helpers/icons';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (draft: SettingsDraft) => void;
  onClearHistory?: () => void;
  currentCustomIcon: string | null;
  currentIconColor: string;
  currentAccentColor: string | null;
  currentChatName: string | null;
  currentLanguage?: string | null;
  historyCount?: number;
  uiLanguage?: string;
};

export type SettingsDraft = {
  customIcon: string | null;
  iconColor: string;
  accentColor: string | null;
  chatName: string | null;
  language?: string | null;
};

const isSvgDataUrl = (url: string) =>
  url.startsWith('data:image/svg');

const PRESET_COLORS = [
  '#ffffff',
  '#0f172a',
  '#3b97d4',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const ACCENT_PRESETS = [
  '#3b97d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#0ea5e9',
  '#f97316',
];

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Einstellungen',
      close: 'Schließen',
      save: 'Speichern',
      iconSection: 'App-Icon',
      iconHint: 'Lade ein Bild oder SVG hoch, um das Chat-Icon zu ändern.',
      upload: 'Bild hochladen',
      reset: 'Standard wiederherstellen',
      colorLabel: 'Icon-Farbe',
      accentSection: 'Akzentfarbe',
      accentHint: 'Ändert die Hauptfarbe des Chat-Widgets.',
      accentReset: 'Standard',
      nameSection: 'App-Name',
      nameHint: 'Eigener Name statt "Volto AI Assistant".',
      namePlaceholder: 'Volto AI Assistant',
      clearHistory: 'Chat-Verlauf löschen',
      clearHistoryHint: 'Alle gespeicherten Unterhaltungen entfernen.',
      clearHistoryConfirm: 'Verlauf löschen',
      languageSection: 'Sprache',
      languageHint: 'Sprache für den Chat-Assistenten.',
    };
  }
  return {
    title: 'Settings',
    close: 'Close',
    save: 'Save',
    iconSection: 'App Icon',
    iconHint: 'Upload an image or SVG to change the launcher icon.',
    upload: 'Upload image',
    reset: 'Reset to default',
    colorLabel: 'Icon color',
    accentSection: 'Accent Color',
    accentHint: 'Changes the main color of the widget.',
    accentReset: 'Default',
    nameSection: 'App Name',
    nameHint: 'Custom name instead of "Volto AI Assistant".',
    namePlaceholder: 'Volto AI Assistant',
    clearHistory: 'Clear chat history',
    clearHistoryHint: 'Remove all saved conversations.',
    clearHistoryConfirm: 'Clear history',
    languageSection: 'Language',
    languageHint: 'Language for the chat assistant.',
  };
};

const SettingsDrawer: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  onClearHistory,
  currentCustomIcon,
  currentIconColor,
  currentAccentColor,
  currentChatName,
  currentLanguage,
  historyCount = 0,
  uiLanguage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getLabels(uiLanguage);

  const [draftIcon, setDraftIcon] = useState(currentCustomIcon);
  const [draftIconColor, setDraftIconColor] = useState(currentIconColor);
  const [draftAccent, setDraftAccent] = useState(currentAccentColor);
  const [draftName, setDraftName] = useState(currentChatName);
  const [draftLanguage, setDraftLanguage] = useState(currentLanguage || null);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const accentPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraftIcon(currentCustomIcon);
      setDraftIconColor(currentIconColor);
      setDraftAccent(currentAccentColor);
      setDraftName(currentChatName);
      setDraftLanguage(currentLanguage || null);
    } else {
      setShowAccentPicker(false);
      setShowIconPicker(false);
    }
  }, [open, currentCustomIcon, currentIconColor, currentAccentColor, currentChatName]);

  const isSvg = draftIcon ? isSvgDataUrl(draftIcon) : false;

  const hasChanges =
    draftIcon !== currentCustomIcon ||
    draftIconColor !== currentIconColor ||
    draftAccent !== currentAccentColor ||
    draftName !== currentChatName ||
    draftLanguage !== (currentLanguage || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        setDraftIcon(result);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    onSave({
      customIcon: draftIcon,
      iconColor: draftIconColor,
      accentColor: draftAccent,
      chatName: draftName,
      language: draftLanguage,
    });
  };

  return (
    <div
      className={`kyra-ai-chat__settings${
        open ? ' kyra-ai-chat__settings--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__settings-header">
        <div className="kyra-ai-chat__settings-title">{t.title}</div>
        <div className="kyra-ai-chat__settings-header-actions">
          {hasChanges && (
            <button
              type="button"
              className="kyra-ai-chat__button kyra-ai-chat__button--primary kyra-ai-chat__settings-save-btn"
              onClick={handleSave}
            >
              {t.save}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>

      <div className="kyra-ai-chat__settings-scroll">
        {/* Chat Name */}
        <div className="kyra-ai-chat__settings-section">
          <div className="kyra-ai-chat__settings-section-title">
            {t.nameSection}
          </div>
          <div className="kyra-ai-chat__settings-hint">{t.nameHint}</div>
          <input
            type="text"
            className="kyra-ai-chat__settings-input"
            value={draftName || ''}
            placeholder={t.namePlaceholder}
            onChange={(e) =>
              setDraftName(e.target.value || null)
            }
          />
        </div>

        {/* Language */}
        <div className="kyra-ai-chat__settings-section">
          <div className="kyra-ai-chat__settings-section-title">
            {t.languageSection}
          </div>
          <div className="kyra-ai-chat__settings-hint">{t.languageHint}</div>
          <div className="kyra-ai-settings-language-row">
            <button
              type="button"
              className={`kyra-ai-chat__button ${
                (draftLanguage || '').startsWith('de')
                  ? 'kyra-ai-chat__button--primary'
                  : 'kyra-ai-chat__button--ghost'
              }`}
              onClick={() => setDraftLanguage('de')}
            >
              Deutsch
            </button>
            <button
              type="button"
              className={`kyra-ai-chat__button ${
                (draftLanguage || '').startsWith('en')
                  ? 'kyra-ai-chat__button--primary'
                  : 'kyra-ai-chat__button--ghost'
              }`}
              onClick={() => setDraftLanguage('en')}
            >
              English
            </button>
          </div>
        </div>

        {/* Accent Color */}
        <div className="kyra-ai-chat__settings-section">
          <div className="kyra-ai-chat__settings-section-title">
            {t.accentSection}
          </div>
          <div className="kyra-ai-chat__settings-hint">{t.accentHint}</div>
          <div className="kyra-ai-chat__settings-color-swatches">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`kyra-ai-chat__settings-swatch${
                  (draftAccent || '#3b97d4') === color
                    ? ' kyra-ai-chat__settings-swatch--active'
                    : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() =>
                  setDraftAccent(color === '#3b97d4' ? null : color)
                }
                aria-label={color}
              />
            ))}
            <div className="kyra-ai-settings-picker-wrapper">
              <button
                type="button"
                className="kyra-ai-chat__settings-color-picker"
                onClick={() => setShowAccentPicker(!showAccentPicker)}
                aria-label="Custom color"
              />
              {showAccentPicker && (
                <div
                  ref={accentPickerRef}
                  className="kyra-ai-chat__settings-picker-popover"
                >
                  <div
                    className="kyra-ai-chat__settings-picker-cover"
                    onClick={() => setShowAccentPicker(false)}
                  />
                  <SketchPicker
                    color={draftAccent || '#3b97d4'}
                    disableAlpha
                    presetColors={ACCENT_PRESETS}
                    onChangeComplete={(color: any) =>
                      setDraftAccent(color.hex)
                    }
                  />
                </div>
              )}
            </div>
          </div>
          {draftAccent && (
            <button
              type="button"
              className="kyra-ai-chat__settings-reset-link"
              onClick={() => setDraftAccent(null)}
            >
              {t.accentReset}
            </button>
          )}
        </div>

        {/* App Icon */}
        <div className="kyra-ai-chat__settings-section">
          <div className="kyra-ai-chat__settings-section-title">
            {t.iconSection}
          </div>
          <div className="kyra-ai-chat__settings-hint">{t.iconHint}</div>

          <div className="kyra-ai-chat__settings-preview">
            {draftIcon ? (
              isSvg ? (
                <span
                  className="kyra-ai-chat__settings-preview-svg"
                  style={{
                    WebkitMaskImage: `url(${draftIcon})`,
                    maskImage: `url(${draftIcon})`,
                    backgroundColor: draftIconColor,
                  }}
                />
              ) : (
                <img
                  src={draftIcon}
                  alt="Custom icon"
                  className="kyra-ai-chat__settings-preview-img"
                />
              )
            ) : (
              <div className="kyra-ai-chat__settings-preview-default">
                <Icon name={robotSVG} size="30px" />
              </div>
            )}
          </div>

          <div className="kyra-ai-chat__settings-actions">
            <label className="kyra-ai-chat__button kyra-ai-chat__button--primary kyra-ai-chat__settings-upload-label">
              {t.upload}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                hidden
              />
            </label>
            {draftIcon && (
              <button
                type="button"
                className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
                onClick={() => setDraftIcon(null)}
              >
                {t.reset}
              </button>
            )}
          </div>

          {isSvg && (
            <div className="kyra-ai-chat__settings-color">
              <div className="kyra-ai-chat__settings-color-label">
                {t.colorLabel}
              </div>
              <div className="kyra-ai-chat__settings-color-swatches">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`kyra-ai-chat__settings-swatch${
                      draftIconColor === color
                        ? ' kyra-ai-chat__settings-swatch--active'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setDraftIconColor(color)}
                    aria-label={color}
                  />
                ))}
                <div className="kyra-ai-settings-picker-wrapper">
                  <button
                    type="button"
                    className="kyra-ai-chat__settings-color-picker"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    aria-label="Custom color"
                  />
                  {showIconPicker && (
                    <div className="kyra-ai-chat__settings-picker-popover">
                      <div
                        className="kyra-ai-chat__settings-picker-cover"
                        onClick={() => setShowIconPicker(false)}
                      />
                      <SketchPicker
                        color={draftIconColor}
                        disableAlpha
                        presetColors={PRESET_COLORS}
                        onChangeComplete={(color: any) =>
                          setDraftIconColor(color.hex)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear History */}
        {onClearHistory && historyCount > 0 && (
          <div className="kyra-ai-chat__settings-section">
            <div className="kyra-ai-chat__settings-section-title">
              {t.clearHistory}
            </div>
            <div className="kyra-ai-chat__settings-hint">
              {t.clearHistoryHint} ({historyCount})
            </div>
            <button
              type="button"
              className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
              onClick={onClearHistory}
            >
              {t.clearHistoryConfirm}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsDrawer;
