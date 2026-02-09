import React, { useRef } from 'react';

import { Icon } from '@plone/volto/components';
import { robotSVG } from '../../helpers/icons';

type Props = {
  open: boolean;
  onClose: () => void;
  onIconChange: (dataUrl: string | null) => void;
  onIconColorChange: (color: string) => void;
  currentCustomIcon: string | null;
  currentIconColor: string;
  uiLanguage?: string;
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

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Einstellungen',
      close: 'Schließen',
      iconSection: 'App-Icon',
      iconHint: 'Lade ein Bild oder SVG hoch, um das Chat-Icon zu ändern.',
      upload: 'Bild hochladen',
      reset: 'Standard wiederherstellen',
      colorLabel: 'Icon-Farbe',
    };
  }
  return {
    title: 'Settings',
    close: 'Close',
    iconSection: 'App Icon',
    iconHint: 'Upload an image or SVG to change the chat launcher icon.',
    upload: 'Upload image',
    reset: 'Reset to default',
    colorLabel: 'Icon color',
  };
};

const SettingsDrawer: React.FC<Props> = ({
  open,
  onClose,
  onIconChange,
  onIconColorChange,
  currentCustomIcon,
  currentIconColor,
  uiLanguage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getLabels(uiLanguage);

  const isSvg = currentCustomIcon ? isSvgDataUrl(currentCustomIcon) : false;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        onIconChange(result);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`kyra-ai-chat__settings${
        open ? ' kyra-ai-chat__settings--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__settings-header">
        <div className="kyra-ai-chat__settings-title">{t.title}</div>
        <button type="button" onClick={onClose}>
          {t.close}
        </button>
      </div>

      <div className="kyra-ai-chat__settings-section">
        <div className="kyra-ai-chat__settings-section-title">
          {t.iconSection}
        </div>
        <div className="kyra-ai-chat__settings-hint">{t.iconHint}</div>

        <div className="kyra-ai-chat__settings-preview">
          {currentCustomIcon ? (
            isSvg ? (
              <span
                className="kyra-ai-chat__settings-preview-svg"
                style={{
                  WebkitMaskImage: `url(${currentCustomIcon})`,
                  maskImage: `url(${currentCustomIcon})`,
                  backgroundColor: currentIconColor,
                }}
              />
            ) : (
              <img
                src={currentCustomIcon}
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
          {currentCustomIcon && (
            <button
              type="button"
              className="kyra-ai-chat__button kyra-ai-chat__button--ghost"
              onClick={() => onIconChange(null)}
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
                    currentIconColor === color
                      ? ' kyra-ai-chat__settings-swatch--active'
                      : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onIconColorChange(color)}
                  aria-label={color}
                />
              ))}
              <input
                type="color"
                className="kyra-ai-chat__settings-color-picker"
                value={currentIconColor}
                onChange={(e) => onIconColorChange(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsDrawer;
