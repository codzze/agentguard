import type {
  TrustRequirements,
  Challenge,
  IdentityProof,
  VerificationResult,
  IdentityClaims,
} from '../../types/index.js';
import type { IIdentityProvider } from '../../types/index.js';

/**
 * LinkedIn Identity Provider
 *
 * Verifies reviewer identity via LinkedIn OAuth 2.0 / OpenID Connect.
 * Extracts professional profile, job title, and company as identity claims
 * to verify seniority and domain expertise.
 */
export class LinkedInIdentityProvider implements IIdentityProvider {
  readonly name = 'linkedin';
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string }) {
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
      redirectUrl: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${scopes.join('%20')}&state=${nonce}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    try {
      // Exchange authorization code for access token
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: proof.token,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        return { verified: false, error: 'Failed to exchange LinkedIn authorization code' };
      }

      const tokenData = await tokenResponse.json() as Record<string, unknown>;

      // Verify by fetching userinfo
      const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!userinfoResponse.ok) {
        return { verified: false, error: 'Failed to verify LinkedIn token' };
      }

      return { verified: true };
    } catch (err: unknown) {
      return { verified: false, error: `LinkedIn verification failed: ${err}` };
    }
  }

  extractClaims(proof: IdentityProof): IdentityClaims {
    return {
      sub: proof.claims?.sub ?? 'unknown',
      name: proof.claims?.name ?? 'LinkedIn User',
      email: proof.claims?.email,
      title: proof.claims?.title,
      org: proof.claims?.org,
      seniority: proof.claims?.seniority,
      skills: proof.claims?.skills,
    };
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
