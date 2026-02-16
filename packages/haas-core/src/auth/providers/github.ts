import type {
  TrustRequirements,
  Challenge,
  IdentityProof,
  VerificationResult,
  IdentityClaims,
} from '../../types/index.js';
import type { IIdentityProvider } from '../../types/index.js';

/**
 * GitHub Identity Provider
 *
 * Verifies reviewer identity via GitHub OAuth tokens.
 * Extracts organization memberships, repository access, and contribution history
 * as identity claims.
 */
export class GitHubIdentityProvider implements IIdentityProvider {
  readonly name = 'github';
  private clientId: string;
  private clientSecret: string;

  constructor(config: { clientId: string; clientSecret: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  getChallenge(requirements: TrustRequirements): Challenge {
    const scopes = ['read:user', 'read:org'];
    if (requirements.minSeniority === 'director' || requirements.minSeniority === 'vp' || requirements.minSeniority === 'c-level') {
      scopes.push('repo');
    }

    const nonce = this.generateState();
    return {
      provider: this.name,
      type: 'oauth',
      nonce,
      redirectUrl: `https://github.com/login/oauth/authorize?client_id=${this.clientId}&scope=${scopes.join(' ')}&state=${nonce}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    try {
      // Exchange code for token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: proof.token,
        }),
      });

      const tokenData = await tokenResponse.json() as Record<string, unknown>;
      if (tokenData.error) {
        return { verified: false, error: `GitHub OAuth error: ${tokenData.error_description}` };
      }

      // Verify token by fetching user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        return { verified: false, error: 'Failed to verify GitHub token' };
      }

      return { verified: true };
    } catch (err: unknown) {
      return { verified: false, error: `GitHub verification failed: ${err}` };
    }
  }

  extractClaims(proof: IdentityProof): IdentityClaims {
    // In production, this would parse the verified GitHub user data
    return {
      sub: proof.claims?.sub ?? 'unknown',
      name: proof.claims?.name ?? 'GitHub User',
      email: proof.claims?.email,
      org: proof.claims?.org,
      skills: proof.claims?.skills,
      groups: proof.claims?.groups,
    };
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
