// js/ui/renderers/ShipLoreRenderer.js
/**
 * @fileoverview Stateless renderer for the Ship Lore "Digital Manifest" modal.
 * Generates the HTML structure for the ship's detailed database entry.
 */

/**
 * Generates the HTML string for the Ship Lore modal.
 * @param {object} ship - The ship object from the database.
 * @returns {string} The HTML content.
 */
export const renderShipLore = (ship) => {
    if (!ship) return '<div class="text-center text-red-500 font-roboto-mono">ERROR: SHIP DATA CORRUPTED</div>';

    // Fallback for missing lore
    const rawLore = ship.lore || "Data Corrupted... No registry information available.";

    // Parse lore: Split by newlines to create paragraphs
    // We filter out empty strings to avoid empty paragraphs and spacing issues
    const loreParagraphs = rawLore
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p class="mb-4 last:mb-0">${line}</p>`)
        .join('');

    const shipClass = ship.class || '?';
    // Dynamic CSS variable for class color (e.g., --class-s-color, --class-c-color)
    const classColorVar = `var(--class-${shipClass.toLowerCase()}-color, #fff)`;

    // Generate a "Registry ID" for flavor (e.g., REGISTRY_ID: 884-C-WANDERER)
    const registryId = `REGISTRY_ID: 884-${shipClass}-${ship.name.toUpperCase().replace(/\s+/g, '_')}`;

    return `
        <div class="manifest-content-wrapper flex flex-col h-full relative overflow-hidden">
            <div class="manifest-header flex justify-between items-baseline border-b border-gray-700/50 pb-2 mb-4 shrink-0">
                <h2 class="text-2xl font-roboto-mono font-bold uppercase tracking-wide" style="color: ${classColorVar}; text-shadow: 0 0 8px ${classColorVar}40;">
                    ${ship.name}
                </h2>
                <span class="text-xs font-roboto-mono text-gray-500 tracking-widest hidden md:block opacity-70">
                    ${registryId}
                </span>
            </div>

            <div class="manifest-body flex-grow overflow-y-auto pr-2 custom-scrollbar">
                <div class="lore-text text-justify font-sans text-slate-300 leading-relaxed text-lg tracking-wide">
                    ${loreParagraphs}
                </div>
                
                <div class="mt-8 pt-4 border-t border-gray-800/50 text-xs font-roboto-mono text-gray-600 text-center opacity-50">
                    <p>MERCHANT'S GUILD ARCHIVE // CLASSIFIED: LEVEL 4</p>
                    <p>END OF RECORD</p>
                </div>
            </div>

            <div class="manifest-footer mt-4 pt-2 shrink-0">
                <button class="btn-manifest w-full py-4 border border-cyan-900/50 hover:border-cyan-500/50 bg-cyan-900/10 hover:bg-cyan-900/20 active:bg-cyan-900/40 text-cyan-500 hover:text-cyan-400 font-roboto-mono tracking-[0.2em] transition-all uppercase text-sm font-bold">
                    [ CLOSE_FILE ]
                </button>
            </div>
            
            <div class="pointer-events-none absolute inset-0 bg-scanline opacity-10 z-10"></div>
        </div>
    `;
};