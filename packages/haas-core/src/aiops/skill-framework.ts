// ============================================================================
// AgentGuard Core — Skill Framework
// Maps identity provider claims to HaaS pools for enterprise IAM integration.
// Supports Entra ID groups, GitHub orgs/teams, OIDC roles, and custom mappings.
// ============================================================================

import type { IdentityClaims, SeniorityLevel } from '../types/index.js';

export interface SkillMapping {
  /** Identity provider name (e.g., "entra", "github", "oidc", "okta") */
  provider: string;
  /** Claim field to match (e.g., group name, org name, team, role) */
  match: SkillMatchCriteria;
  /** HaaS pool this mapping resolves to */
  mapsToPool: string;
  /** Minimum seniority level required */
  minSeniority?: SeniorityLevel;
  /** Skills granted by this mapping */
  grantedSkills?: string[];
}

export interface SkillMatchCriteria {
  /** Match on group/team membership */
  group?: string;
  /** Match on organization */
  org?: string;
  /** Match on team within an org */
  team?: string;
  /** Match on role claim */
  role?: string;
  /** Match on any claim field (catch-all) */
  claimField?: string;
  /** Value to match against the claim field */
  claimValue?: string;
}

export interface SkillFrameworkConfig {
  /** Skill mappings from IdP claims to pools */
  mappings: SkillMapping[];
  /** Default pool for unmapped users */
  defaultPool?: string;
  /** Whether to allow approvals from unmapped users (default: false) */
  allowUnmapped?: boolean;
}

export interface PoolResolution {
  /** Resolved pools the user is eligible for */
  pools: string[];
  /** Skills derived from the user's identity */
  skills: string[];
  /** Whether the user meets the minimum seniority for each pool */
  seniorityMet: boolean;
  /** Which mappings matched */
  matchedMappings: SkillMapping[];
}

/**
 * Skill Framework — Enterprise IAM to HaaS Pool Mapping
 *
 * Maps identity provider claims (Entra groups, GitHub orgs/teams, OIDC roles)
 * to HaaS approval pools. Enables enterprises to use their existing IAM
 * infrastructure to control who can approve what.
 *
 * Example mappings:
 * - Entra group "Finance-Directors" → pool "finance", min seniority "director"
 * - GitHub org "my-company" team "platform" → pool "engineering", min seniority "senior"
 * - OIDC role "security-analyst" → pool "security"
 */
export class SkillFramework {
  private config: SkillFrameworkConfig;

  constructor(config: SkillFrameworkConfig) {
    this.config = config;
  }

  /**
   * Resolve which pools a user is eligible for based on their identity claims.
   */
  resolvePool(claims: IdentityClaims, provider: string): PoolResolution {
    const matchedMappings: SkillMapping[] = [];
    const pools = new Set<string>();
    const skills = new Set<string>();
    let seniorityMet = true;

    for (const mapping of this.config.mappings) {
      // Only check mappings for the matching provider
      if (mapping.provider !== provider && mapping.provider !== '*') continue;

      if (this.matchesCriteria(claims, mapping.match)) {
        // Check seniority requirement
        if (mapping.minSeniority && !this.meetsSeniority(claims.seniority, mapping.minSeniority)) {
          seniorityMet = false;
          continue;
        }

        matchedMappings.push(mapping);
        pools.add(mapping.mapsToPool);

        if (mapping.grantedSkills) {
          for (const skill of mapping.grantedSkills) {
            skills.add(skill);
          }
        }
      }
    }

    // Add default pool if no mappings matched and unmapped is allowed
    if (pools.size === 0 && this.config.allowUnmapped && this.config.defaultPool) {
      pools.add(this.config.defaultPool);
    }

    return {
      pools: Array.from(pools),
      skills: Array.from(skills),
      seniorityMet,
      matchedMappings,
    };
  }

  /**
   * Check if a user is eligible to approve a task in a specific pool.
   */
  isEligible(claims: IdentityClaims, provider: string, requiredPool: string): boolean {
    const resolution = this.resolvePool(claims, provider);
    return resolution.pools.includes(requiredPool) && resolution.seniorityMet;
  }

  /**
   * Get all configured mappings.
   */
  getMappings(): SkillMapping[] {
    return [...this.config.mappings];
  }

  /**
   * Add a mapping at runtime.
   */
  addMapping(mapping: SkillMapping): void {
    this.config.mappings.push(mapping);
  }

  /**
   * Remove a mapping by pool name and provider.
   */
  removeMapping(pool: string, provider: string): boolean {
    const idx = this.config.mappings.findIndex(
      (m) => m.mapsToPool === pool && m.provider === provider,
    );
    if (idx >= 0) {
      this.config.mappings.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Load mappings from a parsed config object.
   */
  static fromConfig(config: {
    skill_mappings: Array<{
      provider: string;
      group?: string;
      org?: string;
      team?: string;
      role?: string;
      maps_to_pool: string;
      min_seniority?: SeniorityLevel;
      granted_skills?: string[];
    }>;
    default_pool?: string;
    allow_unmapped?: boolean;
  }): SkillFramework {
    const mappings: SkillMapping[] = config.skill_mappings.map((m) => ({
      provider: m.provider,
      match: {
        group: m.group,
        org: m.org,
        team: m.team,
        role: m.role,
      },
      mapsToPool: m.maps_to_pool,
      minSeniority: m.min_seniority,
      grantedSkills: m.granted_skills,
    }));

    return new SkillFramework({
      mappings,
      defaultPool: config.default_pool,
      allowUnmapped: config.allow_unmapped ?? false,
    });
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private matchesCriteria(claims: IdentityClaims, criteria: SkillMatchCriteria): boolean {
    // Match on group/team membership
    if (criteria.group && claims.groups) {
      if (!claims.groups.some((g: string) => g.toLowerCase() === criteria.group!.toLowerCase())) {
        return false;
      }
    } else if (criteria.group) {
      return false;
    }

    // Match on organization
    if (criteria.org) {
      if (!claims.org || claims.org.toLowerCase() !== criteria.org.toLowerCase()) {
        return false;
      }
    }

    // Match on role (via title or custom claim)
    if (criteria.role) {
      if (!claims.title || !claims.title.toLowerCase().includes(criteria.role.toLowerCase())) {
        return false;
      }
    }

    // Match on arbitrary claim field
    if (criteria.claimField && criteria.claimValue) {
      const claimVal = (claims as Record<string, unknown>)[criteria.claimField];
      if (String(claimVal).toLowerCase() !== criteria.claimValue.toLowerCase()) {
        return false;
      }
    }

    return true;
  }

  private meetsSeniority(
    actual: SeniorityLevel | undefined,
    required: SeniorityLevel,
  ): boolean {
    const order: SeniorityLevel[] = ['associate', 'senior', 'lead', 'director', 'vp', 'c-level'];
    const requiredIdx = order.indexOf(required);
    const actualIdx = actual ? order.indexOf(actual) : -1;
    return actualIdx >= requiredIdx;
  }
}
