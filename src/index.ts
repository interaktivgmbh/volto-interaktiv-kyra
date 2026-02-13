import React from 'react';
import './theme/main.scss';
import { robotSVG } from './helpers/icons';

import ChatWidgetProvider from './components/AIChat/ChatWidgetProvider';

export default function applyConfig(config) {
  config.settings.appExtras = [
    ...(config.settings.appExtras || []),
    {
      match: '',
      component: () => <ChatWidgetProvider />,
    },
  ];

  config.settings.controlPanelsIcons = {
    ...config.settings.controlPanelsIcons,
    'ai-assist-settings': robotSVG,
  };

  return config;
}
