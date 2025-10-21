// js/ui/components/IntelScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Intel screen.
 * It provides the player with access to the game's lore.
 */

/**
 * Renders the entire Intel screen UI, which includes buttons to view game lore.
 * @returns {string} The HTML content for the Intel screen.
 */
export function renderIntelScreen() {
    return `
        <div class="intel-scroll-panel">
            <div class="text-center p-8 flex flex-col items-center gap-4">
                
                <div id="lore-button-container" class="lore-container w-full max-w-md flex flex-col gap-4">
                    <button class="btn btn-header" data-action="show_lore" data-lore-id="story_so_far">
                        Story So Far...
                    </button>
                    
                    </div>

            </div>
        </div>`;
}