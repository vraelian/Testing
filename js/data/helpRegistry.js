// js/data/helpRegistry.js

/**
 * Facade registry for the Contextual Help Modal System.
 * Keys match the defined game contexts. Values are arrays of HTML strings representing individual slides.
 */
export const HELP_REGISTRY = {
    'map': [
        `<div class="help-slide"><h3>Solar Map</h3><p>Select a destination to view its distance and market data.</p></div>`
    ],
    'navigation': [
        `<div class="help-slide"><h3>Navigation</h3><p>Review travel costs and initiate your journey. Make sure you have enough fuel before launching.</p></div>`
    ],
    'cargo': [
        `<div class="help-slide"><h3>Cargo Hold</h3><p>Manage your fleet's combined inventories and review fleet cost averages here.</p></div>`
    ],
    'market': [
        `<div class="help-slide"><h3>Local Market</h3><p>Buy low and sell high. Prices evolve dynamically based on supply, demand, and your trading actions.</p></div>`,
        `<div class="help-slide"><h3>Market Pressure</h3><p>Massive trades create market pressure, delaying inventory replenishment and stabilizing prices.</p></div>`
    ],
    'services-supply': [
        `<div class="help-slide"><h3>Supply Services</h3><p>Refuel your fleet and repair hull damage here.</p></div>`
    ],
    'services-tuning': [
        `<div class="help-slide"><h3>Tuning Shop</h3><p>Purchase and install modular upgrades to enhance your ship's capabilities.</p></div>`
    ],
    'services-supply-sol': [
        `<div class="help-slide"><h3>Sol Station Supply</h3><p>Refuel and repair your ships as usual.</p></div>`,
        `<div class="help-slide"><h3>Endgame Maintenance</h3><p>The intense gravity and radiation of Sol Station requires constant resource donations to maintain structural integrity.</p></div>`
    ],
    'shipyard-shipyard': [
        `<div class="help-slide"><h3>Shipyard</h3><p>Purchase new hulls. Your current ship's upgrades are factored into its trade-in value when purchasing.</p></div>`
    ],
    'shipyard-hangar': [
        `<div class="help-slide"><h3>Hangar</h3><p>View your active ship's stats and currently installed upgrades.</p></div>`
    ],
    'missions-terminal': [
        `<div class="help-slide"><h3>Mission Terminal</h3><p>Accept lucrative contracts. Ensure you have the required cargo capacity before accepting a delivery.</p></div>`
    ],
    'missions-log': [
        `<div class="help-slide"><h3>Mission Log</h3><p>Track your active objectives and their completion status.</p></div>`
    ],
    'finance': [
        `<div class="help-slide"><h3>Finances</h3><p>Manage your debt and view your net worth milestones.</p></div>`
    ],
    'intel-codex': [
        `<div class="help-slide"><h3>The Codex</h3><p>Review discovered lore and narrative logs here.</p></div>`
    ],
    'intel-market': [
        `<div class="help-slide"><h3>Data Broker</h3><p>Purchase temporary, guaranteed market advantages at specific locations. You may only have one active deal at a time.</p></div>`
    ],
    'meta-tutorial': [
        `<div class="help-slide"><h3>Tutorials</h3><p>The game's mechanics are explained via tutorial windows like this one. You can dismiss them at any time using the '-' icon in the top right corner. In-game, you can recall them using the '?' icon.</p></div>`
    ],
    'meta-autosave': [
        `<div class="help-slide"><h3>Auto-Save</h3><p>Orbital Trading automatically saves your progress after every flight to a new location. You can also manually manage your saves in the Options menu.</p></div>`
    ]
};