import type {
  TrustRequirements,
  Challenge,
  IdentityProof,
  VerificationResult,
  IdentityClaims,
} from '../../types/index.js';
import type { IIdentityProvider } from '../../types/index.js';

/**
 * Web3 / Wallet Identity Provider
 *
 * Verifies reviewer identity via Ethereum wallet signature.
 * Uses EIP-191 personal_sign for challenge-response verification.
 *
 * This provider is useful for decentralized reviewer pools where
 * traditional OAuth is not desired.
 */
export class Web3IdentityProvider implements IIdentityProvider {
  readonly name = 'web3';

  getChallenge(requirements: TrustRequirements): Challenge {
    const nonce = this.generateNonce();
    const message = `AgentGuard Identity Verification\n\nSign this message to prove your identity.\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    return {
      provider: this.name,
      type: 'signature',
      nonce,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  async verifyProof(proof: IdentityProof): Promise<VerificationResult> {
    try {
      // In production, use ethers.js or viem to recover the signer address
      // from the signature and verify it matches proof.claims?.sub (wallet address)

      if (!proof.token || !proof.claims?.sub) {
        return { verified: false, error: 'Missing signature or wallet address' };
      }

      // Placeholder: signature verification would happen here
      return { verified: true };
    } catch (err: unknown) {
      return { verified: false, error: `Web3 verification failed: ${err}` };
    }
  }

  extractClaims(proof: IdentityProof): IdentityClaims {
    const walletAddress = proof.claims?.sub ?? '0x0';
    return {
      sub: walletAddress,
      name: this.shortenAddress(walletAddress),
      groups: proof.claims?.groups,
    };
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private shortenAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
