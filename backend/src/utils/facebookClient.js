import FacebookAdsIntegration from '../integrations/facebookAds.js';

/**
 * Meta access-token strategy shared by every live call to the Graph API.
 *
 * Each client may have a personal token (from their own OAuth). Meta invalidates
 * those often (password change, security review → error code 190 / OAuthException).
 * When that happens we retry with the agency's System User token, which can read
 * any ad account shared to the business. Accounts NOT shared to the business keep
 * failing, which is the correct signal that the client must reconnect.
 */

export const systemFacebookToken = () => process.env.FACEBOOK_SYSTEM_USER_TOKEN || null;

export const isFacebookAuthError = (err) => {
  const e = err?.response?.data?.error;
  return !!e && (e.code === 190 || e.type === 'OAuthException');
};

const looksLikeAuthMessage = (msg = '') =>
  /access token|oauth|session has been invalidated|permission/i.test(String(msg));

/**
 * Run `fn(fbClient)` with the client's token; on a Meta auth error retry once
 * with the System User token. Throws the last error if both fail.
 * Returns { result, usedSystemToken }.
 */
export async function withFacebookFallback(cred, fn, label = 'FB') {
  const systemToken = systemFacebookToken();
  const personalToken = cred?.access_token || null;
  const firstToken = personalToken || systemToken;
  if (!firstToken) throw new Error('Sin token de acceso Facebook');

  try {
    const result = await fn(new FacebookAdsIntegration(firstToken, cred.ad_account_id));
    return { result, usedSystemToken: firstToken === systemToken };
  } catch (error) {
    const canRetry = isFacebookAuthError(error) && systemToken && firstToken !== systemToken;
    if (!canRetry) throw error;
    console.log(`  ↪ ${label}: token personal inválido para cuenta ${cred.ad_account_id}, usé el token de sistema`);
    const result = await fn(new FacebookAdsIntegration(systemToken, cred.ad_account_id));
    return { result, usedSystemToken: true };
  }
}

/**
 * testConnection() does not throw: it returns { success, error }. Same fallback,
 * for the credentials test and the health check.
 * Returns { ...testResult, usedSystemToken }.
 */
export async function testFacebookConnectionWithFallback(cred) {
  const systemToken = systemFacebookToken();
  const personalToken = cred?.access_token || null;
  const firstToken = personalToken || systemToken;
  if (!firstToken) return { success: false, error: 'Sin token de acceso Facebook', usedSystemToken: false };

  const first = await new FacebookAdsIntegration(firstToken, cred.ad_account_id).testConnection();
  if (first.success || !systemToken || firstToken === systemToken || !looksLikeAuthMessage(first.error)) {
    return { ...first, usedSystemToken: firstToken === systemToken };
  }
  const second = await new FacebookAdsIntegration(systemToken, cred.ad_account_id).testConnection();
  if (second.success) {
    console.log(`  ↪ FB test: token personal inválido para cuenta ${cred.ad_account_id}, el token de sistema sí funciona`);
    return { ...second, usedSystemToken: true, personalTokenError: first.error };
  }
  return { ...second, usedSystemToken: true };
}
