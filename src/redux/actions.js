import {
  GET_PROMPTS,
  CREATE_PROMPT,
  UPDATE_PROMPT,
  DELETE_PROMPT,

  UPLOAD_PROMPT_FILES,
  DELETE_PROMPT_FILE,

  GET_KYRA_SETTINGS,
  UPDATE_KYRA_SETTINGS,
} from './constants';

// ----------------------------------------------------------
// PROMPTS
// ----------------------------------------------------------

export function getPrompts() {
  return {
    type: GET_PROMPTS,
    request: {
      op: 'get',
      path: '/@ai-prompts',
    },
  };
}

export function createPrompt(data) {
  return {
    type: CREATE_PROMPT,
    request: {
      op: 'post',
      path: '/@ai-prompts',
      data,
    },
  };
}

export function updatePrompt(id, data) {
  return {
    type: UPDATE_PROMPT,
    request: {
      op: 'patch',
      path: `/@ai-prompts/${id}`,
      data,
    },
  };
}

export function deletePrompt(id) {
  return {
    type: DELETE_PROMPT,
    request: {
      op: 'del',
      path: `/@ai-prompts/${id}`,
    },
  };
}

// ----------------------------------------------------------
// PROMPT FILES
// ----------------------------------------------------------

export function uploadPromptFiles(promptId, files) {
  const formData = new FormData();
  (files || []).forEach((file) => {
    formData.append('file', file);
  });

  return {
    type: UPLOAD_PROMPT_FILES,
    request: {
      op: 'post',
      path: `/@ai-prompt-files/${promptId}`,
      data: formData,
    },
  };
}

export function deletePromptFile(promptId, fileId) {
  return {
    type: DELETE_PROMPT_FILE,
    request: {
      op: 'del',
      path: `/@ai-prompt-files/${promptId}/${fileId}`,
    },
  };
}

// ----------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------

const KYRA_SETTINGS_ENDPOINT = '/@ai-assistant-settings';

export function getKyraSettings() {
  return {
    type: GET_KYRA_SETTINGS,
    request: {
      op: 'get',
      path: KYRA_SETTINGS_ENDPOINT,
    },
  };
}

export function updateKyraSettings(data) {
  return {
    type: UPDATE_KYRA_SETTINGS,
    request: {
      op: 'patch',
      path: KYRA_SETTINGS_ENDPOINT,
      data,
    },
  };
}
