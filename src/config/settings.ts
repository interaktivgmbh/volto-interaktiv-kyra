import type { ConfigType } from "@plone/registry";

export default function install(config: ConfigType) {
  config.settings.isMultilingual = false;
  config.settings.supportedLanguages = ["en"];
  config.settings.defaultLanguage = "en";

  return config;
}
