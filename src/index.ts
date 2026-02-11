import React from 'react';
import './theme/main.scss';

import ChatWidgetProvider from './components/AIChat/ChatWidgetProvider';

export default function applyConfig(config) {
  config.settings.appExtras = [
    ...(config.settings.appExtras || []),
    {
      match: '',
      component: () => <ChatWidgetProvider />,
    },
  ];

  return config;
}
