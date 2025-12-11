import React from 'react';
import { Button, Divider, Form, Header, Modal } from 'semantic-ui-react';
import PromptFields from './PromptFields';
import PromptDropzone from './PromptDropzone';
import AttachedFilesTable from './AttachedFilesTable';
import PromptFilePreview from './PromptFilePreview';

const EditPromptModal = ({
  open,
  onClose,
  onSubmit,
  form,
  onFieldChange,
  newFiles,
  onFilesSelected,
  attachedFiles,
  onPreviewFile,
  onDownloadFile,
  onDeleteFile,
  selectedPreviewFile,
  t,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    size="large"
    closeIcon
    className="kyra-centered-modal"
  >
    <Modal.Header>{t('Edit prompt', 'Prompt bearbeiten')}</Modal.Header>
    <Modal.Content scrolling>
      <Form>
        <PromptFields
          idPrefix="edit"
          form={form}
          onChange={onFieldChange}
          t={t}
          categoriesLabel={t('Categories', 'Kategorien')}
        />

        <PromptDropzone
          id="fileUploadInputEdit"
          label={t(
            'Upload more files (drag & drop or button)',
            'Weitere Dateien hochladen (Drag-&-Drop oder Button)',
          )}
          message={t(
            'Drop files here or click to select',
            'Dateien hierher ziehen oder klicken, um auszuwählen',
          )}
          files={newFiles}
          onFilesSelected={onFilesSelected}
        />

        <Divider />

        <AttachedFilesTable
          files={attachedFiles}
          t={t}
          onPreview={onPreviewFile}
          onDownload={onDownloadFile}
          onDelete={onDeleteFile}
        />

        {selectedPreviewFile && (
          <>
            <Divider />
            <Header as="h3">{t('Preview', 'Vorschau')}</Header>
            <PromptFilePreview file={selectedPreviewFile} />
          </>
        )}
      </Form>
    </Modal.Content>

    <Modal.Actions>
      <Button onClick={onClose}>{t('Cancel', 'Abbrechen')}</Button>
      <Button primary onClick={onSubmit}>
        {t('Save changes', 'Änderungen speichern')}
      </Button>
    </Modal.Actions>
  </Modal>
);

export default EditPromptModal;
