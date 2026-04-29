// js/services/AchievementService.js
import { ACHIEVEMENT_REGISTRY, REWARD_TYPES } from '../data/achievementRegistry.js';

/**
 * Handles logic layer processing for the meta-progression achievements.
 * Exposes methods to increment tracking ledgers and execute specific reward payloads.
 */
export class AchievementService {
    /**
     * @param {GameState} gameState 
     */
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Injects or increments a specific tracking metric dynamically.
     * Evaluates completion threshold automatically post-mutation.
     * @param {string} metricKey - The specific key mapping to the registry definition.
     * @param {number} value - The raw integer amount to increment.
     * @param {boolean} isAbsoluteOverwrite - If true, replaces the value rather than adding to it.
     */
    increment(metricKey, value = 1, isAbsoluteOverwrite = false) {
        if (!this.gameState || !this.gameState.state.achievements) return;

        let currentVal = this.gameState.state.achievements.metrics[metricKey] || 0;
        
        if (isAbsoluteOverwrite) {
            this.gameState.state.achievements.metrics[metricKey] = value;
        } else {
            this.gameState.state.achievements.metrics[metricKey] = currentVal + value;
        }

        // Silent mutation evaluation
        this.evaluateCompletion(metricKey);
    }

    /**
     * Scans the registry for targets tracking the supplied key and validates 
     * if the required target has been met.
     * @param {string} metricKey 
     */
    evaluateCompletion(metricKey) {
        const value = this.gameState.state.achievements.metrics[metricKey] || 0;
        let requiresStateUpdate = false;

        ACHIEVEMENT_REGISTRY.forEach(ach => {
            if (ach.metricKey === metricKey) {
                // Ensure it isn't already completed or claimed
                if (!this.gameState.state.achievements.status[ach.id]) {
                    if (value >= ach.targetValue) {
                        this.gameState.state.achievements.status[ach.id] = 'COMPLETED';
                        requiresStateUpdate = true;
                    }
                }
            }
        });

        // Trigger a localized check for the completionist tag
        if (requiresStateUpdate) {
            this._checkCompletionistTarget();
            // Force state broadcast to update UI or DOM variables if applicable
            this.gameState.setState({ achievements: this.gameState.state.achievements });
        }
    }

    /**
     * Executes the specific reward logic linked to a completed milestone 
     * and forces the status to CLAIMED.
     * @param {string} achievementId 
     */
    claim(achievementId) {
        const ach = ACHIEVEMENT_REGISTRY.find(a => a.id === achievementId);
        if (!ach || this.gameState.state.achievements.status[achievementId] !== 'COMPLETED') return;

        // Apply Reward
        switch (ach.rewardType) {
            case REWARD_TYPES.CREDITS:
                this.gameState.state.player.credits += ach.rewardPayload;
                break;
            case REWARD_TYPES.VOUCHER_FUEL:
                this.gameState.state.player.serviceTokens.fuel += ach.rewardPayload;
                break;
            case REWARD_TYPES.VOUCHER_REPAIR:
                this.gameState.state.player.serviceTokens.repair += ach.rewardPayload;
                break;
            case REWARD_TYPES.SHIP:
                this.gameState.state.player.ownedShipIds.push(ach.rewardPayload);
                break;
            case REWARD_TYPES.LICENSE:
                if (!this.gameState.state.player.unlockedLicenseIds.includes(ach.rewardPayload)) {
                    this.gameState.state.player.unlockedLicenseIds.push(ach.rewardPayload);
                }
                break;
            case REWARD_TYPES.UNLOCK_LOCATION:
                if (!this.gameState.state.player.unlockedLocationIds.includes(ach.rewardPayload)) {
                    this.gameState.state.player.unlockedLocationIds.push(ach.rewardPayload);
                }
                break;
        }

        // Lock Status
        this.gameState.state.achievements.status[achievementId] = 'CLAIMED';

        // Tally total claims for the 'Completionist' achievement evaluation
        this.increment('achievementsClaimed', 1, false);

        // Force Global Update
        this.gameState.setState({ 
            player: this.gameState.state.player,
            achievements: this.gameState.state.achievements 
        });
    }

    /**
     * Helper evaluation to track and flag the meta-Completionist achievement.
     * @private
     */
    _checkCompletionistTarget() {
        const totalClaimed = Object.values(this.gameState.state.achievements.status).filter(val => val === 'CLAIMED').length;
        this.increment('achievementsClaimed', totalClaimed, true);
    }
}