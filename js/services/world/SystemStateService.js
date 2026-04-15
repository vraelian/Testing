// js/services/world/SystemStateService.js
import { DB } from '../../data/database.js';

/**
 * @class SystemStateService
 * @description Dedicated logic controller for managing macroeconomic system states,
 * evaluating player footprint thresholds, enforcing the Neutral pause periods,
 * and selecting target locations for Extreme state archetypes.
 */
export class SystemStateService {
    constructor(gameState, logger) {
        this.gameState = gameState;
        this.logger = logger;
    }

    /**
     * Evaluates daily state conditions: countdowns, footprint pruning, and RNG rolls.
     */
    evaluateTick() {
        let sysState = this.gameState.systemStates || this.gameState.systemState;
        
        // Initialize default state for new games or legacy save conversions safely
        if (!sysState) {
            sysState = { activeId: null, remainingDays: 0, targetLocations: [], neutralPauseDays: 0 };
            this.gameState.systemState = sysState;
            this.endCurrentState();
            return;
        }

        if (!sysState.activeId) {
            this.endCurrentState();
            return;
        }

        // 1. Prune Player Economy Footprints (180-day rolling window)
        const cutoffDay = this.gameState.day - 180;
        if (sysState.economyFootprints && sysState.economyFootprints.length > 0) {
            sysState.economyFootprints = sysState.economyFootprints.filter(fp => fp.day >= cutoffDay);
        }

        // 2. Active State Countdown
        if (sysState.activeId !== 'NEUTRAL') {
            sysState.remainingDays--;
            if (sysState.remainingDays <= 0) {
                this.endCurrentState();
            }
        } 
        // 3. Neutral State Countdown & Trigger Evaluation
        else {
            sysState.neutralPauseDays--;
            
            // Evaluate Player Footprints first (Overrides Neutral Pause)
            const footprintTrigger = this._evaluateFootprints();
            if (footprintTrigger) {
                this.triggerState(footprintTrigger.id, footprintTrigger.targets);
                return;
            }

            // Roll RNG if Neutral pause is over
            if (sysState.neutralPauseDays <= 0) {
                this._rollRngState();
            }
        }
    }

    /**
     * Logs a significant player action to the footprint ledger for threshold evaluation.
     * @param {string} type - The type of footprint (e.g., 'DEPLETION')
     * @param {string} locationId - The market ID
     * @param {string} commodityId - The commodity ID
     */
    logPlayerFootprint(type, locationId, commodityId) {
        let sysState = this.gameState.systemStates || this.gameState.systemState;
        if (!sysState) {
            sysState = {};
            this.gameState.systemState = sysState;
        }

        if (!sysState.economyFootprints) {
            sysState.economyFootprints = [];
        }
        
        sysState.economyFootprints.push({
            day: this.gameState.day,
            type,
            locationId,
            commodityId
        });
    }

    /**
     * Evaluates the 180-day footprint ledger to see if player behavior forces a state transition.
     * @returns {object|null} The state payload to trigger, or null.
     * @private
     */
    _evaluateFootprints() {
        let sysState = this.gameState.systemStates || this.gameState.systemState;
        const fps = sysState?.economyFootprints || [];
        const depletions = fps.filter(f => f.type === 'DEPLETION');
        
        // Threshold: Depleting the same commodity at 3 disparate stations
        const byCommodity = {};
        for (const f of depletions) {
            if (!byCommodity[f.commodityId]) byCommodity[f.commodityId] = new Set();
            byCommodity[f.commodityId].add(f.locationId);
        }

        for (const [commodityId, locSet] of Object.entries(byCommodity)) {
            if (locSet.size >= 3) {
                // Clear the triggering footprints to prevent immediate re-trigger
                sysState.economyFootprints = fps.filter(f => f.type !== 'DEPLETION' || f.commodityId !== commodityId);
                
                // Behavior-driven associative response (e.g., Guild panics over bulk buyout)
                return { id: 'GUILD_EMBARGO', targets: null }; 
            }
        }
        return null;
    }

    /**
     * Rolls for a new System State, strictly checking the history ledger to prevent sequential repeats.
     * @private
     */
    _rollRngState() {
        const allStates = Object.keys(DB.SYSTEM_STATES).filter(k => k !== 'NEUTRAL');
        let sysState = this.gameState.systemStates || this.gameState.systemState;
        
        // --- STORY FLAGS OVERRIDE: FORCE SYSTEM STATE ---
        const storyFlags = this.gameState.player?.storyFlags || {};
        for (const [flagKey, flagValue] of Object.entries(storyFlags)) {
            if (flagKey.startsWith('force_state_') && flagValue === true) {
                const forcedStateId = flagKey.replace('force_state_', '').toUpperCase();
                if (DB.SYSTEM_STATES[forcedStateId]) {
                    if (this.logger && this.logger.info && this.logger.info.system) {
                        this.logger.info.system('SystemState', this.gameState.day, 'STATE_FORCED', `Story flag ${flagKey} forced state ${forcedStateId}.`);
                    }
                    this.triggerState(forcedStateId);
                    return; // Exit RNG roll to obey explicit narrative constraint
                }
            }
        }

        const ledger = sysState?.historyLedger || [];
        const lastStateId = ledger.length > 0 ? ledger[ledger.length - 1] : null;
        const lastArchetype = lastStateId && DB.SYSTEM_STATES[lastStateId] ? DB.SYSTEM_STATES[lastStateId].archetype : null;

        // Ensure the new state belongs to a different Archetype than the previous one
        const validStates = allStates.filter(id => {
            if (DB.SYSTEM_STATES[id].archetype === lastArchetype) return false;
            
            // --- STORY FLAGS OVERRIDE: PREVENT SYSTEM STATE ---
            const preventFlag = `prevent_state_${id.toLowerCase()}`;
            if (storyFlags[preventFlag] === true) return false;

            return true;
        });

        if (validStates.length === 0) {
            this.endCurrentState(); // Failsafe
            return;
        }

        const chosenId = validStates[Math.floor(Math.random() * validStates.length)];
        this.triggerState(chosenId);
    }

