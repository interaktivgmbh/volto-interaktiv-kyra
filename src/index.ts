import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import './theme/main.scss';

import applyRoutes from './routes';
import reducer from './redux/reducer';
import {chatSVG, robotSVG} from './helpers/icons';
import {getPrompts} from './redux/actions';
import ChatWidgetProvider from './components/AIChat/ChatWidgetProvider';

const KyraPromptLoader: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getPrompts());
  }, [dispatch]);

  return null;
};

export default function applyConfig(config) {
  config.settings.controlPanelsIcons = {
    ...config.settings.controlPanelsIcons,
    'ai-prompt-manager': chatSVG,
    'ai-assist-settings': robotSVG,
  };

  config.addonReducers = {
    ...config.addonReducers,
    kyra: reducer,
  };

  config.settings.appExtras = [
    ...(config.settings.appExtras || []),
    {
      match: '',
      component: () => (
        <>
          <KyraPromptLoader / >
        <ChatWidgetProvider / >
        </>
      ),
    },
  ];

  config = applyRoutes(config);

  return config;
}
