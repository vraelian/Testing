// js/ui/components/IntelScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Intel screen.
 * It renders the static "shell" for the tabbed "Codex" (lore) and
 * "Intel Market" (data broker) views.
 */

/**
 * Renders the entire Intel screen UI, which includes the sub-nav tabs
 * and the content containers for "Codex" and "Intel Market".
 * @returns {string} The HTML content for the Intel screen.
 */
export function renderIntelScreen() {
    // --- VIRTUAL WORKBENCH (A) ---
    // Removed 'active' class from button and content.
    // UIManager will now apply 'active' based on gameState.uiState.activeIntelTab
    // --- END VIRTUAL WORKBENCH ---
    return `
        <div class="sub-nav-bar">
            <button class="sub-nav-button" data-action="set-intel-tab" data-target="intel-codex-content">Codex</button>
            <button class="sub-nav-button" data-action="set-intel-tab" data-target="intel-market-content">Intel Market</button>
        </div>

        <div class="intel-scroll-panel">
            <div id="intel-codex-content" class="intel-tab-content">
                <div id="lore-button-container" class="lore-container w-full max-w-md flex flex-col gap-4 p-4">
                    <button class="btn btn-header" data-action="show_lore" data-lore-id="story_so_far">
                        Story So Far...
                    </button>
                    </div>
            </div>

            <div id="intel-market-content" class="intel-tab-content p-4">
                </div>
        </div>
    `;
}