    /**
     * Activates a specified System State, generating target locations and durations.
     * @param {string} stateId - The registry ID of the system state.
     * @param {Array<string>} [overrideTargetLocations=null] - Optional hardcoded targets.
     */
    triggerState(stateId, overrideTargetLocations = null) {
        const stateDef = DB.SYSTEM_STATES[stateId];
        if (!stateDef) return;

        let sysState = this.gameState.systemStates || this.gameState.systemState;
        
        // Safely initialize if somehow undefined at point of trigger
        if (!sysState) {
            sysState = {};
            this.gameState.systemState = sysState;
        }
        
        // Archive the previous active state to the history ledger
        if (sysState.activeId && sysState.activeId !== 'NEUTRAL') {
            if (!sysState.historyLedger) sysState.historyLedger = [];
            sysState.historyLedger.push(sysState.activeId);
            if (sysState.historyLedger.length > 10) sysState.historyLedger.shift();
        }

        sysState.activeId = stateId;
        sysState.remainingDays = Math.floor(Math.random() * (stateDef.durationBounds[1] - stateDef.durationBounds[0] + 1)) + stateDef.durationBounds[0];

        // Roll and save a static varietal index for narrative consistency
        if (stateDef.varietals && stateDef.varietals.length > 0) {
            sysState.varietalIndex = Math.floor(Math.random() * stateDef.varietals.length);
        } else {
            sysState.varietalIndex = 0;
        }

        // Process Extreme state targeting
        if (overrideTargetLocations) {
            sysState.targetLocations = overrideTargetLocations;
        } else if (stateDef.modifiers && stateDef.modifiers.requiresLocationTarget) {
            sysState.targetLocations = this._generateTargetLocations(stateDef.modifiers.locationCount || 1);
        } else {
            sysState.targetLocations = [];
        }

        if (this.logger && this.logger.info && this.logger.info.system) {
             this.logger.info.system('SystemState', this.gameState.day, 'STATE_CHANGE', `Transitioned to ${stateId} for ${sysState.remainingDays} days.`);
        }
    }

    /**
     * Forces the end of an active state, returning the system to the 'NEUTRAL' pause phase.
     */
    endCurrentState() {
        let sysState = this.gameState.systemStates || this.gameState.systemState;
        if (!sysState) {
            sysState = {};
            this.gameState.systemState = sysState;
        }

        if (sysState.activeId && sysState.activeId !== 'NEUTRAL') {
            if (!sysState.historyLedger) sysState.historyLedger = [];
            sysState.historyLedger.push(sysState.activeId);
            if (sysState.historyLedger.length > 10) sysState.historyLedger.shift();
        }

        const neutralDef = DB.SYSTEM_STATES['NEUTRAL'];
        sysState.activeId = 'NEUTRAL';
        sysState.remainingDays = 0;
        sysState.targetLocations = [];
        sysState.varietalIndex = 0;
        
        if (neutralDef) {
            sysState.neutralPauseDays = Math.floor(Math.random() * (neutralDef.durationBounds[1] - neutralDef.durationBounds[0] + 1)) + neutralDef.durationBounds[0];
        } else {
            sysState.neutralPauseDays = 7; // Fallback
        }

        if (this.logger && this.logger.info && this.logger.info.system) {
             this.logger.info.system('SystemState', this.gameState.day, 'STATE_CHANGE', `Transitioned to NEUTRAL for ${sysState.neutralPauseDays} days.`);
        }
    }

    /**
     * Generates a specified number of geographically logical target locations.
     * @param {number} count - 1 for singular extremes, 3 for tri-location collapses.
     * @returns {Array<string>} Array of location IDs.
     * @private
     */
    _generateTargetLocations(count) {
        // Linear array of valid locations (excluding the most extreme bounds/anomalies for standard economic zones)
        const validMarkets = DB.MARKETS.filter(m => 
            m.id !== 'loc_sun' && 
            m.id !== 'loc_exchange' && 
            m.id !== 'loc_kepler'
        ).sort((a, b) => a.distance - b.distance);
        
        if (count === 1) {
            return [validMarkets[Math.floor(Math.random() * validMarkets.length)].id];
        } else if (count === 3) {
            // Find a linear cluster for cascading failures
            const startIndex = Math.floor(Math.random() * (validMarkets.length - 2));
            return [
                validMarkets[startIndex].id,
                validMarkets[startIndex + 1].id,
                validMarkets[startIndex + 2].id
            ];
        }
        return [];
    }
}