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

const initialState = {
  // Prompts
  items: [],
  loading: false,
  loaded: false,
  error: null,

  // Settings
  settings: null,
  settingsLoading: false,
  settingsSaving: false,
  settingsError: null,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {

    // ------------------------------------------------------
    // PROMPTS
    // ------------------------------------------------------
    case `${GET_PROMPTS}_PENDING`:
      return {...state, loading: true, error: null};

    case `${GET_PROMPTS}_SUCCESS`:
      return {
        ...state,
        loading: false,
        loaded: true,
        items: action.result || [],
      };

    case `${GET_PROMPTS}_FAIL`:
      return {...state, loading: false, error: action.error};

    // CREATE
    case `${CREATE_PROMPT}_SUCCESS`:
      return {
        ...state,
        items: [...state.items, action.result],
      };

    // UPDATE
    case `${UPDATE_PROMPT}_SUCCESS`:
      return {
        ...state,
        items: state.items.map((p) =>
          p.id === action.result.id ? action.result : p
        ),
      };

    // DELETE
    case `${DELETE_PROMPT}_SUCCESS`:
      return {
        ...state,
        items: state.items.filter((p) => p.id !== action.result.id),
      };

    // ------------------------------------------------------
    // FILE UPLOAD / DELETE
    // ------------------------------------------------------

    case `${UPLOAD_PROMPT_FILES}_SUCCESS`:
      return {
        ...state,
        items: state.items.map((p) =>
          p.id === action.result?.promptId
            ? {
              ...p,
              files: [...(p.files || []), ...(action.result.uploaded || [])],
            }
            : p
        ),
      };

    case `${DELETE_PROMPT_FILE}_SUCCESS`:
      return {
        ...state,
        items: state.items.map((p) =>
          p.id === action.result?.promptId
            ? {
              ...p,
              files: (p.files || []).filter(
                (f) => f.id !== action.result.deleted
              ),
            }
            : p
        ),
      };

    // ------------------------------------------------------
    // SETTINGS
    // ------------------------------------------------------
    case `${GET_KYRA_SETTINGS}_PENDING`:
      return {...state, settingsLoading: true};

    case `${GET_KYRA_SETTINGS}_SUCCESS`:
      return {...state, settingsLoading: false, settings: action.result};

    case `${GET_KYRA_SETTINGS}_FAIL`:
      return {...state, settingsLoading: false, settingsError: action.error};

    case `${UPDATE_KYRA_SETTINGS}_PENDING`:
      return {...state, settingsSaving: true};

    case `${UPDATE_KYRA_SETTINGS}_SUCCESS`:
      return {...state, settingsSaving: false, settings: action.result};

    case `${UPDATE_KYRA_SETTINGS}_FAIL`:
      return {...state, settingsSaving: false, settingsError: action.error};

    default:
      return state;
  }
}
