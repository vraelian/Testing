// js/services/RandomEventService.js
/**
 * @fileoverview
 * The central engine for Event System 2.0.
 * This service orchestrates the lifecycle of a random event:
 * 1. Filtering valid events (ConditionEvaluator)
 * 2. Selecting an event (Weighted RNG)
 * 3. Resolving player choices (OutcomeResolver)
 * 4. Calculating dynamic rewards (DynamicValueResolver)
 * 5. Applying effects and triggering UI feedback (EventEffectResolver + UIManager)
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
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @param {string[]} contextTags - Tags defining the current situation (e.g. ['TAG_SPACE', 'TAG_HAZARD'])
     * @returns {Object|null} The hydrated event object or null if none found.
     */
    tryTriggerEvent(gameState, simulationService, contextTags = []) {
        // 1. Filter events by Tag and Conditions
        const validEvents = this._getValidEvents(gameState, simulationService, contextTags);

        if (validEvents.length === 0) {
            return null;
        }

        // 2. Select one based on weight
        const selectedEvent = this._selectWeightedEvent(validEvents);
        
        return selectedEvent;
    }

    /**
     * Forces a specific event to trigger by ID, bypassing standard checks.
     * @param {string} eventId
     * @returns {Object|null}
     */
    getEventById(eventId) {
        return RANDOM_EVENTS.find(e => e.id === eventId) || null;
    }

    /**
     * Processes a player's decision during an event.
     * @param {string} eventId - The ID of the active event.
     * @param {string} choiceId - The ID of the selected choice.
     * @param {import('./GameState.js').GameState} gameState
     * @param {import('./SimulationService.js').SimulationService} simulationService
     * @param {import('./UIManager.js').UIManager} [uiManager=null]
     * @returns {Object} The finalized outcome object with calculated effects.
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
        // Priority: Outcome Title -> Event Template Title -> Event Title -> Fallback
        const eventTitle = outcomeDef.title || eventDef.template?.title || eventDef.title || `Unknown Event (${eventId})`;

        // 3. Calculate Dynamic Effects AND Apply Them
        const calculatedEffects = [];
        
        if (outcomeDef.effects) {
            outcomeDef.effects.forEach(effect => {
                // A. Resolve the dynamic value (e.g. "10% of Max Hull" -> 15)
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
            // Pass 3 arguments: (Title, Text, Effects)
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