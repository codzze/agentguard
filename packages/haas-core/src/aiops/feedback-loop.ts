// ============================================================================
// AgentGuard Core — AIOps Feedback Loop
// Learns from approval patterns to self-adjust risk classifications.
// Tracks per-tool approval/rejection history and auto-tunes tiers.
// ============================================================================

import { EventEmitter } from "events";
import type {
  RiskTier,
  PendingTask,
  ConsensusBundle,
  ApprovalResponse,
} from "../types/index.js";
import { RiskClassifier } from "../classifier/risk-classifier.js";

export interface AIOpsConfig {
  /** Number of consecutive approvals before recommending a tier downgrade (default: 50) */
  downgradeThreshold?: number;
  /** Number of consecutive rejections before recommending a tier upgrade (default: 5) */
  upgradeThreshold?: number;
  /** Whether to auto-apply recommendations (default: true for LOW→MID, false for CRITICAL) */
  autoApply?: boolean;
  /** Tiers that require human confirmation before downgrade */
  protectedTiers?: RiskTier[];
}

export interface ToolStats {
  toolName: string;
  currentTier: RiskTier;
  totalApprovals: number;
  totalRejections: number;
  totalTimeouts: number;
  consecutiveApprovals: number;
  consecutiveRejections: number;
  lastAction: "approved" | "rejected" | "timeout";
  lastActionAt: number;
  tierAdjustments: TierAdjustment[];
}

export interface TierAdjustment {
  from: RiskTier;
  to: RiskTier;
  reason: string;
  timestamp: number;
  autoApplied: boolean;
}

const DEFAULT_CONFIG: Required<AIOpsConfig> = {
  downgradeThreshold: 50,
  upgradeThreshold: 5,
  autoApply: true,
  protectedTiers: ["CRITICAL"],
};

const TIER_ORDER: RiskTier[] = ["LOW", "MID", "HIGH", "CRITICAL"];

export class AIOpsService extends EventEmitter {
  private classifier: RiskClassifier;
  private config: Required<AIOpsConfig>;
  private toolStats: Map<string, ToolStats> = new Map();
  private pendingRecommendations: TierAdjustment[] = [];

