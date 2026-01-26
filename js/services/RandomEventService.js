
// js/services/RandomEventService.js
/**
 * @fileoverview
 * The central engine for Event System 2.0.
 * UPDATED: Includes logic to pre-evaluate choices and disable them if requirements are not met.
 * UPDATED: Automatically formats choice text to replace raw "Scale" strings with actual calculated values.
 */

import { RANDOM_EVENTS } from '../data/events.js';
import { EVENT_CONSTANTS } from '../data/constants.js';
import { ConditionEvaluator } from './ConditionEvaluator.js';
import { OutcomeResolver } from './OutcomeResolver.js';
import { DynamicValueResolver } from './DynamicValueResolver.js';
import { applyEffect } from './eventEffectResolver.js';
// [[UPDATED]]: Import helper for cargo check
import { calculateInventoryUsed } from '../utils.js';
// [[UPDATED]]: Import DB for Item Name lookups
import { DB } from '../data/database.js';

export class RandomEventService {
    constructor() {
        this.evaluator = new ConditionEvaluator();
        this.outcomeResolver = new OutcomeResolver(this.evaluator);
        this.valueResolver = new DynamicValueResolver();
    }

    /**
     * Attempts to find and select a valid random event for the current context.
     * UPDATED: Now creates a deep copy of the event and checks choice requirements.
     */
    tryTriggerEvent(gameState, simulationService, contextTags = []) {
        // 1. Filter events by Tag and Conditions
        const validEvents = this._getValidEvents(gameState, simulationService, contextTags);

        if (validEvents.length === 0) {
            return null;
        }

        // 2. Select one based on weight
        const selectedEventTemplate = this._selectWeightedEvent(validEvents);
        
        // 3. [[UPDATED]]: Create a Deep Clone to avoid mutating the static database
        const eventInstance = JSON.parse(JSON.stringify(selectedEventTemplate));

        // 4. [[UPDATED]]: Evaluate choices to determine if they should be enabled/disabled
        if (eventInstance.choices) {
            eventInstance.choices.forEach(choice => {
                
                // A. Check explicit requirements (e.g. Has Credits > 500)
                if (choice.requirements && choice.requirements.length > 0) {
                    const meetsReqs = this.evaluator.checkAll(choice.requirements, gameState, simulationService);
                    
                    if (!meetsReqs) {
                        choice.disabled = true;
                    }
                }

                // B. [[UPDATED]]: Implicit Requirement - "Cannot Risk Cargo if Cargo is Empty"
                // If the choice is not yet disabled, check if it leads to potential cargo loss
                if (!choice.disabled) {
                     const potentialOutcomes = this._getPotentialOutcomes(choice, eventInstance);
                     const risksCargo = potentialOutcomes.some(o => 
                         o.effects && o.effects.some(e => e.type === EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO)
                     );

                     if (risksCargo) {
                         const inventory = simulationService._getActiveInventory();
                         const used = calculateInventoryUsed(inventory);
                         
                         if (used <= 0) {
                             choice.disabled = true;
                             // Append explanation to text
                              const textMatch = (choice.text || choice.title).match(/^(.*?)\s*(\(.*\))?$/);
                              const baseText = textMatch ? textMatch[1] : (choice.text || choice.title);
                              choice.text = `${baseText} (No Cargo to Risk)`;
                         }
                     }
                }

                // C. [[UPDATED]]: Dynamic Text Formatting
                // Replaces raw strings like "(-15 Ice * Scale)" with actuals "(-30 Water Ice)"
                this._hydrateChoiceText(choice, gameState);
            });
        }
        
        return eventInstance;
    }

    /**
     * Forces a specific event to trigger by ID, bypassing standard checks.
     */
    getEventById(eventId) {
        // [[UPDATED]]: Clone here as well to be safe
        const template = RANDOM_EVENTS.find(e => e.id === eventId);
        return template ? JSON.parse(JSON.stringify(template)) : null;
    }

    /**
     * Processes a player's decision during an event.
     */
    resolveChoice(eventId, choiceId, gameState, simulationService, uiManager = null) {
        const eventDef = RANDOM_EVENTS.find(e => e.id === eventId);
        if (!eventDef) throw new Error(`Event not found: ${eventId}`);

        const choiceDef = eventDef.choices.find(c => c.id === choiceId);
        if (!choiceDef) throw new Error(`Choice not found: ${choiceId}`);

        // 1. Determine the Outcome ID (Success/Fail/etc)
        const outcomeId = this.outcomeResolver.resolve(choiceDef.resolution, gameState, simulationService);
        const outcomeDef = eventDef.outcomes[outcomeId];

        if (!outcomeDef) {
            console.error(`Outcome definition missing: ${outcomeId}`);
            return null;
        }

        // 2. Capture the Title Logic
        const eventTitle = outcomeDef.title || eventDef.template?.title || eventDef.title || `Unknown Event (${eventId})`;

        // 3. Calculate Dynamic Effects AND Apply Them
        const calculatedEffects = [];
        
        if (outcomeDef.effects) {
            outcomeDef.effects.forEach(effect => {
                // A. Resolve the dynamic value
                const finalValue = this.valueResolver.resolve(effect.value, gameState);
                
                // B. Create a concrete effect object with the resolved number
                const concreteEffect = {
                    ...effect,
                    value: finalValue
                };
                
                // C. Apply the effect to the GameState immediately
                // [[UPDATED]]: Capture result to merge dynamic details (like item names) back into the effect for UI
                const result = applyEffect(gameState, simulationService, concreteEffect, outcomeDef);

                if (result && typeof result === 'object') {
                    Object.assign(concreteEffect, result);
                }
                
                calculatedEffects.push(concreteEffect);
            });
        }

        // 4. Trigger UI Feedback
        if (uiManager) {
            uiManager.showEventResultModal(eventTitle, outcomeDef.text, calculatedEffects);
        }

        // 5. Return the fully resolved package
        return {
            outcomeId: outcomeId,
            title: eventTitle,
            text: outcomeDef.text, 
            effects: calculatedEffects
        };
    }

