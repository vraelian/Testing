// js/data/assets_config.js
/**
 * @fileoverview Configuration for ship and commodity asset variants.
 * Defines how many visual variants (A, B, C...) exist for each entity.
 */

export const DEFAULT_VARIANT_COUNT = 5;
export const DEFAULT_COMMODITY_VARIANT_COUNT = 1;
export const DEFAULT_LOCATION_VARIANT_COUNT = 4;

/**
 * A map of Ship IDs to their specific variant counts.
 * Only add entries here if a ship has more or fewer than the DEFAULT_VARIANT_COUNT.
 * Example: If the Mule has 7 variants (A-G), add '[SHIP_IDS.MULE]: 7'.
 * @type {Object<string, number>}
 */
export const SHIP_VARIANT_COUNTS = {
    // 'Mule.Ship': 7, (<-- EXAMPLE)
    'Wanderer.Ship': 6,
    'Stalwart.Ship': 4,
    'Rooster.Ship': 5,
    'Mule.Ship': 8,
    'Nomad.Ship': 6,
    'Mesa.Ship': 8,
    'Pathfinder.Ship': 7,
    'Pilgrim.Ship': 8,
    'Meridian.Ship': 8,
    'Raven.Ship': 9,
    'Warden.Ship': 11,
    'Aegis.Ship': 6,
    'Forerunner.Ship': 9,
    'Guardian.Ship': 11,
    'Valiant.Ship': 11,
    'Eagle.Ship': 12,
    'Tundra.Ship': 11,
    'Atlas.Ship': 9,
    'Vindicator.Ship': 9,
    'Aesudon.Ship': 13,
    'Pterodactyl.Ship': 14,
    'Sovereign.Ship': 14,
    'Titan.Ship': 11,
    'Citadel.Ship': 20,
    'Sophistacles.Ship': 17,
    'Thalassodromeus.Ship': 13,
    'Causality_of_Silence.Ship': 2,
    'Shell_That_Echoes.Ship': 2,
    'Engine_of_Recursion.Ship': 3,
    'Anomaly_of_the_Song.Ship': 4,
    'Parallax_of_Thought.Ship': 4, // FIXED: Parallax (was Parralax)
    'Cryo_Sleep_Pod.Ship': 11,
    'The_Listener.Ship': 3,
    'Finality_of_Whispers.Ship': 4,
};

/**
 * A map of Commodity Names to their specific variant counts.
 * The Key must match the game Name exactly (e.g., "Water Ice").
 * The Code automatically looks for "Water_Ice_A.png".
 * * Update the number to match how many files (A, B, C...) you have created.
 */
export const COMMODITY_VARIANT_COUNTS = {
    'Water Ice': 1,           // File: Water_Ice_A.png
    'Plasteel': 1,            // File: Plasteel_A.png
    'Hydroponics': 1,         // File: Hydroponics_A.png
    'Cybernetics': 1,         // File: Cybernetics_A.png
    'Refined Propellant': 1,  // File: Refined_Propellant_A.png
    'Neural Processors': 1,   // File: Neural_Processors_A.png
    'Graphene Lattices': 1,   // File: Graphene_Lattices_A.png
    'Cryo-Sleep Pods': 1,     // File: Cryo-Sleep_Pods_A.png  <-- Note Hyphen!
    'Atmo Processors': 1,     // File: Atmo_Processors_A.png
    'Cloned Organs': 1,       // File: Cloned_Organs_A.png
    'Xeno-Geologicals': 1,    // File: Xeno-Geologicals_A.png <-- Note Hyphen!
    'Sentient AI Cores': 1,   // File: Sentient_AI_Cores_A.png
    'Antimatter': 1,          // File: Antimatter_A.png
    'Folded-Space Drives': 1  // File: Folded-Space_Drives_A.png <-- Note Hyphen!
};

/**
 * A map of Location file prefixes to their specific variant counts.
 * Key: The prefix used in filenames (e.g., "sol", "mercury", "belt").
 * Value: Number of available images.
 * Defaults to DEFAULT_LOCATION_VARIANT_COUNT (4) if not listed.
 */
export const LOCATION_VARIANT_COUNTS = {
    'Neptune': 12,
    'Mercury': 15,
    'Venus': 12,
    'Earth': 19,
    'Luna': 11,
    'Mars': 10,
    'Belt': 7,
    'Exchange': 6,
    'Jupiter': 9,
    'Saturn': 11,
    'Uranus': 16,
    'Kepler': 12,
    'Pluto': 11,
    'sol': 11,
};