  constructor(classifier: RiskClassifier, config: AIOpsConfig = {}) {
    super();
    this.classifier = classifier;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record an approval event for a tool.
   * Called when a tool call is approved by human reviewers.
   */
  recordApproval(toolName: string, riskTier: RiskTier): void {
    const stats = this.getOrCreateStats(toolName, riskTier);
    stats.totalApprovals++;
    stats.consecutiveApprovals++;
    stats.consecutiveRejections = 0;
    stats.lastAction = "approved";
    stats.lastActionAt = Date.now();

    this.emit("aiops:approval-recorded", toolName, stats);

    // Check if we should recommend a downgrade
    if (stats.consecutiveApprovals >= this.config.downgradeThreshold) {
      this.considerDowngrade(toolName, stats);
    }
  }

  /**
   * Record a rejection event for a tool.
   * Called when a tool call is rejected by human reviewers.
   */
  recordRejection(toolName: string, riskTier: RiskTier, reason?: string): void {
    const stats = this.getOrCreateStats(toolName, riskTier);
    stats.totalRejections++;
    stats.consecutiveRejections++;
    stats.consecutiveApprovals = 0;
    stats.lastAction = "rejected";
    stats.lastActionAt = Date.now();

    this.emit("aiops:rejection-recorded", toolName, stats);

    // Check if we should recommend an upgrade
    if (stats.consecutiveRejections >= this.config.upgradeThreshold) {
      this.considerUpgrade(toolName, stats);
    }
  }

  /**
   * Record a timeout event for a tool.
   */
  recordTimeout(toolName: string, riskTier: RiskTier): void {
    const stats = this.getOrCreateStats(toolName, riskTier);
    stats.totalTimeouts++;
    stats.lastAction = "timeout";
    stats.lastActionAt = Date.now();

    this.emit("aiops:timeout-recorded", toolName, stats);
  }

  /**
   * Get statistics for all tracked tools.
   */
  getAllStats(): ToolStats[] {
    return Array.from(this.toolStats.values());
  }

  /**
   * Get statistics for a specific tool.
   */
  getStats(toolName: string): ToolStats | undefined {
    return this.toolStats.get(toolName);
  }

  /**
   * Get pending recommendations that require human confirmation.
   */
  getPendingRecommendations(): TierAdjustment[] {
    return [...this.pendingRecommendations];
  }

  /**
   * Apply a pending recommendation (used when human confirms a protected tier change).
   */
  applyRecommendation(index: number): boolean {
    const recommendation = this.pendingRecommendations[index];
    if (!recommendation) return false;

    this.classifier.adjustRisk(
      recommendation.reason.split("'")[1] ?? "",
      recommendation.to,
    );
    recommendation.autoApplied = true;
    this.pendingRecommendations.splice(index, 1);

    this.emit("aiops:recommendation-applied", recommendation);
    return true;
  }

  /**
   * Get a summary of learning activity for the dashboard.
   */
  getSummary(): {
    totalTrackedTools: number;
    totalAdjustments: number;
    pendingRecommendations: number;
    topApproved: { tool: string; count: number }[];
    topRejected: { tool: string; count: number }[];
  } {
    const stats = this.getAllStats();
    return {
      totalTrackedTools: stats.length,
      totalAdjustments: stats.reduce(
        (sum, s) => sum + s.tierAdjustments.length,
        0,
      ),
      pendingRecommendations: this.pendingRecommendations.length,
      topApproved: stats
        .sort((a, b) => b.totalApprovals - a.totalApprovals)
        .slice(0, 5)
        .map((s) => ({ tool: s.toolName, count: s.totalApprovals })),
      topRejected: stats
        .sort((a, b) => b.totalRejections - a.totalRejections)
        .slice(0, 5)
        .map((s) => ({ tool: s.toolName, count: s.totalRejections })),
    };
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private getOrCreateStats(toolName: string, tier: RiskTier): ToolStats {
    let stats = this.toolStats.get(toolName);
    if (!stats) {
      stats = {
        toolName,
        currentTier: tier,
        totalApprovals: 0,
        totalRejections: 0,
        totalTimeouts: 0,
        consecutiveApprovals: 0,
        consecutiveRejections: 0,
        lastAction: "approved",
        lastActionAt: 0,
        tierAdjustments: [],
      };
      this.toolStats.set(toolName, stats);
    }
    return stats;
  }

  private considerDowngrade(toolName: string, stats: ToolStats): void {
    const currentIdx = TIER_ORDER.indexOf(stats.currentTier);
    if (currentIdx <= 0) return; // Already at lowest tier

    const newTier = TIER_ORDER[currentIdx - 1];
    const adjustment: TierAdjustment = {
      from: stats.currentTier,
      to: newTier,
      reason: `Tool '${toolName}' approved ${stats.consecutiveApprovals} consecutive times — downgrading from ${stats.currentTier} to ${newTier}`,
      timestamp: Date.now(),
      autoApplied: false,
    };

    // Safety: protected tiers require human confirmation
    if (this.config.protectedTiers.includes(stats.currentTier)) {
      this.pendingRecommendations.push(adjustment);
      this.emit("aiops:recommendation-pending", toolName, adjustment);
      return;
    }

    // Auto-apply for non-protected tiers
    if (this.config.autoApply) {
      this.classifier.adjustRisk(toolName, newTier);
      adjustment.autoApplied = true;
      stats.currentTier = newTier;
      stats.consecutiveApprovals = 0;
      stats.tierAdjustments.push(adjustment);
      this.emit("aiops:tier-adjusted", toolName, adjustment);
    } else {
      this.pendingRecommendations.push(adjustment);
      this.emit("aiops:recommendation-pending", toolName, adjustment);
    }
  }

  private considerUpgrade(toolName: string, stats: ToolStats): void {
    const currentIdx = TIER_ORDER.indexOf(stats.currentTier);
    if (currentIdx >= TIER_ORDER.length - 1) return; // Already at highest tier

    const newTier = TIER_ORDER[currentIdx + 1];
    const adjustment: TierAdjustment = {
      from: stats.currentTier,
      to: newTier,
      reason: `Tool '${toolName}' rejected ${stats.consecutiveRejections} consecutive times — upgrading from ${stats.currentTier} to ${newTier}`,
      timestamp: Date.now(),
      autoApplied: false,
    };

    // Upgrades (making things more restrictive) are always auto-applied
    this.classifier.adjustRisk(toolName, newTier);
    adjustment.autoApplied = true;
    stats.currentTier = newTier;
    stats.consecutiveRejections = 0;
    stats.tierAdjustments.push(adjustment);

    this.emit("aiops:tier-adjusted", toolName, adjustment);
  }
}
