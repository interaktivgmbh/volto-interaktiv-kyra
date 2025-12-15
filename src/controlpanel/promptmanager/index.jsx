import React, { useCallback, useEffect, useReducer } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Header, Container, Button, Icon, Progress, Message } from 'semantic-ui-react';
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

import CreatePromptModal from './CreatePromptModal';
import EditPromptModal from './EditPromptModal';
import PromptList from './PromptList';
import { splitCategories } from './utils';

const api = new Api();

const initialState = {
  uploadProgress: 0,
  uploading: false,
  submitting: false,
  showCreateModal: false,
  showEditModal: false,
  createForm: {
    name: '',
    description: '',
    text: '',
    categories: '',
    actionType: 'replace',
  },
  editForm: {
    id: '',
    name: '',
    description: '',
    text: '',
    categories: '',
    actionType: 'replace',
  },
  uploadedFiles: [],
  editAttachedFiles: [],
  editNewFiles: [],
  selectedPreviewFile: null,
  formErrors: {
    create: {},
    edit: {},
  },
  status: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_MODAL':
      return { ...state, [action.modal]: action.value };
    case 'SET_CREATE_FIELD':
      return {
        ...state,
        createForm: { ...state.createForm, [action.field]: action.value },
      };
    case 'RESET_CREATE_FORM':
      return {
        ...state,
        createForm: initialState.createForm,
        uploadedFiles: [],
        formErrors: { ...state.formErrors, create: {} },
      };
    case 'SET_EDIT_FIELD':
      return {
        ...state,
        editForm: { ...state.editForm, [action.field]: action.value },
      };
    case 'SET_EDIT_FORM':
      return { ...state, editForm: { ...initialState.editForm, ...action.form } };
    case 'APPEND_UPLOADED_FILES':
      return {
        ...state,
        uploadedFiles: [...state.uploadedFiles, ...action.files],
      };
    case 'CLEAR_UPLOADED_FILES':
      return { ...state, uploadedFiles: [] };
    case 'SET_EDIT_ATTACHED_FILES':
      return { ...state, editAttachedFiles: action.files };
    case 'APPEND_EDIT_NEW_FILES':
      return {
        ...state,
        editNewFiles: [...state.editNewFiles, ...action.files],
      };
    case 'SET_EDIT_NEW_FILES':
      return { ...state, editNewFiles: action.files };
    case 'SET_SELECTED_PREVIEW_FILE':
      return { ...state, selectedPreviewFile: action.file };
    case 'SET_FORM_ERRORS':
      return {
        ...state,
        formErrors: { ...state.formErrors, [action.scope]: action.errors || {} },
      };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'CLEAR_STATUS':
      return { ...state, status: null };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value };
    case 'UPLOAD_START':
      return { ...state, uploading: true, uploadProgress: 10 };
    case 'UPLOAD_INCREMENT':
      return {
        ...state,
        uploadProgress:
          state.uploadProgress < 90
            ? state.uploadProgress + 10
            : state.uploadProgress,
      };
    case 'UPLOAD_COMPLETE':
      return { ...state, uploadProgress: 100 };
    case 'UPLOAD_RESET':
      return { ...state, uploading: false, uploadProgress: 0 };
    default:
      return state;
  }
};

