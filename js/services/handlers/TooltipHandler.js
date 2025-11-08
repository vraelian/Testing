// js/services/handlers/TooltipHandler.js
/**
 * @fileoverview
 * This handler is responsible for all logic related to showing and hiding
 * tooltips, both on hover (desktop) and on click (mobile/graphs).
 * It delegates the actual rendering and DOM manipulation to the TooltipService.
 */

import { ACTION_IDS } from '../../data/constants.js';

export class TooltipHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../ui/TooltipService.js').TooltipService} tooltipService
     */
    constructor(gameState, tooltipService) {
        this.gameState = gameState;
        // --- VIRTUAL WORKBENCH: INJECT TOOLTIPSERVICE ---
        this.tooltipService = tooltipService;
        // --- END VIRTUAL WORKBENCH ---

        this.isMobile = window.innerWidth <= 768;
    }

    /**
     * Handles click events for tooltips (e.g., price graphs, mobile tooltips).
     * @param {Event} e - The native click event.
     * @param {HTMLElement} target - The element with the data-action.
     * @param {string} action - The specific action ID.
     */
    handleClick(e, target, action) {
        // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPSERVICE ---
        if (action === ACTION_IDS.SHOW_PRICE_GRAPH || action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            // Toggle graph visibility
            if (this.tooltipService.activeGraphAnchor === target) {
                this.tooltipService.hideGraph();
            } else {
                this.tooltipService.hideGraph(); // Hide any existing graph
                this.tooltipService.showGraph(target, this.gameState.getState(), action);
            }
        } else if (this.isMobile && action === ACTION_IDS.TOGGLE_TOOLTIP) {
            // Toggle generic tooltip visibility on mobile
            const content = target.dataset.tooltip;
            if (content) {
                if (this.tooltipService.activeGenericTooltipAnchor === target) {
                    this.tooltipService.hideGenericTooltip();
                } else {
                    this.tooltipService.hideGenericTooltip(); // Hide any existing
                    this.tooltipService.showGenericTooltip(target, content);
                }
            }
        }
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Handles mouseover events to show generic tooltips on desktop.
     * @param {Event} e - The native mouseover event.
     */
    handleMouseOver(e) {
        if (this.isMobile) return;

        // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPSERVICE ---
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget) {
            const content = tooltipTarget.dataset.tooltip;
            if (content) {
                this.tooltipService.showGenericTooltip(tooltipTarget, content);
            }
        }
        // --- END VIRTUAL WORKBENCH ---
    }

    /**
     * Handles mouseout events to hide generic tooltips on desktop.
     * @param {Event} e - The native mouseout event.
     */
    handleMouseOut(e) {
        if (this.isMobile) return;

        // --- VIRTUAL WORKBENCH: DELEGATE TO TOOLTIPSERVICE ---
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget) {
            this.tooltipService.hideGenericTooltip();
        }
        // --- END VIRTUAL WORKBENCH ---
    }
}