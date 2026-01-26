// js/data/lore/loreRegistry.js
import { LORE_BROADSTROKES } from './lore_broadstrokes.js';

/**
 * The Central Registry for all Game Lore.
 * This file acts as a Facade, aggregating content from multiple volumes
 * into a single lookup object for the UI.
 */
export const LORE_REGISTRY = {
    ...LORE_BROADSTROKES
    // Future volumes (Acts, Arcs) will be spread here.
};