// js/ui/components/IntelScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Intel screen.
 * It provides the player with access to the game's lore.
 */

/**
 * Renders the entire Intel screen UI, which includes a button to view game lore.
 * @returns {string} The HTML content for the Intel screen.
 */
export function renderIntelScreen() {
    return `
        <div class="intel-scroll-panel">
            <div class="text-center p-8 flex flex-col items-center gap-4">
                 {/* REMOVED Tutorial Button Container */}
                <div id="lore-button-container" class="lore-container relative">
                    <button class="btn btn-header">Story So Far...</button>
                    <div class="lore-tooltip">
                        <p>The year 2140 is the result of a single, massive corporate takeover. A century ago, the "Ad Astra Initiative" released advanced technology to all of humanity, a gift from the new Human-AI Alliance on Earth designed to kickstart our expansion into the stars. It was a promise of a new beginning, an open-source key to the solar system, ensuring the survival of all Earth life, both organic and synthetic.</p><br><p>But a gift to everyone is a business opportunity for the few. The hyper-corporations, already positioned in space, immediately patented the most efficient manufacturing processes and proprietary components for this new technology. This maneuver ensured that while anyone could build a Folded-Space Drive, only the corporations could supply the high-performance parts needed to make it truly effective, creating a system-wide technological dependency that persists to this day. This technological monopoly created the "Drive-Divide," the central pillar of the new class system. Nearly all ships run on older, less efficient hardware. Very few ships employ these coveted Folded-Space Drives.</p><br><p>The major hubs beyond Earth are sovereign, corporate-run territories where law is policy and your rights are listed in an employment contract. These scattered colonies are fierce rivals, engaged in constant economic warfare, all propped up by the interstellar supply lines maintained by the Merchant's Guild. For them, you are just another cog in the great machine of commerce.</p><br><p>In a system owned by corporations, possessing your own ship is the only true form of freedom. Every credit earned, every successful trade, is a bet on your own skill and a step toward true sovereignty on the razor's edge of a cargo manifest.</p>
                    </div>
                </div>
            </div>
        </div>`;
}