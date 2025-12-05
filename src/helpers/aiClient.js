let cachedToken = null;
let cachedTokenExpiresAt = 0;

export async function getKeycloakToken(settings) {
  if (
    cachedToken &&
    cachedTokenExpiresAt &&
    Date.now() < cachedTokenExpiresAt
  ) {
    return cachedToken;
  }

  const realmUrl = (settings?.keycloak_realms_url || '').replace(/\/$/, '');
  if (!realmUrl) {
    throw new Error('Keycloak Realms URL ist nicht konfiguriert.');
  }

  const clientId = settings?.keycloak_client_id;
  const clientSecret = settings?.keycloak_client_secret;

  if (!clientId || !clientSecret) {
    throw new Error('Keycloak Client ID oder Secret ist nicht konfiguriert.');
  }

  const tokenUrl = `${realmUrl}/protocol/openid-connect/token`;

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Keycloak Token Error: ${res.status}`);
  }

  const data = await res.json();
  const accessToken = data.access_token;

  if (!accessToken) {
    throw new Error('Keycloak Token Response enthält kein access_token.');
  }

  const expiresInSec =
    settings?.keycloak_token_expiration_time || data.expires_in || 60;

  cachedToken = accessToken;
  cachedTokenExpiresAt = Date.now() + expiresInSec * 1000 - 5000; // 5s Puffer

  return accessToken;
}

export async function runPromptWithGateway({settings, prompt, selectionText}) {
  const baseUrl = (settings?.gateway_url || '').replace(/\/$/, '');
  const domainId = settings?.domain_id || 'plone';

  if (!baseUrl) {
    throw new Error('Gateway URL ist nicht konfiguriert.');
  }

  const token = await getKeycloakToken(settings);

  const applyUrl = `${baseUrl}/${prompt.id}/apply`;

  const payload = {
    query: selectionText || '',
    input: selectionText || '',
  };

  const res = await fetch(applyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-domain-id': domainId,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AI Gateway Error: ${res.status}`);
  }

  const data = await res.json();

  const resultText =
    data.result || data.text || data.output || data.completion || '';

  if (!resultText) {
    throw new Error('AI Gateway Response enthält keinen Text.');
  }

  return resultText;
}
