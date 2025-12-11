import React from 'react';
import { Form } from 'semantic-ui-react';

const PromptFields = ({
  form,
  onChange,
  t,
  idPrefix,
  categoriesLabel,
}) => (
  <>
    <Form.Field>
      <label htmlFor={`${idPrefix}-name`}>{t('Name', 'Name')}</label>
      <Form.Input
        id={`${idPrefix}-name`}
        value={form.name}
        onChange={(_, { value }) => onChange('name', value)}
      />
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

    <Form.Field>
      <label htmlFor={`${idPrefix}-text`}>
        {t('Prompt text', 'Prompt-Text')}
      </label>
      <Form.TextArea
        id={`${idPrefix}-text`}
        value={form.text}
        onChange={(_, { value }) => onChange('text', value)}
      />
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
  </>
);

export default PromptFields;
