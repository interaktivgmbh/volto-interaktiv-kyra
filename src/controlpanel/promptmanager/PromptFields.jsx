import React from 'react';
import { Form } from 'semantic-ui-react';

const PromptFields = ({
  form,
  onChange,
  t,
  idPrefix,
  categoriesLabel,
  errors = {},
}) => (
  <>
    <Form.Field error={!!errors.name} required>
      <label htmlFor={`${idPrefix}-name`}>{t('Name', 'Name')}</label>
      <Form.Input
        id={`${idPrefix}-name`}
        value={form.name}
        onChange={(_, { value }) => onChange('name', value)}
      />
      {errors.name && (
        <div className="prompt-manager__field-error">{errors.name}</div>
      )}
    </Form.Field>

    <Form.Field>
      <label htmlFor={`${idPrefix}-description`}>
        {t('Description', 'Beschreibung')}
      </label>
      <Form.TextArea
        id={`${idPrefix}-description`}
        value={form.description}
        onChange={(_, { value }) => onChange('description', value)}
      />
    </Form.Field>

    <Form.Field error={!!errors.text} required>
      <label htmlFor={`${idPrefix}-text`}>
        {t('Prompt text', 'Prompt-Text')}
      </label>
      <Form.TextArea
        id={`${idPrefix}-text`}
        value={form.text}
        onChange={(_, { value }) => onChange('text', value)}
      />
      {errors.text && (
        <div className="prompt-manager__field-error">{errors.text}</div>
      )}
    </Form.Field>

    <Form.Field>
      <label htmlFor={`${idPrefix}-categories`}>
        {categoriesLabel ||
          t(
            'Categories (comma-separated)',
            'Kategorien (durch Komma getrennt)',
          )}
      </label>
      <Form.Input
        id={`${idPrefix}-categories`}
        value={form.categories}
        onChange={(_, { value }) => onChange('categories', value)}
      />
    </Form.Field>

    <Form.Field>
      <label htmlFor={`${idPrefix}-action`}>
        {t('Action', 'Aktion')}
      </label>
      <Form.Select
        id={`${idPrefix}-action`}
        options={[
          { key: 'replace', value: 'replace', text: t('Replace', 'Ersetzen') },
          { key: 'append', value: 'append', text: t('Append', 'Anhängen') },
        ]}
        value={form.actionType}
        onChange={(_, { value }) => onChange('actionType', value)}
      />
    </Form.Field>
  </>
);

export default PromptFields;
