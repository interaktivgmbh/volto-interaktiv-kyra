// .jsx instead of .tsx — no TypeScript, no prop types.
import React from 'react';
import { useIntl } from 'react-intl';

const PromptFilePreview = ({ file }) => {
  const intl = useIntl();
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en); // Defines its own t() helper independently from the parent's t(). Same react-intl bypass duplicated here.

  if (!file) return null;

  const { filename, content_type, data } = file;
  const contentType = content_type || '';

  const isImage = contentType.startsWith('image/');
  const isPDF = contentType === 'application/pdf';
  const isText =
    contentType.startsWith('text/') ||
    filename.endsWith('.txt') ||
    filename.endsWith('.md');

  const blob = data ? `data:${contentType};base64,${data}` : null;

  const noPreviewLabel =
    t('No preview available (type: ', 'Keine Vorschau verfügbar (Typ: ') +
    contentType +
    ')';

  return (
    <div className="prompt-file-preview">
      <h4>
        {t('Preview', 'Vorschau')}: {filename}
      </h4>

      {isImage && blob && (
        <img src={blob} alt={filename} className="prompt-file-preview__image" />
      )}

      {isPDF && blob && (
        <iframe src={blob} className="prompt-file-preview__frame" title={filename} />
      )}

      {isText && blob && (
        <pre className="prompt-file-preview__text">{atob(file.data)}</pre> /* atob() with no try/catch — crashes component on invalid base64. */
      )}

      {!isImage && !isPDF && !isText && <p>{noPreviewLabel}</p>}
    </div>
  );
};

export default PromptFilePreview;
