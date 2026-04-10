// js/data/helpRegistry.js

/**
 * Facade registry for the Contextual Help Modal System.
 * Keys match the defined game contexts. Values are arrays of HTML strings representing individual slides.
 */
export const HELP_REGISTRY = {
    'map': [
        `<div class="help-slide"><h3>The Solar System</h3><p>Select a destination to view its economic personality, imports/exports, and fuel price.</p></div>`,
        `<div class="help-slide"><h3>Station Properties</h3><p>Each station has unique economic behavior with fluctuating supply and demand.<br><br>Additionally, available ships and their upgrades will vary by station.</p></div>`
    ],
    'navigation': [
        `<div class="help-slide"><h3>Choose a Destination</h3><p>Fly to a new station with your active ship.<br><br>Review travel costs carefully before you launch.</p></div>`,
        `<div class="help-slide"><h3>Long Distance Travel</h3><p>Stations far from your location may require multiple smaller jumps for refueling.</p></div>`
    ],
    'cargo': [
        `<div class="help-slide"><h3>Ship Cargo</h3><p>Review your fleet's combined inventories and fleet cost averages here.</p></div>`
    ],
    'market': [
        `<div class="help-slide"><h3>Local Station Market</h3><p>The best way to earn credits is to play the market: Buy low and sell high.<br><br>Buying commodities and <i>traveling to a different station to sell them for more than your original purchase price</i> is how you play arbitrage.</p></div>`,
        `<div class="help-slide"><h3>Inspecting the Market</h3><p>Prices evolve dynamically based on <b>supply, demand, and your trading actions</b>.<br><br>Tap the prices to view their price history and performance.</p></div>`,
        `<div class="help-slide"><h3>Economic Behavior</h3><p>Each commodity has a limited quantity available for purchase at each station. Supply will recover eventually over time.<br><br><i>Prices fluctuate naturally but are also influenced by supply, purchases, and sales.</i></p></div>`,
        `<div class="help-slide"><h3>Market Pressure</h3><p>Massive sales create market pressure, delaying inventory replenishment and destabilizing prices.<br><br>Large purchases will quickly drive up prices.</p></div>`
    ],
    'services-supply': [
        `<div class="help-slide"><h3>Station Services</h3><p>Refuel your ship and repair its hull here.<br><br>Fuel price varies by station.</p></div>`
    ],
    'services-tuning': [
        `<div class="help-slide"><h3>Ship Upgrades</h3><p>Purchase and install modular upgrades to enhance your ship's capabilities.<br><br>Check the tuning shop often to find rare upgrades which vary by station.</p></div>`,
        `<div class="help-slide"><h3>Installation Cost</h3><p>The price of a ship upgrade depends upon the value of your ship due to installation costs.</p></div>`
    ],
    'services-supply-sol': [
        `<div class="help-slide"><h3>Sol Station</h3><p>This orbital station, positioned near the Sun, is vital for <b>Antimatter</b> production. Due to the intense heat and energy from the star, the station sustains continuous damage. This requires constant upkeep, which is sustained by the maintenance caches. <br><br><i>A consistent and reliable supply chain of commodities is essential for ensuring uninterrupted operation</i><br><br>When the station is kept stocked with supplies, it will generate <b>Credits</b> and <b>Antimatter</b> for you over time.</p></div>`,
        `<div class="help-slide"><h3>Sol Station Interface</h3><p>You can manage the station and review supply levels to ensure productivity by selecting the <b>Orbital Interface Button</b> to access the <b>Sol Station interface</b>.</p></div>`,
        `<div class="help-slide"><h3>Time at Sol Station</h3><p>The station <i>consumes commodities to maintain its health</i> against the entropy of the Sun. In return for keeping the maintenance caches full, the station will passively generate <b>Credits</b> and <b>Antimatter</b> that may be collected after a time.<br><br>While traveling consumes a significant amount of time, the passage of time only aligns with real-time when docked at the Sol Station.<br><br>At Sol, one day elapses for every two minutes spent docked here.</p></div>`,
        `<div class="help-slide"><h3>Managing the Sol Station</h3><p>To ensure the station maintains <i>optimal resource generation</i>, regularly replenish the maintenance caches with deposits in the <b>Sol Station interface</b>.<br><br>As you unlock <b>Operational Modes</b> and <b>Officers</b>, you may tune the performance of the station.<br><br>The condition of the station’s health is a reflection of the state of the caches. Optimal station health, and therefore regular station output, is maintained by keeping these caches stocked.</p></div>`,
        `<div class="help-slide"><h3>Engineering</h3><p>Level up the Sol Station and boost its performance by completing <b>Engineering Projects</b> in the <b>Sol Station interface</b>.<br><br>Completing projects will unlock a range of benefits, including new operating modes, more officer slots, increased generation, reduced consumption, and larger storage capacities.</p></div>`,
        `<div class="help-slide"><h3>Officers</h3><p>Officers can now be recruited system-wide and employed at the Sol Station. <i>Officers bring unique perks to station performance when assigned</i>.<br><br>Assign available officers to open slots within the <b>Sol Station interface</b>. Completing <b>Engineering Projects</b> will unlock additional officer slots.</p></div>`
    ],
    'shipyard-shipyard': [
        `<div class="help-slide"><h3>Shipyard</h3><p>Ships available for purchase are displayed here. Each station features a unique selection of ships.<br><br>Check the <b>Shipyard interface</b> often for rare and exotic ships.</p></div>`,
        `<div class="help-slide"><h3>Ship Parameters</h3><p>A ship's value is determined by three core attributes: <i>Hull integrity, Fuel capacity, and Cargo space</i>. Ships are categorized into five classes, ordered from least to most capable: <b>C, B, A, S, and O</b>.</p></div>`,
        `<div class="help-slide"><h3>Hull</h3><p>A ship's hull health dictates its ability to withstand damage from micro-meteoroids, collisions, and natural wear and tear during travel.<br><br>To maintain hull integrity, repairs can be performed at any station using the <b>Services interface</b>.<br><br><b>If a ship's hull health drops to zero, the ship is destroyed, resulting in the loss of all cargo. If no backup ships are available in the Hangar, the game will end.</b></p></div>`,
        `<div class="help-slide"><h3>Fuel</h3><p>Fuel is necessary for travel and can be purchased at various stations found in the <b>Services interface</b>.<br><br><b>Fuel is a major regular expense and should be considered carefully.</b> Fuel prices vary between stations. Having a larger fuel tank allows for longer, uninterrupted journeys.<br><br>Running out of fuel mid-journey will leave your ship stranded.</p></div>`,
        `<div class="help-slide"><h3>Cargo</h3><p>A ship's most valuable asset is its cargo capacity. <i>Maximizing the volume of goods you can transport for trade directly increases the profit margin earned per unit through arbitrage</i>.<br><br>You can review additional insights about your cargo in the <b>Cargo interface</b>.</p></div>`
    ],
    'shipyard-hangar': [
        `<div class="help-slide"><h3>Hangar</h3><p>Manage your ship or fleet of ships from any station's hangar. Your currently boarded vessel serves as your active ship, which is the primary vessel for all trades and interactions. While all of your ships travel with you and consume resources, inactive ships require only a minimal amount of fuel per trip.<br><br><i>Your fleet's collective cargo capacity is shared</i> and can be reviewed in the <b>Cargo interface</b>.</p></div>`,
        `<div class="help-slide"><h3>Ship Management</h3><p>Review your ship upgrades in the <b>Hangar</b>. Each ship is limited to three upgrades. The value of these upgrades is factored into the ship's sale price.<br><br>Sold ships can usually be found at their original stations for sale again.</p></div>`
    ],
    'missions-terminal': [
        `<div class="help-slide"><h3>Mission Terminal</h3><p>Complete contracts from Stations, Factions, and other characters to <i>earn rewards and progress the story</i>!<br><br>While major contracts are typically system-wide, many minor contracts are exclusive to specific stations.</p></div>`
    ],
    'missions-log': [
        `<div class="help-slide"><h3>Mission Log</h3><p>Review and submit contracts in the <b>Mission Log</b>. Only four contracts may be held simultaneously. Some contracts may be abandoned if desired.<br><br>Always thoroughly examine mission objectives - many require contract submission at a specific location!</p></div>`
    ],
    'finance': [
        `<div class="help-slide"><h3>Finances</h3><p>Review your transaction history, manage your debt, or take out a loan. Loans include interest and fees.</p></div>`
    ],
    'intel-codex': [
        `<div class="help-slide"><h3>The Codex</h3><p>Access narrative logs, lore, and summaries of the storyline here.<br><br>Check the <b>Codex</b> regularly for updates as you progress.</p></div>`
    ],
    'intel-market': [
        `<div class="help-slide"><h3>Intel</h3><p>Acquire confidential market intelligence for <i>guaranteed, time-sensitive opportunities</i> within the system.<br><br>Only one tip may be purchased at a time. Before purchase, carefully <i>consider the location and travel time</i> needed to take advantage of an opportunity.</p></div>`
    ],
    'meta-tutorial': [
        `<div class="help-slide"><h3>Tutorials</h3><p>Tutorials, such as this one, are used to explain how to play <b>Orbital Trading</b>.<br><br>Dismiss them anytime using the ( <b>-</b> ) icon in the top right corner of the window.<br><br>Recall them again with the ( <b>?</b> ) icon in the bottom right corner of the game screen.</p></div>`
    ],
    'meta-autosave': [
        `<div class="help-slide"><h3>Auto-Saving</h3><p><b>Orbital Trading</b> automatically saves your progress after every flight to a new location.<br><br>You can also manually manage your saves in the <b>Options</b> menu on the title screen.</p></div>`
    ]
};