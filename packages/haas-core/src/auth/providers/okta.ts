import { OIDCIdentityProvider } from './oidc.js';

/**
 * Okta Identity Provider
 *
 * Specialized OIDC provider pre-configured for Okta.
 * Extends the generic OIDC provider with Okta-specific defaults.
 */
export class OktaIdentityProvider extends OIDCIdentityProvider {
  constructor(config: {
    domain: string; // e.g., "dev-12345.okta.com"
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    super({
      name: 'okta',
      issuer: `https://${config.domain}`,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  }
}
