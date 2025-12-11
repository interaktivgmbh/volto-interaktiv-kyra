import React, { useCallback } from 'react';
import { Button, Loader, Message, Table } from 'semantic-ui-react';

const PromptRow = ({ prompt, onEdit, onDelete, t }) => {
  const handleEdit = useCallback(() => onEdit(prompt), [onEdit, prompt]);
  const handleDelete = useCallback(
    () => onDelete(prompt.id),
    [onDelete, prompt.id],
  );

  return (
    <Table.Row>
      <Table.Cell>{prompt.name}</Table.Cell>
      <Table.Cell>{prompt.description}</Table.Cell>
      <Table.Cell>
        {Array.isArray(prompt.categories)
          ? prompt.categories.join(', ')
          : ''}
      </Table.Cell>
      <Table.Cell>
        {prompt.actionType === 'append'
          ? t('Append', 'Anhängen')
          : t('Replace', 'Ersetzen')}
      </Table.Cell>
      <Table.Cell textAlign="right">
        <Button size="small" onClick={handleEdit}>
          {t('Edit', 'Bearbeiten')}
        </Button>
        <Button size="small" color="red" onClick={handleDelete}>
          {t('Delete', 'Löschen')}
        </Button>
      </Table.Cell>
    </Table.Row>
  );
};

const PromptList = ({ prompts, loading, error, onEdit, onDelete, t }) => {
  if (loading) {
    return (
      <Loader active inline="centered">
        {t('Loading prompts …', 'Prompts werden geladen …')}
      </Loader>
    );
  }

  if (error) {
    return (
      <Message negative>
        <Message.Header>
          {t('Error while loading', 'Fehler beim Laden')}
        </Message.Header>
        <p>{error.message}</p>
      </Message>
    );
  }

  return (
    <Table celled striped>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>{t('Name', 'Name')}</Table.HeaderCell>
          <Table.HeaderCell>
            {t('Description', 'Beschreibung')}
          </Table.HeaderCell>
          <Table.HeaderCell>
            {t('Categories', 'Kategorien')}
          </Table.HeaderCell>
          <Table.HeaderCell>{t('Action', 'Aktion')}</Table.HeaderCell>
          <Table.HeaderCell textAlign="right">
            {t('Actions', 'Aktionen')}
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {prompts.map((prompt) => (
          <PromptRow
            key={prompt.id}
            prompt={prompt}
            onEdit={onEdit}
            onDelete={onDelete}
            t={t}
          />
        ))}
      </Table.Body>
    </Table>
  );
};

export default PromptList;
