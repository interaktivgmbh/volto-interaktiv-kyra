import type { ConfigType } from '@plone/registry';
import installSettings from './config/settings';

function applyConfig(config: ConfigType) {
  installSettings(config);

  config.settings.isMultilingual = true;
  config.settings.supportedLanguages = ['en', 'de'];
  config.settings.defaultLanguage = 'de';
  
  return config;
}

export default applyConfig;
