// ============================================================================
// AgentGuard Core — Identity Provider Factory
// Pluggable adapter mesh for verifying human reviewer identities
// ============================================================================

import type {
  IIdentityProvider,
  Challenge,
  VerificationResult,
  IdentityProof,
  IdentityClaims,
  TrustRequirements,
} from '../types/index.js';

/**
 * Factory for managing pluggable identity providers.
 * Register adapters for LinkedIn, GitHub, OIDC, Okta, Web3, etc.
 */
export class IdentityProviderFactory {
  private providers: Map<string, IIdentityProvider> = new Map();

  /**
   * Register a new identity provider adapter.
   */
  register(provider: IIdentityProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a specific provider by name.
   */
  getProvider(name: string): IIdentityProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered provider names.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Generate a challenge for the reviewer using the specified (or best-matching) provider.
   */
  createChallenge(
    requirements: TrustRequirements,
    preferredProvider?: string
  ): { provider: string; challenge: Challenge } | null {
    const accepted = requirements.acceptedProviders ?? this.getAvailableProviders();

    const providerName = preferredProvider && accepted.includes(preferredProvider)
      ? preferredProvider
      : accepted[0];

    if (!providerName) return null;

    const provider = this.providers.get(providerName);
    if (!provider) return null;

    return {
      provider: providerName,
      challenge: provider.getChallenge(requirements),
    };
  }

  /**
   * Verify an identity proof using the appropriate provider.
   */
  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    const provider = this.providers.get(proof.provider);
    if (!provider) {
      return {
        verified: false,
        error: `Unknown identity provider: ${proof.provider}`,
      };
    }
    return provider.verifyProof(proof);
  }

  /**
   * Extract standardized claims from a proof.
   */
  extractClaims(proof: IdentityProof): IdentityClaims | null {
    const provider = this.providers.get(proof.provider);
    if (!provider) return null;
    return provider.extractClaims(proof);
  }

  /**
   * Validate that a reviewer's claims meet the trust requirements.
   */
  meetsTrustRequirements(
    claims: IdentityClaims,
    requirements: TrustRequirements
  ): boolean {
    // Check seniority
    if (requirements.minSeniority) {
      const seniorityOrder = ['associate', 'senior', 'lead', 'director', 'vp', 'c-level'];
      const requiredIdx = seniorityOrder.indexOf(requirements.minSeniority);
      const actualIdx = claims.seniority
        ? seniorityOrder.indexOf(claims.seniority)
        : -1;
      if (actualIdx < requiredIdx) return false;
    }

    // Check skills
    if (requirements.requiredSkills && requirements.requiredSkills.length > 0) {
      const userSkills = new Set(claims.skills?.map((s: string) => s.toLowerCase()) ?? []);
      const hasAllSkills = requirements.requiredSkills.every((skill: string) =>
        userSkills.has(skill.toLowerCase())
      );
      if (!hasAllSkills) return false;
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Mock Identity Provider (for development/testing)
// ---------------------------------------------------------------------------

export class MockIdentityProvider implements IIdentityProvider {
  readonly name = 'mock';

  getChallenge(requirements: TrustRequirements): Challenge {
    return {
      type: 'mock-challenge',
      provider: this.name,
      nonce: Math.random().toString(36).substring(2),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    // In mock mode, always verify successfully
    return {
      verified: true,
      claims: proof.claims ?? { name: 'Mock User', seniority: 'senior' },
      hash: `mock-hash-${Date.now()}`,
    };
  }

  extractClaims(proof: IdentityProof): IdentityClaims {
    return proof.claims ?? {
      name: 'Mock User',
      title: 'Mock Title',
      org: 'Mock Org',
      seniority: 'senior',
      skills: ['general'],
    };
  }
}
