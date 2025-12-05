import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Header,
  Container,
  Loader,
  Message,
  Button,
  Icon,
  Table,
  Form,
  Modal,
  Divider,
  Progress,
} from 'semantic-ui-react';

import { Api } from '@plone/volto/helpers';
import { useIntl } from 'react-intl';

import {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  uploadPromptFiles,
  deletePromptFile,
} from '../../redux/actions';

import PromptFilePreview from './PromptFilePreview';

const api = new Api();

const modalStyleFix = (
  <style>{`
    .ui.modal.kyra-centered-modal {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;
      width: 80% !important;
      max-width: 1100px !important;
      max-height: 90vh !important;
      overflow: hidden !important;
      border-radius: 12px !important;
    }
    .ui.modal.kyra-centered-modal > .content.scrolling {
      overflow-y: auto !important;
      max-height: calc(90vh - 120px) !important;
    }
    @media (max-width: 768px) {
      .ui.modal.kyra-centered-modal {
        width: 95% !important;
      }
    }
  `}</style>
);

const formatSizeMB = (sizeBytes) => {
  if (!sizeBytes) return '0.00 MB';
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
};

const PromptManager = () => {
  const dispatch = useDispatch();
  const intl = useIntl();
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en);

  const prompts = useSelector((state) => state.kyra?.items || []);
  const loading = useSelector((state) => state.kyra?.loading);
  const error = useSelector((state) => state.kyra?.error);

  useEffect(() => {
    dispatch(getPrompts());
  }, [dispatch]);

  const makeFileItems = (fileList) =>
    Array.from(fileList || []).map((file) => ({
      file,
      previewUrl:
        file.type && file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : null,
    }));

  const clearFileItems = (items) => {
    (items || []).forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const startUploadProgress = () => {
    setUploading(true);
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 300);
    return interval;
  };

  const finishUploadProgress = (interval) => {
    if (interval) {
      clearInterval(interval);
    }
    setUploadProgress(100);
    setTimeout(() => {
      setUploading(false);
      setUploadProgress(0);
    }, 500);
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{file, previewUrl}]
  const [isDraggingCreate, setIsDraggingCreate] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    text: '',
    categories: '',
    actionType: 'replace',
  });

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      text: '',
      categories: '',
      actionType: 'replace',
    });
    clearFileItems(uploadedFiles);
    setUploadedFiles([]);
  };

  const handleCreatePrompt = async () => {
    const payload = {
      ...createForm,
      categories: createForm.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    let progressInterval = null;

    try {
      const res = await dispatch(createPrompt(payload));
      const created = res?.result || res || {};
      const promptId = created.id || created.uid;

      if (uploadedFiles.length > 0 && promptId) {
        progressInterval = startUploadProgress();
        await dispatch(
          uploadPromptFiles(
            promptId,
            uploadedFiles.map((item) => item.file),
          ),
        );
      }

      dispatch(getPrompts());
      resetCreateForm();
      setShowCreateModal(false);
    } catch (e) {
      // ignore
    } finally {
      if (progressInterval) {
        finishUploadProgress(progressInterval);
      }
    }
  };

  const handleCreateInputChange = (e) => {
    const items = makeFileItems(e.target.files);
    setUploadedFiles((prev) => [...prev, ...items]);
    e.target.value = null;
  };

  const handleCreateDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(false);

    const items = makeFileItems(e.dataTransfer.files);
    if (items.length > 0) {
      setUploadedFiles((prev) => [...prev, ...items]);
    }
  };

  const handleCreateDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(true);
  };

  const handleCreateDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCreate(false);
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    description: '',
    text: '',
    categories: '',
    actionType: 'replace',
  });

  const [editAttachedFiles, setEditAttachedFiles] = useState([]);
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);

  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);

  const loadPromptFiles = async (promptId) => {
    try {
      const result = await api.get(`/@ai-prompt-files/${promptId}`);
      const baseFiles =
        result?.files || result?.items || (Array.isArray(result) ? result : []);

      const filesWithThumbs = await Promise.all(
        baseFiles.map(async (file) => {
          if (
            file.content_type &&
            file.content_type.startsWith('image/')
          ) {
            try {
              const full = await api.get(
                `/@ai-prompt-files/${promptId}/${file.id}`,
              );
              if (full?.data) {
                return { ...file, thumbData: full.data };
              }
            } catch (e) {
              console.error('Thumbnail load failed', e);
            }
          }
          return file;
        }),
      );

      setEditAttachedFiles(filesWithThumbs);
    } catch (e) {
      setEditAttachedFiles([]);
    }
  };

  const loadPreviewFile = (promptId, fileId) => {
    api
      .get(`/@ai-prompt-files/${promptId}/${fileId}`)
      .then((file) => setSelectedPreviewFile(file))
      .catch(() => setSelectedPreviewFile(null));
  };

  const handleDownload = (promptId, fileId, fallbackFilename) => {
    api
      .get(`/@ai-prompt-files/${promptId}/${fileId}`)
      .then((file) => {
        if (!file || !file.data) {
          console.error('Keine Dateidaten im Response:', file);
          return;
        }

        const base64Data = file.data;
        const contentType =
          file.content_type || 'application/octet-stream';
        const filename =
          file.filename || fallbackFilename || 'download';

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        console.error('Download error:', err);
      });
  };

  const handleOpenEditModal = (prompt) => {
    setEditForm({
      id: prompt.id,
      name: prompt.name || '',
      description: prompt.description || '',
      text: prompt.text || '',
      categories: Array.isArray(prompt.categories)
        ? prompt.categories.join(', ')
        : '',
      actionType: prompt.actionType || 'replace',
    });

    setSelectedPreviewFile(null);
    clearFileItems(editNewFiles);
    setEditNewFiles([]);
    setShowEditModal(true);

    loadPromptFiles(prompt.id);
  };

  const handleUpdatePrompt = async () => {
    const payload = {
      ...editForm,
      categories: editForm.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    let progressInterval = null;

    try {
      await dispatch(updatePrompt(editForm.id, payload));

      if (editNewFiles.length > 0) {
        progressInterval = startUploadProgress();
        await dispatch(
          uploadPromptFiles(
            editForm.id,
            editNewFiles.map((item) => item.file),
          ),
        );
      }

      dispatch(getPrompts());
      clearFileItems(editNewFiles);
      setEditNewFiles([]);
      setShowEditModal(false);
    } catch (e) {
      // ignore
    } finally {
      if (progressInterval) {
        finishUploadProgress(progressInterval);
      }
    }
  };

  const handleEditInputChange = (e) => {
    const items = makeFileItems(e.target.files);
    setEditNewFiles((prev) => [...prev, ...items]);
    e.target.value = null;
  };

  const handleEditDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(false);

    const items = makeFileItems(e.dataTransfer.files);
    if (items.length > 0) {
      setEditNewFiles((prev) => [...prev, ...items]);
    }
  };

  const handleEditDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(true);
  };

  const handleEditDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(false);
  };

  const handleDeletePrompt = (id) => {
    dispatch(deletePrompt(id)).then(() => dispatch(getPrompts()));
  };

  const handleDeleteAttachedFile = (fileId) => {
    setEditAttachedFiles((files) => files.filter((f) => f.id !== fileId));

    dispatch(deletePromptFile(editForm.id, fileId)).then(() => {
      loadPromptFiles(editForm.id);
      dispatch(getPrompts());
    });
  };

  return (
    <Container className="prompt-manager">
      {modalStyleFix}

      <Header as="h1">
        {t('AI Prompt Manager', 'AI Prompt Manager')}
      </Header>

      <p style={{ marginTop: '1rem' }}>
        {t(
          'Manage AI prompts for the Slate editor. Create, edit and delete instructions.',
          'Verwalten Sie KI-Prompts für den Slate Editor. Erstellen, bearbeiten und löschen Sie Anweisungen.',
        )}
      </p>

      {uploading && (
        <Progress
          percent={uploadProgress}
          active
          indicating
          size="small"
          style={{ marginBottom: '1.5rem' }}
        >
          {t('Uploading files …', 'Dateien werden hochgeladen …')}
        </Progress>
      )}

      <Button
        primary={!showCreateModal}
        basic={showCreateModal}
        icon
        labelPosition="left"
        style={{ marginBottom: '2rem' }}
        onClick={() => setShowCreateModal(!showCreateModal)}
      >
        <Icon name={showCreateModal ? 'chevron up' : 'plus'} />
        {showCreateModal
          ? t('Hide', 'Ausblenden')
          : t('Create prompt', 'Prompt erstellen')}
      </Button>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        size="large"
        closeIcon
        className="kyra-centered-modal"
      >
        <Modal.Header>
          {t('Create new prompt', 'Neuen Prompt erstellen')}
        </Modal.Header>
        <Modal.Content scrolling>
          <Form>
            <Form.Field>
              <label>{t('Name', 'Name')}</label>
              <Form.Input
                value={createForm.name}
                onChange={(_, { value }) =>
                  setCreateForm({ ...createForm, name: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>{t('Description', 'Beschreibung')}</label>
              <Form.TextArea
                value={createForm.description}
                onChange={(_, { value }) =>
                  setCreateForm({ ...createForm, description: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>{t('Prompt text', 'Prompt-Text')}</label>
              <Form.TextArea
                value={createForm.text}
                onChange={(_, { value }) =>
                  setCreateForm({ ...createForm, text: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>
                {t(
                  'Categories (comma-separated)',
                  'Kategorien (durch Komma getrennt)',
                )}
              </label>
              <Form.Input
                value={createForm.categories}
                onChange={(_, { value }) =>
                  setCreateForm({ ...createForm, categories: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>
                {t(
                  'Upload files (drag & drop or button)',
                  'Dateien hochladen (Drag-&-Drop oder Button)',
                )}
              </label>

              <div
                onDragOver={handleCreateDragOver}
                onDragLeave={handleCreateDragLeave}
                onDrop={handleCreateDrop}
                style={{
                  border: '2px dashed #ccc',
                  borderRadius: 8,
                  padding: '1rem',
                  textAlign: 'center',
                  marginBottom: '0.75rem',
                  background: isDraggingCreate ? '#f0f8ff' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  document.getElementById('fileUploadInputCreate').click()
                }
              >
                <Icon name="upload" />
                <p style={{ margin: 0 }}>
                  {t(
                    'Drop files here or click to select',
                    'Dateien hierher ziehen oder klicken, um auszuwählen',
                  )}
                </p>
              </div>

              <input
                id="fileUploadInputCreate"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleCreateInputChange}
              />

              {uploadedFiles.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {uploadedFiles.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${idx}`}
                      style={{
                        width: 80,
                        fontSize: 10,
                        textAlign: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          style={{
                            width: '100%',
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 60,
                            borderRadius: 4,
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <Icon name="file outline" />
                        </div>
                      )}
                      <span title={item.file.name}>{item.file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Form.Field>
          </Form>
        </Modal.Content>

        <Modal.Actions>
          <Button
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(false);
            }}
          >
            {t('Cancel', 'Abbrechen')}
          </Button>
          <Button primary onClick={handleCreatePrompt}>
            {t('Create prompt', 'Prompt erstellen')}
          </Button>
        </Modal.Actions>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => {
          clearFileItems(editNewFiles);
          setEditNewFiles([]);
          setShowEditModal(false);
        }}
        size="large"
        closeIcon
        className="kyra-centered-modal"
      >
        <Modal.Header>
          {t('Edit prompt', 'Prompt bearbeiten')}
        </Modal.Header>
        <Modal.Content scrolling>
          <Form>
            <Form.Field>
              <label>{t('Name', 'Name')}</label>
              <Form.Input
                value={editForm.name}
                onChange={(_, { value }) =>
                  setEditForm({ ...editForm, name: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>{t('Description', 'Beschreibung')}</label>
              <Form.TextArea
                value={editForm.description}
                onChange={(_, { value }) =>
                  setEditForm({ ...editForm, description: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>{t('Prompt text', 'Prompt-Text')}</label>
              <Form.TextArea
                value={editForm.text}
                onChange={(_, { value }) =>
                  setEditForm({ ...editForm, text: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>{t('Categories', 'Kategorien')}</label>
              <Form.Input
                value={editForm.categories}
                onChange={(_, { value }) =>
                  setEditForm({ ...editForm, categories: value })
                }
              />
            </Form.Field>

            <Form.Field>
              <label>
                {t(
                  'Upload more files (drag & drop or button)',
                  'Weitere Dateien hochladen (Drag-&-Drop oder Button)',
                )}
              </label>

              <div
                onDragOver={handleEditDragOver}
                onDragLeave={handleEditDragLeave}
                onDrop={handleEditDrop}
                style={{
                  border: '2px dashed #ccc',
                  borderRadius: 8,
                  padding: '1rem',
                  textAlign: 'center',
                  marginBottom: '0.75rem',
                  background: isDraggingEdit ? '#f0f8ff' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  document.getElementById('fileUploadInputEdit').click()
                }
              >
                <Icon name="upload" />
                <p style={{ margin: 0 }}>
                  {t(
                    'Drop files here or click to select',
                    'Dateien hierher ziehen oder klicken, um auszuwählen',
                  )}
                </p>
              </div>

              <input
                id="fileUploadInputEdit"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleEditInputChange}
              />

              {editNewFiles.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {editNewFiles.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${idx}`}
                      style={{
                        width: 80,
                        fontSize: 10,
                        textAlign: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          style={{
                            width: '100%',
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 60,
                            borderRadius: 4,
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <Icon name="file outline" />
                        </div>
                      )}
                      <span title={item.file.name}>{item.file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Form.Field>

            <Divider />

            <Header as="h2">
              {t('Attached files', 'Angehängte Dateien')}
            </Header>

            {editAttachedFiles.length === 0 ? (
              <p>{t('No files attached.', 'Keine Dateien angehängt.')}</p>
            ) : (
              <Table basic="very">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>
                      {t('File', 'Datei')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('Size', 'Größe')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('Thumbnail', 'Thumbnail')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('Preview', 'Vorschau')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('Download', 'Download')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('Delete', 'Löschen')}
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {editAttachedFiles.map((file) => (
                    <Table.Row key={file.id}>
                      <Table.Cell>{file.filename}</Table.Cell>
                      <Table.Cell>{formatSizeMB(file.size)}</Table.Cell>

                      <Table.Cell>
                        {file.content_type &&
                          file.content_type.startsWith('image/') &&
                          file.thumbData && (
                            <img
                              src={`data:${file.content_type};base64,${file.thumbData}`}
                              alt={file.filename}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: 'cover',
                                borderRadius: 4,
                              }}
                            />
                          )}
                      </Table.Cell>

                      <Table.Cell>
                        <Button
                          size="small"
                          onClick={() =>
                            loadPreviewFile(editForm.id, file.id)
                          }
                        >
                          {t('Preview', 'Vorschau')}
                        </Button>
                      </Table.Cell>

                      <Table.Cell>
                        <Button
                          size="small"
                          color="blue"
                          onClick={() =>
                            handleDownload(
                              editForm.id,
                              file.id,
                              file.filename,
                            )
                          }
                        >
                          {t('Download', 'Download')}
                        </Button>
                      </Table.Cell>

                      <Table.Cell>
                        <Button
                          size="small"
                          color="red"
                          onClick={() =>
                            handleDeleteAttachedFile(file.id)
                          }
                        >
                          {t('Delete', 'Löschen')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}

            {selectedPreviewFile && (
              <>
                <Divider />
                <PromptFilePreview file={selectedPreviewFile} />
              </>
            )}
          </Form>
        </Modal.Content>

        <Modal.Actions>
          <Button
            onClick={() => {
              clearFileItems(editNewFiles);
              setEditNewFiles([]);
              setShowEditModal(false);
            }}
          >
            {t('Cancel', 'Abbrechen')}
          </Button>
          <Button primary onClick={handleUpdatePrompt}>
            {t('Save changes', 'Änderungen speichern')}
          </Button>
        </Modal.Actions>
      </Modal>

      <Header as="h1">
        {t('Existing prompts', 'Vorhandene Prompts')}
      </Header>

      {loading && (
        <Loader active>
          {t('Loading prompts …', 'Prompts werden geladen …')}
        </Loader>
      )}

      {error && (
        <Message negative>
          <Message.Header>
            {t('Error while loading', 'Fehler beim Laden')}
          </Message.Header>
          <p>{error.message}</p>
        </Message>
      )}

      <Table celled striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{t('Name', 'Name')}</Table.HeaderCell>
            <Table.HeaderCell>
              {t('Description', 'Beschreibung')}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {t('Categories', 'Kategorien')}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {t('Action', 'Aktion')}
            </Table.HeaderCell>
            <Table.HeaderCell textAlign="right">
              {t('Actions', 'Aktionen')}
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {prompts.map((prompt) => (
            <Table.Row key={prompt.id}>
              <Table.Cell>{prompt.name}</Table.Cell>
              <Table.Cell>{prompt.description}</Table.Cell>
              <Table.Cell>
                {Array.isArray(prompt.categories)
                  ? prompt.categories.join(', ')
                  : ''}
              </Table.Cell>
              <Table.Cell>
                {prompt.actionType === 'append'
                  ? t('Append', 'Anhängen')
                  : t('Replace', 'Ersetzen')}
              </Table.Cell>

              <Table.Cell textAlign="right">
                <Button
                  size="small"
                  onClick={() => handleOpenEditModal(prompt)}
                >
                  {t('Edit', 'Bearbeiten')}
                </Button>
                <Button
                  size="small"
                  color="red"
                  onClick={() => handleDeletePrompt(prompt.id)}
                >
                  {t('Delete', 'Löschen')}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  );
};

export default PromptManager;
