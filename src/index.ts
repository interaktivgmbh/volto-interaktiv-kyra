import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import './theme/main.scss';

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
    'ai-prompt-manager': chatSVG,
    'ai-assist-settings': robotSVG,
  };

  console.log(config.settings.controlpanels);

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
