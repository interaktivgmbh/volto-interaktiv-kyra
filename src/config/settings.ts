import type { ConfigType } from "@plone/registry";

export default function install(config: ConfigType) {
  // Language settings
  config.settings.isMultilingual = false;
  config.settings.supportedLanguages = ["en"];
  config.settings.defaultLanguage = "en"; // Rules out german as a react-intl language

  return config;
}
