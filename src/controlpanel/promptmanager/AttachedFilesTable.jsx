import React, { useCallback } from 'react';
import { Button, Header, Table } from 'semantic-ui-react';
import { formatSizeMB } from './utils';

const AttachedFileRow = ({ file, t, onPreview, onDownload, onDelete }) => {
  const handlePreview = useCallback(() => onPreview(file.id), [file.id, onPreview]);
  const handleDownload = useCallback(
    () => onDownload(file.id, file.filename),
    [file.filename, file.id, onDownload],
  );
  const handleDelete = useCallback(() => onDelete(file.id), [file.id, onDelete]);

  const showThumb =
    file.content_type &&
    file.content_type.startsWith('image/') &&
    file.thumbData;

  return (
    <Table.Row>
      <Table.Cell>{file.filename}</Table.Cell>
      <Table.Cell>{formatSizeMB(file.size)}</Table.Cell>
      <Table.Cell>
        {showThumb && (
          <img
            src={`data:${file.content_type};base64,${file.thumbData}`}
            alt={file.filename}
            className="prompt-manager__thumb"
          />
        )}
      </Table.Cell>
      <Table.Cell>
        <Button size="small" onClick={handlePreview}>
          {t('Preview', 'Vorschau')}
        </Button>
      </Table.Cell>
      <Table.Cell>
        <Button size="small" color="blue" onClick={handleDownload}>
          {t('Download', 'Download')}
        </Button>
      </Table.Cell>
      <Table.Cell>
        <Button size="small" color="red" onClick={handleDelete}>
          {t('Delete', 'Löschen')}
        </Button>
      </Table.Cell>
    </Table.Row>
  );
};

const AttachedFilesTable = ({ files, t, onPreview, onDownload, onDelete }) => {
  if (!files.length) {
    return <p>{t('No files attached.', 'Keine Dateien angehängt.')}</p>;
  }

  return (
    <>
      <Header as="h2">{t('Attached files', 'Angehängte Dateien')}</Header>
      <Table basic="very" className="prompt-manager__attached-table">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{t('File', 'Datei')}</Table.HeaderCell>
            <Table.HeaderCell>{t('Size', 'Größe')}</Table.HeaderCell>
            <Table.HeaderCell>
              {t('Thumbnail', 'Thumbnail')}
            </Table.HeaderCell>
            <Table.HeaderCell>{t('Preview', 'Vorschau')}</Table.HeaderCell>
            <Table.HeaderCell>{t('Download', 'Download')}</Table.HeaderCell>
            <Table.HeaderCell>{t('Delete', 'Löschen')}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {files.map((file) => (
            <AttachedFileRow
              key={file.id}
              file={file}
              t={t}
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table>
    </>
  );
};

export default AttachedFilesTable;