const makeFileItems = (files) =>
  (files || []).map((file) => ({
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

const PromptManager = () => {
  const reduxDispatch = useDispatch();
  const intl = useIntl();
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en);

  const prompts = useSelector((state) => state.kyra?.items || []);
  const loading = useSelector((state) => state.kyra?.loading);
  const error = useSelector((state) => state.kyra?.error);

  const [
    {
      uploadProgress,
      uploading,
      submitting,
      showCreateModal,
      showEditModal,
      createForm,
      editForm,
      uploadedFiles,
      editAttachedFiles,
      editNewFiles,
      selectedPreviewFile,
      formErrors,
      status,
    },
    localDispatch,
  ] = useReducer(reducer, initialState);

  useEffect(() => {
    reduxDispatch(getPrompts());
  }, [reduxDispatch]);

  const startUploadProgress = useCallback(() => {
    localDispatch({ type: 'UPLOAD_START' });
    const interval = setInterval(() => {
      localDispatch({ type: 'UPLOAD_INCREMENT' });
    }, 300);
    return interval;
  }, []);

  const finishUploadProgress = useCallback((interval) => {
    if (interval) {
      clearInterval(interval);
    }
    localDispatch({ type: 'UPLOAD_COMPLETE' });
    setTimeout(() => localDispatch({ type: 'UPLOAD_RESET' }), 500);
  }, []);

  const resetCreateForm = useCallback(() => {
    clearFileItems(uploadedFiles);
    localDispatch({ type: 'RESET_CREATE_FORM' });
  }, [uploadedFiles]);

  const resetEditFiles = useCallback(() => {
    clearFileItems(editNewFiles);
    localDispatch({ type: 'SET_EDIT_NEW_FILES', files: [] });
  }, [editNewFiles]);

  const handleCloseCreateModal = useCallback(() => {
    resetCreateForm();
    localDispatch({ type: 'SET_FORM_ERRORS', scope: 'create', errors: {} });
    localDispatch({ type: 'SET_MODAL', modal: 'showCreateModal', value: false });
  }, [resetCreateForm]);

  const handleCloseEditModal = useCallback(() => {
    resetEditFiles();
    localDispatch({ type: 'SET_SELECTED_PREVIEW_FILE', file: null });
    localDispatch({ type: 'SET_FORM_ERRORS', scope: 'edit', errors: {} });
    localDispatch({ type: 'SET_MODAL', modal: 'showEditModal', value: false });
  }, [resetEditFiles]);

  const handleCreateFieldChange = useCallback((field, value) => {
    localDispatch({ type: 'SET_CREATE_FIELD', field, value });
  }, []);

  const handleEditFieldChange = useCallback((field, value) => {
    localDispatch({ type: 'SET_EDIT_FIELD', field, value });
  }, []);

  const handleAddCreateFiles = useCallback(
    (files) => {
      const items = makeFileItems(files);
      if (items.length) {
        localDispatch({ type: 'APPEND_UPLOADED_FILES', files: items });
      }
    },
    [],
  );

  const handleAddEditFiles = useCallback(
    (files) => {
      const items = makeFileItems(files);
      if (items.length) {
        localDispatch({ type: 'APPEND_EDIT_NEW_FILES', files: items });
      }
    },
    [],
  );

  const loadPromptFiles = useCallback(async (promptId) => {
    try {
      const result = await api.get(`/@ai-prompt-files/${promptId}`);
      const baseFiles =
        result?.files || result?.items || (Array.isArray(result) ? result : []);

      const filesWithMeta = [];
      for (const file of baseFiles) {
        let full = null;
        try {
          full = await api.get(`/@ai-prompt-files/${promptId}/${file.id}`);
        } catch (e) {
          // ignore missing full file; fall back to base meta
        }

        const contentType =
          file.content_type ||
          full?.content_type ||
          file.contentType ||
          full?.contentType ||
          null;

        let size = file.size || file.length || full?.size || null;
        if (!size && full?.data) {
          try {
            size = atob(full.data).length;
          } catch (e) {
            size = null;
          }
        }

        const enriched = {
          ...file,
          content_type: contentType,
          size,
        };

        if (contentType && contentType.startsWith('image/') && full?.data) {
          enriched.thumbData = full.data;
        }

        filesWithMeta.push(enriched);
      }

      localDispatch({
        type: 'SET_EDIT_ATTACHED_FILES',
        files: filesWithMeta,
      });
    } catch (e) {
      localDispatch({ type: 'SET_EDIT_ATTACHED_FILES', files: [] });
    }
  }, []);

  const loadPreviewFile = useCallback(async (promptId, fileId) => {
    try {
      const file = await api.get(`/@ai-prompt-files/${promptId}/${fileId}`);
      localDispatch({ type: 'SET_SELECTED_PREVIEW_FILE', file });
    } catch (e) {
      localDispatch({ type: 'SET_SELECTED_PREVIEW_FILE', file: null });
    }
  }, []);

  const handleDownload = useCallback(async (promptId, fileId, fallbackFilename) => {
    try {
      const file = await api.get(`/@ai-prompt-files/${promptId}/${fileId}`);
      if (!file || !file.data) {
        return;
      }

      const base64Data = file.data;
      const contentType = file.content_type || 'application/octet-stream';
      const filename = file.filename || fallbackFilename || 'download';

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
    } catch (error) {
      // ignore download errors
    }
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    localDispatch({ type: 'CLEAR_STATUS' });
    localDispatch({ type: 'SET_MODAL', modal: 'showCreateModal', value: true });
  }, []);

  const validateForm = useCallback(
    (form) => {
      const errors = {};
      if (!form.name || !form.name.trim()) {
        errors.name = t('Name is required', 'Name ist erforderlich');
      }
      if (!form.text || !form.text.trim()) {
        errors.text = t('Prompt text is required', 'Prompt-Text ist erforderlich');
      }
      return errors;
    },
    [t],
  );

  const submitPrompt = useCallback(
    async ({ mode, form, files = [] }) => {
      const payload = {
        ...form,
        categories: splitCategories(form.categories),
      };

      let progressInterval = null;

      try {
        const response =
          mode === 'create'
            ? await reduxDispatch(createPrompt(payload))
            : await reduxDispatch(updatePrompt(form.id, payload));

        const created = response?.result || response || {};
        const promptId =
          mode === 'create' ? created.id || created.uid : form.id;

        if (files.length > 0 && promptId) {
          progressInterval = startUploadProgress();
          await reduxDispatch(
            uploadPromptFiles(promptId, files.map((item) => item.file)),
          );
        }

        reduxDispatch(getPrompts());
        return promptId;
      } catch (e) {
        return null;
      } finally {
        if (progressInterval) {
          finishUploadProgress(progressInterval);
        }
      }
    },
    [finishUploadProgress, reduxDispatch, startUploadProgress],
  );

  const handleCreatePrompt = useCallback(async () => {
    const errors = validateForm(createForm);
    localDispatch({ type: 'SET_FORM_ERRORS', scope: 'create', errors });
    if (Object.keys(errors).length) {
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'error',
          message: t('Please fill out the required fields.', 'Bitte die Pflichtfelder ausfüllen.'),
        },
      });
      return;
    }

    localDispatch({ type: 'SET_STATUS', status: null });
    localDispatch({ type: 'SET_SUBMITTING', value: true });

    const promptId = await submitPrompt({
      mode: 'create',
      form: createForm,
      files: uploadedFiles,
    });

    localDispatch({ type: 'SET_SUBMITTING', value: false });

    if (promptId) {
      resetCreateForm();
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'success',
          message: t('Prompt created successfully.', 'Prompt wurde erfolgreich erstellt.'),
        },
      });
      localDispatch({
        type: 'SET_MODAL',
        modal: 'showCreateModal',
        value: false,
      });
      localDispatch({ type: 'SET_FORM_ERRORS', scope: 'create', errors: {} });
    } else {
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'error',
          message: t('Creating the prompt failed.', 'Prompt konnte nicht erstellt werden.'),
        },
      });
    }
  }, [
    createForm,
    resetCreateForm,
    submitPrompt,
    uploadedFiles,
    t,
    validateForm,
  ]);

  const handleOpenEditModal = useCallback(
    (prompt) => {
      localDispatch({
        type: 'SET_EDIT_FORM',
        form: {
          id: prompt.id,
          name: prompt.name || '',
          description: prompt.description || '',
          text: prompt.text || '',
          categories: Array.isArray(prompt.categories)
            ? prompt.categories.join(', ')
            : '',
          actionType: prompt.actionType || 'replace',
        },
      });

      localDispatch({ type: 'SET_EDIT_ATTACHED_FILES', files: [] });
      localDispatch({ type: 'SET_SELECTED_PREVIEW_FILE', file: null });
      resetEditFiles();
      localDispatch({ type: 'SET_MODAL', modal: 'showEditModal', value: true });
      loadPromptFiles(prompt.id);
    },
    [loadPromptFiles, resetEditFiles],
  );

  const handleUpdatePrompt = useCallback(async () => {
    const errors = validateForm(editForm);
    localDispatch({ type: 'SET_FORM_ERRORS', scope: 'edit', errors });
    if (Object.keys(errors).length) {
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'error',
          message: t('Please fill out the required fields.', 'Bitte die Pflichtfelder ausfüllen.'),
        },
      });
      return;
    }

    localDispatch({ type: 'SET_STATUS', status: null });
    localDispatch({ type: 'SET_SUBMITTING', value: true });

    const promptId = await submitPrompt({
      mode: 'update',
      form: editForm,
      files: editNewFiles,
    });

    localDispatch({ type: 'SET_SUBMITTING', value: false });

    if (promptId) {
      resetEditFiles();
      localDispatch({ type: 'SET_MODAL', modal: 'showEditModal', value: false });
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'success',
          message: t('Changes saved successfully.', 'Änderungen wurden gespeichert.'),
        },
      });
      localDispatch({ type: 'SET_FORM_ERRORS', scope: 'edit', errors: {} });
    } else {
      localDispatch({
        type: 'SET_STATUS',
        status: {
          type: 'error',
          message: t('Saving changes failed.', 'Speichern der Änderungen fehlgeschlagen.'),
        },
      });
    }
  }, [
    editForm,
    editNewFiles,
    resetEditFiles,
    submitPrompt,
    t,
    validateForm,
  ]);

  const handleDeletePrompt = useCallback(
    async (id) => {
      try {
        await reduxDispatch(deletePrompt(id));
        reduxDispatch(getPrompts());
      } catch (e) {
        // ignore delete errors
      }
    },
    [reduxDispatch],
  );

  const handleDeleteAttachedFile = useCallback(
    async (fileId) => {
      localDispatch({
        type: 'SET_EDIT_ATTACHED_FILES',
        files: editAttachedFiles.filter((file) => file.id !== fileId),
      });

      try {
        await reduxDispatch(deletePromptFile(editForm.id, fileId));
        await loadPromptFiles(editForm.id);
        reduxDispatch(getPrompts());
      } catch (e) {
        // ignore delete errors
      }
    },
    [editAttachedFiles, editForm.id, loadPromptFiles, reduxDispatch],
  );

  const handlePreviewAttachedFile = useCallback(
    (fileId) => loadPreviewFile(editForm.id, fileId),
    [editForm.id, loadPreviewFile],
  );

  const handleDownloadAttachedFile = useCallback(
    (fileId, filename) => handleDownload(editForm.id, fileId, filename),
    [editForm.id, handleDownload],
  );

  return (
    <Container className="prompt-manager">
      <Header as="h1">
        {t('AI Prompt Manager', 'AI Prompt Manager')}
      </Header>

      <p className="prompt-manager__intro">
        {t(
          'Manage AI prompts for the Slate editor. Create, edit and delete instructions.',
          'Verwalten Sie KI-Prompts für den Slate Editor. Erstellen, bearbeiten und löschen Sie Anweisungen.',
        )}
      </p>

      {status && (
        <Message
          positive={status.type === 'success'}
          negative={status.type === 'error'}
          onDismiss={() => localDispatch({ type: 'CLEAR_STATUS' })}
        >
          <Message.Header>
            {status.type === 'success'
              ? t('Success', 'Erfolg')
              : t('Error', 'Fehler')}
          </Message.Header>
          <p>{status.message}</p>
        </Message>
      )}

      {uploading && (
        <Progress
          percent={uploadProgress}
          active
          indicating
          size="small"
          className="prompt-manager__progress"
        >
          {t('Uploading files …', 'Dateien werden hochgeladen …')}
        </Progress>
      )}

      <Button
        primary={!showCreateModal}
        basic={showCreateModal}
        icon
        labelPosition="left"
        className="prompt-manager__toggle-button"
        onClick={showCreateModal ? handleCloseCreateModal : handleOpenCreateModal}
      >
        <Icon name={showCreateModal ? 'chevron up' : 'plus'} />
        {showCreateModal
          ? t('Hide', 'Ausblenden')
          : t('Create prompt', 'Prompt erstellen')}
      </Button>

      <CreatePromptModal
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        onSubmit={handleCreatePrompt}
        form={createForm}
        onFieldChange={handleCreateFieldChange}
        files={uploadedFiles}
        onFilesSelected={handleAddCreateFiles}
        fieldErrors={formErrors.create}
        submitting={submitting}
        t={t}
      />

      <EditPromptModal
        open={showEditModal}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdatePrompt}
        form={editForm}
        onFieldChange={handleEditFieldChange}
        newFiles={editNewFiles}
        onFilesSelected={handleAddEditFiles}
        attachedFiles={editAttachedFiles}
        onPreviewFile={handlePreviewAttachedFile}
        onDownloadFile={handleDownloadAttachedFile}
        onDeleteFile={handleDeleteAttachedFile}
        selectedPreviewFile={selectedPreviewFile}
        fieldErrors={formErrors.edit}
        submitting={submitting}
        t={t}
      />

      <Header as="h2" className="prompt-manager__existing-header">
        {t('Existing prompts', 'Vorhandene Prompts')}
      </Header>

      <PromptList
        prompts={prompts}
        loading={loading}
        error={error}
        onEdit={handleOpenEditModal}
        onDelete={handleDeletePrompt}
        t={t}
      />
    </Container>
  );
};

export default PromptManager;