    /**
     * Internal helper to filter the global event registry.
     * @private
     */
    _getValidEvents(gameState, simulationService, contextTags) {
        return RANDOM_EVENTS.filter(event => {
            // Check 1: Do tags match? (Must have at least one matching tag)
            const hasMatchingTag = event.tags.some(tag => contextTags.includes(tag));
            if (!hasMatchingTag) return false;

            // Check 2: Are all requirements met?
            return this.evaluator.checkAll(event.requirements, gameState, simulationService);
        });
    }

    /**
     * Standard weighted random selection.
     * @private
     */
    _selectWeightedEvent(events) {
        const totalWeight = events.reduce((sum, e) => sum + (e.weight || 10), 0);
        let random = Math.random() * totalWeight;

        for (const event of events) {
            const w = event.weight || 10;
            if (random < w) return event;
            random -= w;
        }
        return events[events.length - 1];
    }
    
    /**
     * Internal helper to find all possible outcomes for a choice.
     * Used for risk analysis (e.g. disabling buttons if cargo is 0).
     * @private
     */
    _getPotentialOutcomes(choice, eventInstance) {
        if (!choice.resolution || !eventInstance.outcomes) return [];
        
        const outcomes = [];
        
        if (choice.resolution.type === EVENT_CONSTANTS.RESOLVERS.DETERMINISTIC) {
             const id = choice.resolution.pool[0]?.outcomeId;
             if (id && eventInstance.outcomes[id]) outcomes.push(eventInstance.outcomes[id]);
        } 
        else if (choice.resolution.type === EVENT_CONSTANTS.RESOLVERS.WEIGHTED_RNG || choice.resolution.type === EVENT_CONSTANTS.RESOLVERS.STAT_CHECK) {
            choice.resolution.pool.forEach(item => {
                if (item.outcomeId && eventInstance.outcomes[item.outcomeId]) {
                    outcomes.push(eventInstance.outcomes[item.outcomeId]);
                }
            });
        }
        
        return outcomes;
    }

    /**
     * Scans choice text for raw dynamic string patterns (e.g. "* Scale")
     * and replaces them with the actual resolved values from the requirements.
     * @private
     */
    _hydrateChoiceText(choice, gameState) {
        if (!choice.text || !choice.text.toLowerCase().includes('scale')) return;

        // Pattern matching: Looks for (...) containing "* Scale"
        // e.g. "Flush with Coolant (-15 Ice * Scale)"
        const scalePattern = /\((.*?) \* Scale\)/i;
        const match = choice.text.match(scalePattern);

        if (match) {
            // Found a scale pattern. Try to find the linked requirement to get the real value.
            // We look for a requirement that is a 'cost' (HAS_ITEM or HAS_CREDITS) with dynamic scaling.
            const costReq = choice.requirements?.find(r => 
                (r.type === EVENT_CONSTANTS.CONDITIONS.HAS_ITEM || 
                 r.type === EVENT_CONSTANTS.CONDITIONS.HAS_CREDITS ||
                 r.type === EVENT_CONSTANTS.CONDITIONS.HAS_FUEL) &&
                typeof r.value === 'object' && r.value.scaleWith
            );

            if (costReq) {
                const actualValue = this.valueResolver.resolve(costReq.value, gameState);
                let label = '';

                if (costReq.type === EVENT_CONSTANTS.CONDITIONS.HAS_ITEM) {
                    const item = DB.COMMODITIES.find(c => c.id === costReq.target);
                    label = item ? item.name : costReq.target;
                } else if (costReq.type === EVENT_CONSTANTS.CONDITIONS.HAS_CREDITS) {
                    label = 'Credits';
                } else if (costReq.type === EVENT_CONSTANTS.CONDITIONS.HAS_FUEL) {
                    label = 'Fuel';
                }

                // Replace the entire parenthetical match with clean text
                choice.text = choice.text.replace(scalePattern, `(-${actualValue} ${label})`);
            } else {
                // Fallback: If no requirement matches, just strip the " * Scale" text so it isn't ugly
                choice.text = choice.text.replace(' * Scale', '');
            }
        }
    }
}