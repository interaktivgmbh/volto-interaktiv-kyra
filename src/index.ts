import React from 'react';
import './theme/main.scss';
import { robotSVG, aichatSVG } from './helpers/icons';

import ChatWidgetProvider from './components/AIChat/ChatWidgetProvider';
import PromptManager from './controlpanel/promptmanager';
import { kyraHighlightDecorate } from './components/AIAssistant/AIAssistantSlateButton';

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
    'ai-prompt-manager': aichatSVG,
  };

  config.addonRoutes = [
    ...(config.addonRoutes || []),
    {
      path: '/controlpanel/ai-prompt-manager',
      component: PromptManager,
    },
  ];

  if (config.settings?.slate?.runtimeDecorators) {
    config.settings.slate.runtimeDecorators.push(kyraHighlightDecorate);
  }

  config.settings.slate = config.settings.slate || {};
  config.settings.slate.leafs = config.settings.slate.leafs || {};
  config.settings.slate.leafs.kyraHighlight = ({ children }: { children: any }) => (
    <span className="kyra-slate-highlight">
      {children}
    </span>
  );

  return config;
}
