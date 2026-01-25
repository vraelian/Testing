// js/services/RandomEventService.js
/**
 * @fileoverview
 * The central engine for Event System 2.0.
 * UPDATED: Includes logic to pre-evaluate choices and disable them if requirements are not met.
 */

import { RANDOM_EVENTS } from '../data/events.js';
import { EVENT_CONSTANTS } from '../data/constants.js';
import { ConditionEvaluator } from './ConditionEvaluator.js';
import { OutcomeResolver } from './OutcomeResolver.js';
import { DynamicValueResolver } from './DynamicValueResolver.js';
import { applyEffect } from './eventEffectResolver.js';

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
                if (choice.requirements && choice.requirements.length > 0) {
                    // Check if player meets requirements
                    const meetsReqs = this.evaluator.checkAll(choice.requirements, gameState, simulationService);
                    
                    if (!meetsReqs) {
                        choice.disabled = true;
                        // Optional: Append a flag or text to indicate why (handled by UI style usually)
                    }
                }
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
                
                calculatedEffects.push(concreteEffect);

                // C. Apply the effect to the GameState immediately
                applyEffect(gameState, simulationService, concreteEffect, outcomeDef);
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
}