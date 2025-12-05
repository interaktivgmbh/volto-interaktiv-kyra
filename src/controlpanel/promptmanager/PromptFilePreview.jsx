import React from 'react';
import { useIntl } from 'react-intl';

const PromptFilePreview = ({ file }) => {
  const intl = useIntl();
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en);

  if (!file) return null;

  const { filename, content_type, data } = file;

  const isImage = content_type.startsWith('image/');
  const isPDF = content_type === 'application/pdf';
  const isText =
    content_type.startsWith('text/') ||
    filename.endsWith('.txt') ||
    filename.endsWith('.md');

  const blob = data ? `data:${content_type};base64,${data}` : null;

  const noPreviewLabel =
    t('No preview available (type: ', 'Keine Vorschau verfügbar (Typ: ') +
    content_type +
    ')';

  return (
    <div className="prompt-file-preview">
      <h4>
        {t('Preview', 'Vorschau')}: {filename}
      </h4>

      {isImage && blob && (
        <img
          src={blob}
          alt={filename}
          style={{
            maxWidth: '200px',
            borderRadius: '6px',
            marginTop: '10px',
          }}
        />
      )}

      {isPDF && blob && (
        <iframe
          src={blob}
          style={{ width: '100%', height: '300px', marginTop: '10px' }}
          title={filename}
        />
      )}

      {isText && blob && (
        <pre
          style={{
            background: '#f5f5f5',
            padding: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '10px',
          }}
        >
          {atob(file.data)}
        </pre>
      )}

      {!isImage && !isPDF && !isText && <p>{noPreviewLabel}</p>}
    </div>
  );
};

export default PromptFilePreview;
