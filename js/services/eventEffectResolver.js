// js/services/eventEffectResolver.js
/**
 * @fileoverview This file acts as a resolver for all random event outcomes. It maps effect types
 * to their corresponding handler functions, providing a centralized and extensible way to
 * apply the consequences of player choices during events.
 * UPDATED: Added Math.round() to enforce integer values and preventing float drift.
 */
import { resolveSpaceRace } from './event-effects/effectSpaceRace.js';
import { resolveAdriftPassenger } from './event-effects/effectAdriftPassenger.js';
import { calculateInventoryUsed } from '../utils.js';
import { DB } from '../data/database.js';
import { COMMODITY_IDS, EVENT_CONSTANTS, NAV_IDS, SCREEN_IDS, PERK_IDS } from '../data/constants.js';
import { GameAttributes } from './GameAttributes.js';

/**
 * A map of effect type strings to their corresponding handler functions.
 */
const effectHandlers = {
    // --- Custom, Complex Event Handlers ---
    'SPACE_RACE': resolveSpaceRace,
    'ADRIFT_PASSENGER': resolveAdriftPassenger,

    // --- Standard, Reusable Effect Handlers ---
    
    // 1. CREDITS
    [EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS]: (gameState, simulationService, effect) => {
        const oldValue = gameState.player.credits;
        // FIX: Enforce Integer
        const change = Math.round(effect.value); 
        gameState.player.credits = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, gameState.player.credits + change));
        
        const diff = gameState.player.credits - oldValue;
        if (diff !== 0) {
            simulationService._logTransaction('event', diff, 'Event outcome');
        }
    },

    // 2. FUEL
    [EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        // FIX: Enforce Integer
        const change = Math.round(effect.value);
        shipState.fuel = Math.max(0, Math.min(ship.maxFuel, shipState.fuel + change));
    },

    // 3. HULL
    [EVENT_CONSTANTS.EFFECTS.MODIFY_HULL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        let change = Math.round(effect.value);

        // --- NEW: Hull Resistance Mitigation ---
        // If damage is occurring (negative change), apply resistance from plating
        if (change < 0) {
            const upgrades = shipState.upgrades || [];
            const resistance = GameAttributes.getHullResistanceModifier(upgrades);
            // resistance is a decimal (e.g., 0.20 for 20% reduction)
            change = Math.round(change * (1 - resistance));
        }
        // --- END CHANGE ---

        shipState.health = Math.max(0, Math.min(ship.maxHealth, shipState.health + change));
    },

    // 4. DEBT
    [EVENT_CONSTANTS.EFFECTS.MODIFY_DEBT]: (gameState, simulationService, effect) => {
        if (gameState.player.debt <= 0 && effect.value > 0) {
            gameState.player.loanStartDate = gameState.day;
            gameState.player.weeklyInterestAmount = 0;
        }
        // FIX: Enforce Integer
        const change = Math.round(effect.value);
        gameState.player.debt = Math.max(0, gameState.player.debt + change);
    },

    // 5. ADD ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.ADD_ITEM]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const inventory = simulationService._getActiveInventory();
        const commodityId = effect.target; 
        const quantity = Math.floor(effect.value); 
        
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        
        // --- NEW: Tier Gating ---
        if (commodity && commodity.tier > gameState.player.revealedTier) {
            if (outcome) outcome.text += ` (Recovered ${commodity.name}, but lacked the data-encryption keys to secure it. Cargo abandoned.)`;
            return;
        }
        // --- END CHANGE ---
        
        if (calculateInventoryUsed(inventory) + quantity <= ship.cargoCapacity) {
            if (!inventory[commodityId]) {
                inventory[commodityId] = { quantity: 0, avgCost: 0 };
            }
            inventory[commodityId].quantity += quantity;

            // [[UPDATED]]: Return details for UI instead of appending to text
            if (commodity) {
                return { addedItem: commodity.name, addedQty: quantity };
            }

        } else {
            if (outcome && commodity) {
                outcome.text += ` (Cargo hold full! Abandoned ${quantity}x ${commodity.name}.)`;
            }
        }
    },

    // 6. REMOVE ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM]: (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const commodityId = effect.target;
        const quantity = Math.ceil(effect.value); // FIX: Ceiling removals to be safe

        if (inventory[commodityId]) {
            inventory[commodityId].quantity = Math.max(0, inventory[commodityId].quantity - quantity);
        }
    },

    // 7. TRAVEL TIME (Modify)
    [EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL]: (gameState, simulationService, effect) => {
        if (gameState.pendingTravel) {
            // FIX: Enforce Integer for days
            const change = Math.round(effect.value);
            gameState.pendingTravel.travelTimeAdd = (gameState.pendingTravel.travelTimeAdd || 0) + change;

            // --- PHASE 3: FUEL-COUPLED TIME DELAYS ---
            // If the event adds time (delays), calculate the proportional fuel cost and deduct it.
            if (change > 0) {
                const fromId = gameState.currentLocationId;
                const toId = gameState.pendingTravel.destinationId;
                const travelData = gameState.TRAVEL_DATA[fromId]?.[toId];

                if (travelData && travelData.time > 0) {
                    const ship = simulationService._getActiveShip();
                    const shipState = gameState.player.shipStates[ship.id];
                    const upgrades = shipState.upgrades || [];
                    const shipAttributes = GameAttributes.getShipAttributes(ship.id);

                    // Calculate base daily fuel rate for the original route
                    const dailyFuelRate = travelData.fuelCost / travelData.time;
                    let extraFuelCost = dailyFuelRate * change;

                    // Apply Player Build Modifiers
                    if (gameState.player.activePerks && gameState.player.activePerks[PERK_IDS.NAVIGATOR]) {
                        extraFuelCost *= DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod;
                    }

                    extraFuelCost *= GameAttributes.getFuelBurnModifier(upgrades);

                    // Apply Z-Class / Alien Mechanics
                    if (shipAttributes.includes('ATTR_METABOLIC_BURN')) extraFuelCost *= 0.5;
                    if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) extraFuelCost = 0;
                    if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
                        const fromDist = DB.MARKETS.find(m => m.id === fromId)?.distance || 0;
                        const toDist = DB.MARKETS.find(m => m.id === toId)?.distance || 0;
                        if (toDist < fromDist) extraFuelCost = 0;
                    }

                    extraFuelCost = Math.round(extraFuelCost);

                    if (extraFuelCost > 0) {
                        shipState.fuel = Math.max(0, shipState.fuel - extraFuelCost);
                    }
                }
            }
            // --- END PHASE 3 ---
        }
    },

    // 8. UNLOCK INTEL
    [EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL]: (gameState, simulationService, effect) => {
        const randomLoc = DB.MARKETS[Math.floor(Math.random() * DB.MARKETS.length)];
        // Logic handled by IntelService later, currently just visual/placeholder
    },

    // 9. LOSE RANDOM CARGO (Percentage)
    [EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO]: (gameState, simulationService, effect) => {
        const inventory = simulationService._getActiveInventory();
        const heldCommodities = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
        
        if (heldCommodities.length > 0) {
            const [id, item] = heldCommodities[Math.floor(Math.random() * heldCommodities.length)];
            const quantityToLose = Math.ceil(item.quantity * effect.value);
            item.quantity = Math.max(0, item.quantity - quantityToLose);
            
            const commodity = DB.COMMODITIES.find(c => c.id === id);
            if (commodity) {
                return { lostItem: commodity.name, lostQty: quantityToLose };
            }
        }
    },

    // 10. ADD RANDOM CARGO (Quantity)
    [EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const inventory = simulationService._getActiveInventory();
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        
        if (space <= 0) {
             if (outcome) outcome.text += ` (Cargo hold full! Could not salvage goods.)`;
             return;
        }

        // --- NEW: Tier Gating ---
        const validCommodities = DB.COMMODITIES.filter(c => 
            c.id !== 'fuel_rod' && 
            c.tier <= gameState.player.revealedTier
        ); 
        // --- END CHANGE ---

        if (validCommodities.length === 0) return;

        const randomCom = validCommodities[Math.floor(Math.random() * validCommodities.length)];
        const amountToAdd = Math.min(Math.floor(effect.value), space);
        
        if (amountToAdd > 0) {
            if (!inventory[randomCom.id]) inventory[randomCom.id] = { quantity: 0, avgCost: 0 };
            inventory[randomCom.id].quantity += amountToAdd;
            
            // [[UPDATED]]: Return details for UI instead of appending to text
            return { addedItem: randomCom.name, addedQty: amountToAdd };
        }
    },

    // 11. ADD UPGRADE (Grant Specific Upgrade)
    [EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        const upgradeId = effect.target;

        shipState.upgrades = shipState.upgrades || [];

        if (!shipState.upgrades.includes(upgradeId)) {
            shipState.upgrades.push(upgradeId);
            
            // [[UPDATED]]: Removed text appending. Now returns the name for the UI.
            const def = GameAttributes.getDefinition(upgradeId);
            const name = def ? def.name : upgradeId;

            gameState.uiState.hangarShipyardToggleState = 'hangar';
            
            if (simulationService.setScreen) {
                simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
            }
            
            return { installedUpgrade: name };

        } else {
            if (outcome) {
                 const def = GameAttributes.getDefinition(upgradeId);
                 const name = def ? def.name : upgradeId;
                 outcome.text += ` (Already owned ${name}. Used for spare parts.)`;
            }
        }
    },

    // 12. FULL REFUEL (Fuel Voucher)
    [EVENT_CONSTANTS.EFFECTS.FULL_REFUEL]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        shipState.fuel = ship.maxFuel;

        if (outcome) {
            outcome.text += ` (Fuel tanks topped off!)`;
        }
    }
};

/**
 * Acts as a router, calling the appropriate handler function for a given event effect type.
 */
export function applyEffect(gameState, simulationService, effect, outcome) {
    const handler = effectHandlers[effect.type];
    if (handler) {
        return handler(gameState, simulationService, effect, outcome);
    } else {
        console.warn(`No handler found for event effect type: ${effect.type}`, effect);
    }
}