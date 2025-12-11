import React from 'react';
import { Button, Form, Modal } from 'semantic-ui-react';
import PromptFields from './PromptFields';
import PromptDropzone from './PromptDropzone';

const CreatePromptModal = ({
  open,
  onClose,
  onSubmit,
  form,
  onFieldChange,
  files,
  onFilesSelected,
  t,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    size="large"
    closeIcon
    className="kyra-centered-modal"
  >
    <Modal.Header>
      {t('Create new prompt', 'Neuen Prompt erstellen')}
    </Modal.Header>
    <Modal.Content scrolling>
      <Form>
        <PromptFields
          idPrefix="create"
          form={form}
          onChange={onFieldChange}
          t={t}
        />

        <PromptDropzone
          id="fileUploadInputCreate"
          label={t(
            'Upload files (drag & drop or button)',
            'Dateien hochladen (Drag-&-Drop oder Button)',
          )}
          message={t(
            'Drop files here or click to select',
            'Dateien hierher ziehen oder klicken, um auszuwählen',
          )}
          files={files}
          onFilesSelected={onFilesSelected}
        />
      </Form>
    </Modal.Content>

    <Modal.Actions>
      <Button onClick={onClose}>{t('Cancel', 'Abbrechen')}</Button>
      <Button primary onClick={onSubmit}>
        {t('Create prompt', 'Prompt erstellen')}
      </Button>
    </Modal.Actions>
  </Modal>
);

export default CreatePromptModal;
