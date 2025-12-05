import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';

import applyRoutes from './routes';
import reducer from './redux/reducer';
import {chatSVG, robotSVG} from './helpers/icons';
import {getPrompts} from './redux/actions';


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
    'kyra-prompts': chatSVG,
    'ai-assist-settings': robotSVG,
  };

  config.settings.controlpanels = [
    ...config.settings.controlpanels,
    {
      '@id': '/kyra-prompts',
      id: 'kyra-prompts',
      title: 'AI Prompt Manager',
      group: 'Add-on Configuration',
      path: '/controlpanel/kyra-prompts',
    },
  ];

  config.addonReducers = {
    ...config.addonReducers,
    kyra: reducer,
  };

  config.settings.appExtras = [
    ...(config.settings.appExtras || []),
    KyraPromptLoader,
  ];

  config = applyRoutes(config);

  console.log(config);

  return config;
}
