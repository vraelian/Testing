// js/services/eventEffectResolver.js
/**
 * @fileoverview This file acts as a resolver for all random event outcomes. It maps effect types
 * to their corresponding handler functions, providing a centralized and extensible way to
 * apply the consequences of player choices during events.
 * UPDATED: Added Math.round() to enforce integer values and preventing float drift.
 * UPDATED: Fleet Overflow logic applied to all cargo rewards and penalties.
 */
import { resolveSpaceRace } from './event-effects/effectSpaceRace.js';
import { resolveAdriftPassenger } from './event-effects/effectAdriftPassenger.js';
import { calculateInventoryUsed } from '../utils.js';
import { DB } from '../data/database.js';
import { COMMODITY_IDS, EVENT_CONSTANTS, NAV_IDS, SCREEN_IDS, PERK_IDS, ORBITAL_ORDER } from '../data/constants.js';
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
        const change = Math.round(effect.value);
        shipState.fuel = Math.max(0, Math.min(ship.maxFuel, shipState.fuel + change));

        // --- FLEET OVERFLOW SYSTEM: CONVOY TAX (EVENT FUEL) ---
        if (change < 0) {
            const convoyFuelTax = Math.abs(change) * 0.05;
            if (convoyFuelTax > 0) {
                for (const shipId of gameState.player.ownedShipIds) {
                    if (shipId === ship.id) continue;
                    const inactiveState = gameState.player.shipStates[shipId];
                    if (inactiveState && inactiveState.fuel > 25) {
                        inactiveState.fuel = Math.max(25, inactiveState.fuel - convoyFuelTax);
                    }
                }
            }
        }
        // --- END CONVOY TAX ---
    },

    // 3. HULL
    [EVENT_CONSTANTS.EFFECTS.MODIFY_HULL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        let change = Math.round(effect.value);

        if (change < 0) {
            const upgrades = shipState.upgrades || [];
            const resistance = GameAttributes.getHullResistanceModifier(upgrades);
            change = Math.round(change * (1 - resistance));

            // --- FLEET OVERFLOW SYSTEM: CONVOY TAX (EVENT HULL) ---
            const convoyHullTax = Math.abs(change) * 0.05;
            if (convoyHullTax > 0) {
                for (const shipId of gameState.player.ownedShipIds) {
                    if (shipId === ship.id) continue;
                    const inactiveState = gameState.player.shipStates[shipId];
                    if (inactiveState && inactiveState.health > 10) {
                        inactiveState.health = Math.max(10, inactiveState.health - convoyHullTax);
                    }
                }
            }
            // --- END CONVOY TAX ---
        }

        shipState.health = Math.max(0, Math.min(ship.maxHealth, shipState.health + change));
    },

    // 4. DEBT
    [EVENT_CONSTANTS.EFFECTS.MODIFY_DEBT]: (gameState, simulationService, effect) => {
        if (gameState.player.debt <= 0 && effect.value > 0) {
            gameState.player.loanStartDate = gameState.day;
            gameState.player.weeklyInterestAmount = 0;
        }
        const change = Math.round(effect.value);
        gameState.player.debt = Math.max(0, gameState.player.debt + change);
    },

    // 5. ADD ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.ADD_ITEM]: (gameState, simulationService, effect, outcome) => {
        const commodityId = effect.target; 
        const quantity = Math.floor(effect.value); 
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        
        if (commodity && commodity.tier > gameState.player.revealedTier) {
            if (outcome) outcome.text += ` (Recovered ${commodity.name}, but lacked the data-encryption keys to secure it. Cargo abandoned.)`;
            return;
        }
        
        // --- FLEET OVERFLOW SYSTEM: AGGREGATE CAPACITY CHECK ---
        let totalAvailableSpace = 0;
        const shipCapacities = [];
        const activeShipId = gameState.player.activeShipId;

        gameState.player.ownedShipIds.forEach(shipId => {
            const stats = simulationService.getEffectiveShipStats(shipId);
            const used = calculateInventoryUsed(gameState.player.inventories[shipId]);
            const space = Math.max(0, stats.cargoCapacity - used);
            totalAvailableSpace += space;
            shipCapacities.push({ shipId, maxCapacity: stats.cargoCapacity, available: space });
        });

        if (quantity <= totalAvailableSpace) {
            // Sort: Active ship first, then descending by max capacity
            shipCapacities.sort((a, b) => {
                if (a.shipId === activeShipId) return -1;
                if (b.shipId === activeShipId) return 1;
                return b.maxCapacity - a.maxCapacity;
            });

            let remainingToAdd = quantity;
            for (const shipData of shipCapacities) {
                if (remainingToAdd <= 0) break;
                const toAdd = Math.min(remainingToAdd, shipData.available);
                if (toAdd > 0) {
                    const invItem = gameState.player.inventories[shipData.shipId][commodityId];
                    if (!invItem) gameState.player.inventories[shipData.shipId][commodityId] = { quantity: 0, avgCost: 0 };
                    
                    const actualItem = gameState.player.inventories[shipData.shipId][commodityId];
                    // Found salvage is free, so we blend a cost of 0 into the average
                    actualItem.avgCost = (actualItem.quantity * actualItem.avgCost) / (actualItem.quantity + toAdd);
                    actualItem.quantity += toAdd;
                    remainingToAdd -= toAdd;
                }
            }

            if (commodity) {
                return { addedItem: commodity.name, addedQty: quantity };
            }

        } else {
            if (outcome && commodity) {
                outcome.text += ` (Fleet holds full! Abandoned ${quantity}x ${commodity.name}.)`;
            }
        }
        // --- END FLEET OVERFLOW SYSTEM ---
    },

    // 6. REMOVE ITEM (Specific)
    [EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM]: (gameState, simulationService, effect) => {
        const commodityId = effect.target;
        const quantityToLose = Math.ceil(effect.value); 

        // --- FLEET OVERFLOW SYSTEM: SEQUENTIAL DRAIN ---
        const activeShipId = gameState.player.activeShipId;
        const shipInventories = gameState.player.ownedShipIds.map(shipId => {
            const qty = gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0;
            const maxCapacity = simulationService.getEffectiveShipStats(shipId).cargoCapacity;
            return { shipId, qty, maxCapacity };
        });

        shipInventories.sort((a, b) => {
            if (a.shipId === activeShipId) return -1;
            if (b.shipId === activeShipId) return 1;
            return b.maxCapacity - a.maxCapacity;
        });

        let remainingToRemove = quantityToLose;
        for (const shipData of shipInventories) {
            if (remainingToRemove <= 0) break;
            const toRemove = Math.min(remainingToRemove, shipData.qty);
            if (toRemove > 0) {
                const invItem = gameState.player.inventories[shipData.shipId][commodityId];
                invItem.quantity -= toRemove;
                if (invItem.quantity === 0) invItem.avgCost = 0;
                remainingToRemove -= toRemove;
            }
        }
        // --- END FLEET OVERFLOW SYSTEM ---
    },

    // 7. TRAVEL TIME (Modify)
    [EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL]: (gameState, simulationService, effect) => {
        if (gameState.pendingTravel) {
            const change = Math.round(effect.value);
            gameState.pendingTravel.travelTimeAdd = (gameState.pendingTravel.travelTimeAdd || 0) + change;

            if (change > 0) {
                const fromId = gameState.currentLocationId;
                const toId = gameState.pendingTravel.destinationId;
                const travelData = gameState.TRAVEL_DATA[fromId]?.[toId];

                if (travelData && travelData.time > 0) {
                    const ship = simulationService._getActiveShip();
                    const shipState = gameState.player.shipStates[ship.id];
                    const upgrades = shipState.upgrades || [];
                    const shipAttributes = GameAttributes.getShipAttributes(ship.id);

                    const dailyFuelRate = travelData.fuelCost / travelData.time;
                    let extraFuelCost = dailyFuelRate * change;

                    if (gameState.player.activePerks && gameState.player.activePerks[PERK_IDS.NAVIGATOR]) {
                        extraFuelCost *= DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod;
                    }

                    extraFuelCost *= GameAttributes.getFuelBurnModifier(upgrades);

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
                        
                        const convoyFuelTax = extraFuelCost * 0.05;
                        if (convoyFuelTax > 0) {
                            for (const shipId of gameState.player.ownedShipIds) {
                                if (shipId === ship.id) continue;
                                const inactiveState = gameState.player.shipStates[shipId];
                                if (inactiveState && inactiveState.fuel > 25) {
                                    inactiveState.fuel = Math.max(25, inactiveState.fuel - convoyFuelTax);
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    // 8. UNLOCK INTEL
    [EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL]: (gameState, simulationService, effect) => {
        const randomLoc = DB.MARKETS[Math.floor(Math.random() * DB.MARKETS.length)];
    },

    // 9. LOSE RANDOM CARGO (Percentage)
    [EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO]: (gameState, simulationService, effect) => {
        // --- FLEET OVERFLOW SYSTEM: AGGREGATE FLEET COMMODITIES ---
        const fleetInventory = {};
        for (const shipId of gameState.player.ownedShipIds) {
            const inv = gameState.player.inventories[shipId];
            if (!inv) continue;
            for (const [id, item] of Object.entries(inv)) {
                if (item.quantity > 0) {
                    fleetInventory[id] = (fleetInventory[id] || 0) + item.quantity;
                }
            }
        }

        const heldCommodityIds = Object.keys(fleetInventory);
        
        if (heldCommodityIds.length > 0) {
            const targetId = heldCommodityIds[Math.floor(Math.random() * heldCommodityIds.length)];
            const totalQty = fleetInventory[targetId];
            const quantityToLose = Math.ceil(totalQty * effect.value);
            
            // Sequential Fleet Drain
            const activeShipId = gameState.player.activeShipId;
            const shipInventories = gameState.player.ownedShipIds.map(shipId => {
                const qty = gameState.player.inventories[shipId]?.[targetId]?.quantity || 0;
                const maxCapacity = simulationService.getEffectiveShipStats(shipId).cargoCapacity;
                return { shipId, qty, maxCapacity };
            }).sort((a, b) => {
                if (a.shipId === activeShipId) return -1;
                if (b.shipId === activeShipId) return 1;
                return b.maxCapacity - a.maxCapacity;
            });

            let remainingToRemove = quantityToLose;
            for (const shipData of shipInventories) {
                if (remainingToRemove <= 0) break;
                const toRemove = Math.min(remainingToRemove, shipData.qty);
                if (toRemove > 0) {
                    const invItem = gameState.player.inventories[shipData.shipId][targetId];
                    invItem.quantity -= toRemove;
                    if (invItem.quantity === 0) invItem.avgCost = 0;
                    remainingToRemove -= toRemove;
                }
            }
            
            const commodity = DB.COMMODITIES.find(c => c.id === targetId);
            if (commodity) {
                return { lostItem: commodity.name, lostQty: quantityToLose };
            }
        }
        // --- END FLEET OVERFLOW SYSTEM ---
    },

    // 10. ADD RANDOM CARGO (Quantity)
    [EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO]: (gameState, simulationService, effect, outcome) => {
        // --- FLEET OVERFLOW SYSTEM: AGGREGATE CAPACITY ---
        let totalAvailableSpace = 0;
        const activeShipId = gameState.player.activeShipId;
        const shipCapacities = [];

        gameState.player.ownedShipIds.forEach(shipId => {
            const stats = simulationService.getEffectiveShipStats(shipId);
            const used = calculateInventoryUsed(gameState.player.inventories[shipId]);
            const space = Math.max(0, stats.cargoCapacity - used);
            totalAvailableSpace += space;
            shipCapacities.push({ shipId, maxCapacity: stats.cargoCapacity, available: space });
        });
        
        if (totalAvailableSpace <= 0) {
             if (outcome) outcome.text += ` (Fleet holds full! Could not salvage goods.)`;
             return;
        }

        const validCommodities = DB.COMMODITIES.filter(c => 
            c.id !== 'fuel_rod' && 
            c.tier <= gameState.player.revealedTier
        ); 

        if (validCommodities.length === 0) return;

        const randomCom = validCommodities[Math.floor(Math.random() * validCommodities.length)];
        const amountToAdd = Math.min(Math.floor(effect.value), totalAvailableSpace);
        
        if (amountToAdd > 0) {
            // Sort: Active ship first, then descending by max capacity
            shipCapacities.sort((a, b) => {
                if (a.shipId === activeShipId) return -1;
                if (b.shipId === activeShipId) return 1;
                return b.maxCapacity - a.maxCapacity;
            });

            let remainingToAdd = amountToAdd;
            for (const shipData of shipCapacities) {
                if (remainingToAdd <= 0) break;
                const toAdd = Math.min(remainingToAdd, shipData.available);
                if (toAdd > 0) {
                    const currentItem = gameState.player.inventories[shipData.shipId][randomCom.id];
                    if (!currentItem) gameState.player.inventories[shipData.shipId][randomCom.id] = { quantity: 0, avgCost: 0 };
                    
                    const actualItem = gameState.player.inventories[shipData.shipId][randomCom.id];
                    actualItem.avgCost = (actualItem.quantity * actualItem.avgCost) / (actualItem.quantity + toAdd);
                    actualItem.quantity += toAdd;
                    remainingToAdd -= toAdd;
                }
            }
            
            return { addedItem: randomCom.name, addedQty: amountToAdd };
        }
        // --- END FLEET OVERFLOW SYSTEM ---
    },

    // 11. ADD UPGRADE (Grant Specific Upgrade)
    [EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE]: (gameState, simulationService, effect, outcome) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        const upgradeId = effect.target;

        shipState.upgrades = shipState.upgrades || [];

        if (!shipState.upgrades.includes(upgradeId)) {
            shipState.upgrades.push(upgradeId);
            
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
    },

    // 13. REDIRECT TRAVEL (Blockade)
    [EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL]: (gameState, simulationService, effect, outcome) => {
        if (!gameState.pendingTravel) return;

        const originId = gameState.currentLocationId;
        const destId = gameState.pendingTravel.destinationId;

        if (originId === destId) return;

        const originIndex = ORBITAL_ORDER.indexOf(originId);
        const destIndex = ORBITAL_ORDER.indexOf(destId);

        if (originIndex === -1 || destIndex === -1 || Math.abs(destIndex - originIndex) <= 1) {
            gameState.pendingTravel.destinationId = originId;
            if (outcome) outcome.text += ` <br><br><span class="text-yellow-400">Course forcefully diverted back to origin.</span>`;
            return;
        }

        const direction = destIndex > originIndex ? 1 : -1;
        const intermediateIndex = destIndex - direction;
        const newDestId = ORBITAL_ORDER[intermediateIndex];

        gameState.pendingTravel.destinationId = newDestId;
        const newDestName = DB.MARKETS.find(m => m.id === newDestId)?.name || "a nearby station";

        if (outcome) {
            outcome.text += ` <br><br><span class="text-yellow-400">Course forcefully diverted to ${newDestName}.</span>`;
        }
    }
};

export function applyEffect(gameState, simulationService, effect, outcome) {
    const handler = effectHandlers[effect.type];
    if (handler) {
        return handler(gameState, simulationService, effect, outcome);
    } else {
        console.warn(`No handler found for event effect type: ${effect.type}`, effect);
    }
}