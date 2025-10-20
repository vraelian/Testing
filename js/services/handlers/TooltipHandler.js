// js/services/handlers/TooltipHandler.js
/**
 * @fileoverview Manages the display and lifecycle of tooltips, price graphs,
 * and other contextual pop-ups that appear on user interaction (hover or click).
 */
import { ACTION_IDS } from '../../data/constants.js';

export class TooltipHandler {
    /**
     * @param {import('../GameState.js').GameState} gameState The central game state object.
     * @param {import('../UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(gameState, uiManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.activeTooltipTarget = null;
        this.activeStatusTooltip = null;
    }

    /**
     * Handles click events to manage tooltips, primarily for mobile and special cases.
     * @param {Event} e The click event.
     */
    handleClick(e) {
        const actionTarget = e.target.closest('[data-action]');

        // --- Pre-action Cleanup ---
        if (this.activeStatusTooltip && !this.uiManager.isClickInside(e, '[data-action="toggle-tooltip"]')) {
            this.activeStatusTooltip.classList.remove('visible');
            this.activeStatusTooltip = null;
        }
        if (this.uiManager.isClickInside(e, '#graph-tooltip, #generic-tooltip')) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
            return;
        }
        if (this.activeTooltipTarget && actionTarget !== this.activeTooltipTarget) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
        }
        
        // --- Action Handling ---
        if (actionTarget) {
            const { action } = actionTarget.dataset;
            switch(action) {
                case 'toggle-tooltip':
                    this._toggleStatusTooltip(actionTarget);
                    return;
                case ACTION_IDS.SHOW_PRICE_GRAPH:
                case ACTION_IDS.SHOW_FINANCE_GRAPH:
                    if (this.uiManager.isMobile) {
                        this.uiManager.hideGenericTooltip();
                        if (this.activeTooltipTarget === actionTarget) {
                            this.uiManager.hideGraph();
                            this.activeTooltipTarget = null;
                        } else {
                            this.uiManager.showGraph(actionTarget, this.gameState.getState());
                            this.activeTooltipTarget = actionTarget;
                        }
                    }
                    break;
            }
        }
        
        if (this.uiManager.isMobile) {
            this._handleMobileTooltip(e);
        }

        this._handleLoreClick(e); // Renamed from _handleLoreAndTutorialLog
    }

    /**
     * Handles mouseover events for desktop tooltips and graphs.
     * @param {Event} e The mouseover event.
     */
    handleMouseOver(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.showGraph(graphTarget, this.gameState.getState());
        }
    }

    /**
     * Handles mouseout events for desktop tooltips and graphs.
     * @param {Event} e The mouseout event.
     */
    handleMouseOut(e) {
        if (this.uiManager.isMobile) return;
        const graphTarget = e.target.closest(`[data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}"], [data-action="${ACTION_IDS.SHOW_FINANCE_GRAPH}"]`);
        if (graphTarget) {
            this.uiManager.hideGraph();
        }
    }

    /**
     * Toggles the visibility of a status bar tooltip.
     * @param {HTMLElement} target The element containing the tooltip.
     * @private
     */
    _toggleStatusTooltip(target) {
        const tooltip = target.querySelector('.status-tooltip');
        if (!tooltip) return;
        if (this.activeStatusTooltip === tooltip) {
            tooltip.classList.remove('visible');
            this.activeStatusTooltip = null;
        } else {
            if (this.activeStatusTooltip) this.activeStatusTooltip.classList.remove('visible');
            tooltip.classList.add('visible');
            this.activeStatusTooltip = tooltip;
        }
    }

    /**
     * Handles tooltip display logic specifically for mobile (tap to show/hide).
     * @param {Event} e The click event.
     * @private
     */
    _handleMobileTooltip(e) {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget && !tooltipTarget.closest('[data-action="toggle-tooltip"]')) {
            this.uiManager.hideGraph();
            if (this.activeTooltipTarget === tooltipTarget) {
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            } else {
                this.uiManager.showGenericTooltip(tooltipTarget, tooltipTarget.dataset.tooltip);
                this.activeTooltipTarget = tooltipTarget;
            }
        }
    }

    /**
     * Handles clicks related to lore tooltips.
     * @param {Event} e The click event.
     * @private
     */
    _handleLoreClick(e) {
        const loreTrigger = e.target.closest('.lore-container');

        // Close any visible lore tooltip if clicking outside of it.
        const visibleTooltip = document.querySelector('.lore-tooltip.visible');
        if (visibleTooltip && !e.target.closest('.lore-tooltip')) {
            visibleTooltip.classList.remove('visible');
        }
        
        // Toggle the visibility of the clicked lore tooltip.
        if (loreTrigger) {
            loreTrigger.querySelector('.lore-tooltip')?.classList.toggle('visible');
        }
    }
}