import { describe, it, expect } from 'vitest';
import { IdentityProviderFactory, MockIdentityProvider } from '../src/auth/factory.js';

describe('IdentityProviderFactory', () => {
  it('should register and retrieve a provider', () => {
    const factory = new IdentityProviderFactory();
    const mock = new MockIdentityProvider();
    factory.register(mock);

    const provider = factory.getProvider('mock');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('mock');
  });

  it('should return undefined for unknown provider', () => {
    const factory = new IdentityProviderFactory();
    const provider = factory.getProvider('nonexistent');
    expect(provider).toBeUndefined();
  });

  it('should generate a challenge via MockProvider', () => {
    const mock = new MockIdentityProvider();
    const challenge = mock.getChallenge({
      seniority: 'MID',
      pools: ['general'],
    });
    expect(challenge.provider).toBe('mock');
    expect(challenge.type).toBe('none');
  });

  it('should verify proof via MockProvider', async () => {
    const mock = new MockIdentityProvider();
    const result = await mock.verifyProof({
      provider: 'mock',
      token: 'any-token',
      timestamp: new Date().toISOString(),
    });
    expect(result.valid).toBe(true);
  });

  it('should extract claims via MockProvider', () => {
    const mock = new MockIdentityProvider();
    const claims = mock.extractClaims({
      provider: 'mock',
      token: 'any-token',
      subject: 'test-user',
      timestamp: new Date().toISOString(),
    });
    expect(claims.provider).toBe('mock');
    expect(claims.subject).toBe('test-user');
  });
});
