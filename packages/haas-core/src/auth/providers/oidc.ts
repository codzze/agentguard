import type {
  TrustRequirements,
  Challenge,
  IdentityProof,
  VerificationResult,
  IdentityClaims,
} from '../../types/index.js';
import type { IIdentityProvider } from '../../types/index.js';

/**
 * Generic OIDC Identity Provider
 *
 * Supports any OpenID Connect compliant identity provider (Okta, Auth0,
 * Azure AD/Entra ID, Google, etc.) via standard discovery and token
 * verification endpoints.
 */
export class OIDCIdentityProvider implements IIdentityProvider {
  readonly name: string;
  private issuer: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private discoveryDoc: OIDCDiscovery | null = null;

  constructor(config: {
    name?: string;
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    this.name = config.name ?? 'oidc';
    this.issuer = config.issuer.replace(/\/$/, ''); // strip trailing slash
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getChallenge(requirements: TrustRequirements): Challenge {
    const scopes = ['openid', 'profile', 'email'];
    const nonce = this.generateState();

    return {
      provider: this.name,
      type: 'oauth',
      nonce,
      redirectUrl: `${this.issuer}/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${scopes.join('%20')}&state=${nonce}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    try {
      const discovery = await this.getDiscovery();

      // Exchange code for tokens
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: proof.token,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const tokenResponse = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        return { verified: false, error: 'Failed to exchange OIDC authorization code' };
      }

      const tokenData = await tokenResponse.json() as Record<string, unknown>;

      // Verify by fetching userinfo
      const userinfoResponse = await fetch(discovery.userinfo_endpoint, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!userinfoResponse.ok) {
        return { verified: false, error: 'Failed to verify OIDC token via userinfo' };
      }

      return { verified: true };
    } catch (err: unknown) {
      return { verified: false, error: `OIDC verification failed: ${err}` };
    }
  }

  extractClaims(proof: IdentityProof): IdentityClaims {
    return {
      sub: proof.claims?.sub ?? 'unknown',
      name: proof.claims?.name ?? 'OIDC User',
      email: proof.claims?.email,
      title: proof.claims?.title,
      org: proof.claims?.org,
      seniority: proof.claims?.seniority,
      skills: proof.claims?.skills,
      groups: proof.claims?.groups,
    };
  }

  // ---- OIDC Discovery ----

  private async getDiscovery(): Promise<OIDCDiscovery> {
    if (this.discoveryDoc) return this.discoveryDoc;

    const wellKnownUrl = `${this.issuer}/.well-known/openid-configuration`;
    const response = await fetch(wellKnownUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC discovery document from ${wellKnownUrl}`);
    }

    this.discoveryDoc = await response.json() as OIDCDiscovery;
    return this.discoveryDoc;
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}
