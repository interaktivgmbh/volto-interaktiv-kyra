import PromptManager from './controlpanel/promptmanager';

export default function applyRoutes(config) {
  config.addonRoutes = [
    ...(config.addonRoutes || []),
    {
      path: '/controlpanel/kyra-prompts',
      component: PromptManager,
    },
  ];

  return config;
}
