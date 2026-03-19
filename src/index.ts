import React from 'react'; // Unused import -> CTRL ALT I, CTRL ALT O while selecting volto-interaktiv-kyra folder to format all files and fix their imports.
import './theme/main.scss';
import { robotSVG, aichatSVG } from './helpers/icons';

import ChatWidgetProvider from './components/AIChat/ChatWidgetProvider'; // Not detected as used due to invalid jsx syntax
import PromptManager from './controlpanel/promptmanager';


export default function applyConfig(config) { // ConfigType from '@plone/registry' as Type. Also add a 'props' field to the block below as commented.
  config.settings.appExtras = [
    ...(config.settings.appExtras || []),
    {
      match: '',
      component: () => <ChatWidgetProvider />,
      // < ... /> JSX syntax is not really supported in .ts files.
      // There are two options to fix this: 1. Change file to .tsx + adjust package.json 2. React.createElement(ChatWidgetProvider) for native support in .ts files.
      // props: {} - Empty field to make type happy
    },
  ];

  config.settings.controlPanelsIcons = {
    ...config.settings.controlPanelsIcons,
    'ai-assist-settings': robotSVG,
    'ai-prompt-manager': aichatSVG,
  };

  config.addonRoutes = [
    ...(config.addonRoutes || []),
    {
      path: '/controlpanel/ai-prompt-manager',
      component: PromptManager,
    },
  ];

  return config;
}
