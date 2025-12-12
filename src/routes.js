import PromptManager from './controlpanel/promptmanager';

export default function applyRoutes(config) {
  config.addonRoutes = [
    ...(config.addonRoutes || []),
    {
      path: '/controlpanel/ai-prompt-manager',
      component: PromptManager,
    },
  ];

  return config;
}
