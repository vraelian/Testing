// js/services/handlers/TooltipHandler.js
/**
 * @fileoverview Manages the display and lifecycle of tooltips, price graphs,
 * and other contextual pop-ups that appear on user interaction (hover or click).
 */
import { ACTION_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js'; 

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
        
        // --- Action Handling ---
        if (actionTarget) {
            const { action } = actionTarget.dataset;
            switch(action) {
                case 'toggle-tooltip':
                    this._toggleStatusTooltip(actionTarget);
                    return;
                
                case 'show-attribute-tooltip':
                    e.stopPropagation(); 
                    e.preventDefault();

                    // Stateful Toggle Logic
                    const tooltipEl = document.getElementById('generic-tooltip');
                    const isGenericVisible = tooltipEl && tooltipEl.style.display === 'block';
                    if (this.activeTooltipTarget === actionTarget && isGenericVisible) {
                        this.uiManager.hideGenericTooltip();
                        this.activeTooltipTarget = null;
                    } else {
                        const attrId = actionTarget.dataset.attributeId;
                        const definition = GameAttributes.getDefinition(attrId);
                        if (definition) {
                            const content = `<span class="font-roboto-mono text-xs text-gray-200 leading-tight">${definition.description}</span>`;
                            const coords = this._getArtFrameCenter(actionTarget, e);
                            this.uiManager.showGenericTooltip(actionTarget, content, 'center', coords);
                            this.activeTooltipTarget = actionTarget;
                        }
                    }
                    return;

                case 'show-lore-tooltip':
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const loreTooltipEl = document.getElementById('generic-tooltip');
                    const isVisibleLore = loreTooltipEl && loreTooltipEl.style.display === 'block';
                    if (this.activeTooltipTarget === actionTarget && isVisibleLore) {
                        this.uiManager.hideGenericTooltip();
                        this.activeTooltipTarget = null;
                    } else {
                        const coords = this._getArtFrameCenter(actionTarget, e);
                        this.uiManager.showGenericTooltip(actionTarget, actionTarget.dataset.tooltip, 'center', coords);
                        this.activeTooltipTarget = actionTarget;
                    }
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

        // Only hide if we didn't click another tooltip-triggering element
        if (this.activeTooltipTarget && actionTarget !== this.activeTooltipTarget) {
            this.uiManager.hideGraph();
            this.uiManager.hideGenericTooltip();
            this.activeTooltipTarget = null;
        }
        
        if (this.uiManager.isMobile) {
            this._handleMobileTooltip(e);
        }

        this._handleLoreAndTutorialLog(e);
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
     * Traverses the DOM to find the primary ship art image and synthesizes its exact absolute center.
     * Bypasses the parent container relative coordinates to guarantee centered tooltips over the 1:1 frame.
     * @private
     */
    _getArtFrameCenter(anchorTarget, e) {
        let shipImage = null;

        // 1. Check if the anchor itself is in a container with the image (carousel page, or intro modal)
        const localContainer = anchorTarget.closest('.carousel-page, #ship-detail-content');
        if (localContainer) {
            shipImage = localContainer.querySelector('img');
        }

        // 2. If no image found locally (e.g., standard ship detail modal), hunt for the background carousel page
        if (!shipImage && anchorTarget.closest('#ship-detail-modal')) {
            const targetBtn = document.querySelector('#ship-detail-content [data-ship-id]');
            if (targetBtn && targetBtn.dataset.shipId) {
                const carouselPage = document.querySelector(`.carousel-page[data-ship-id="${targetBtn.dataset.shipId}"]`);
                if (carouselPage) {
                    shipImage = carouselPage.querySelector('img');
                }
            }
        }

        if (shipImage) {
            // The image is static relative to the viewport during the interaction,
            // making its bounding rect perfectly stable.
            const rect = shipImage.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return { 
                    x: rect.left + (rect.width / 2), 
                    y: rect.top + (rect.height / 2),
                    isArtFrame: true // Flag for UIManager absolute centering math
                };
            }
        }
        
        // 3. Fallback to explicit pointer coordinates if the art frame cannot be isolated
        const coords = this._getEventCoordinates(e, anchorTarget);
        if (coords) coords.isArtFrame = false;
        return coords;
    }

    /**
     * Extracts precise pointer coordinates across Touch, Pointer, and Mouse events.
     * Falls back to the physical center of the target element if all pointers are stripped.
     * @private
     */
    _getEventCoordinates(e, anchorTarget) {
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.clientX !== undefined) {
            return { x: e.clientX, y: e.clientY };
        }
        if (anchorTarget) {
            const rect = anchorTarget.getBoundingClientRect();
            return { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
        }
        return null;
    }

    _toggleStatusTooltip(target) {
        const tooltip = target.querySelector('.status-tooltip');
        if (!tooltip) return;
        
        const isVisible = tooltip.classList.contains('visible');
        
        if (this.activeStatusTooltip === tooltip && isVisible) {
            tooltip.classList.remove('visible');
            this.activeStatusTooltip = null;
        } else {
            if (this.activeStatusTooltip) this.activeStatusTooltip.classList.remove('visible');
            tooltip.classList.add('visible');
            this.activeStatusTooltip = tooltip;
        }
    }

    _handleMobileTooltip(e) {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget && !tooltipTarget.closest('[data-action="toggle-tooltip"], [data-action="show-attribute-tooltip"], [data-action="show-lore-tooltip"]')) {
            this.uiManager.hideGraph();
            if (this.activeTooltipTarget === tooltipTarget) {
                this.uiManager.hideGenericTooltip();
                this.activeTooltipTarget = null;
            } else {
                let position = 'right';
                let coords = this._getEventCoordinates(e, tooltipTarget);
                
                // Route all standard ( i ) tooltips inside the ship card/modal to the art frame centering logic
                if (tooltipTarget.closest('.carousel-page, #ship-detail-modal')) {
                    position = 'center';
                    coords = this._getArtFrameCenter(tooltipTarget, e);
                }

                this.uiManager.showGenericTooltip(tooltipTarget, tooltipTarget.dataset.tooltip, position, coords);
                this.activeTooltipTarget = tooltipTarget;
            }
        }
    }

    _handleLoreAndTutorialLog(e) {
        const tutorialTrigger = e.target.closest('.tutorial-container');
        const loreTrigger = e.target.closest('.lore-container');

        const visibleTooltip = document.querySelector('.lore-tooltip.visible, .tutorial-tooltip.visible');
        if (visibleTooltip && !e.target.closest('.lore-tooltip, .tutorial-tooltip')) {
            visibleTooltip.classList.remove('visible');
        }
        
        if (loreTrigger) {
            loreTrigger.querySelector('.lore-tooltip')?.classList.toggle('visible');
        }

        if (tutorialTrigger) {
            this.uiManager.showTutorialLogModal({
                seenBatches: this.gameState.tutorials.seenBatchIds,
                onSelect: (batchId) => this.tutorialService.triggerBatch(batchId)
            });
        }
    }
}