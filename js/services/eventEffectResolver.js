// js/services/eventEffectResolver.js
/**
 * @fileoverview This file acts as a resolver for all random event outcomes.
 * UPDATED: "Actual Change" Paradigm. The resolver calculates the exact integer
 * modification and attaches it to the effect payload (`actualChange`), preventing
 * the UI from interpreting logic or making math errors.
 */
import { resolveSpaceRace } from './event-effects/effectSpaceRace.js';
import { resolveAdriftPassenger } from './event-effects/effectAdriftPassenger.js';
import { calculateInventoryUsed } from '../utils.js';
import { DB } from '../data/database.js';
import { OFFICERS } from '../data/officers.js';
import { EVENT_CONSTANTS, ORBITAL_ORDER, STATUS_EFFECTS } from '../data/constants.js';
import { GameAttributes } from './GameAttributes.js';

const effectHandlers = {
    'SPACE_RACE': resolveSpaceRace,
    'ADRIFT_PASSENGER': resolveAdriftPassenger,

    'GRANT_OFFICER': (gameState, simulationService, effect, outcome) => {
        const officerId = effect.target;
        gameState.player.officerRoster = gameState.player.officerRoster || [];
        const officerName = OFFICERS[officerId] ? OFFICERS[officerId].name : officerId;

        if (!gameState.player.officerRoster.includes(officerId)) {
            gameState.player.officerRoster.push(officerId);
            effect.installedOfficer = officerName;
        } else {
            effect.failedOfficer = true;
            effect.officerName = officerName;
        }
    },

    [EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS]: (gameState, simulationService, effect) => {
        let change = effect.value;
        if (effect.isCurrentPercent) {
            change = gameState.player.credits * (effect.value / 100);
        }
        
        change = Math.round(change); 
        effect.actualChange = change;

        const oldValue = gameState.player.credits;
        gameState.player.credits = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, gameState.player.credits + change));
        
        const diff = gameState.player.credits - oldValue;
        if (diff !== 0) {
            simulationService._logTransaction('event', diff, 'Event outcome');
        }
    },

    [EVENT_CONSTANTS.EFFECTS.MODIFY_FUEL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        
        let change = effect.value;
        if (effect.isCurrentPercent) {
            change = shipState.fuel * (effect.value / 100);
        }
        
        change = Math.round(change);
        effect.actualChange = change;

        shipState.fuel = Math.max(0, Math.min(ship.maxFuel, shipState.fuel + change));

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
    },

    [EVENT_CONSTANTS.EFFECTS.MODIFY_HULL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        
        let change = effect.value;
        if (effect.isCurrentPercent) {
            change = shipState.health * (effect.value / 100);
        }
        
        change = Math.round(change);

        if (change < 0) {
            const upgrades = shipState.upgrades || [];
            const resistance = GameAttributes.getHullResistanceModifier(upgrades);
            change = Math.round(change * (1 - resistance));

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
        }

        effect.actualChange = change;
        shipState.health = Math.max(0, Math.min(ship.maxHealth, shipState.health + change));
    },

    [EVENT_CONSTANTS.EFFECTS.MODIFY_DEBT]: (gameState, simulationService, effect) => {
        if (gameState.player.debt <= 0 && effect.value > 0) {
            gameState.player.loanStartDate = gameState.day;
            gameState.player.weeklyInterestAmount = 0;
        }
        
        let change = effect.value;
        if (effect.isCurrentPercent) {
             change = gameState.player.debt * (effect.value / 100);
        }
        
        change = Math.round(change);
        effect.actualChange = change;
        gameState.player.debt = Math.max(0, gameState.player.debt + change);
    },

    [EVENT_CONSTANTS.EFFECTS.ADD_ITEM]: (gameState, simulationService, effect) => {
        const commodityId = effect.target; 
        const quantity = Math.floor(effect.value); 
        const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
        
        if (commodity && commodity.tier > gameState.player.revealedTier) {
            effect.failedTier = true;
            effect.requiredTier = commodity.tier;
            return;
        }
        
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
                    actualItem.avgCost = (actualItem.quantity * actualItem.avgCost) / (actualItem.quantity + toAdd);
                    actualItem.quantity += toAdd;
                    remainingToAdd -= toAdd;
                }
            }

            effect.addedItem = commodity ? commodity.name : commodityId;
            effect.addedQty = quantity;
        } else {
            effect.failedCapacity = true;
            effect.addedItem = commodity ? commodity.name : commodityId;
            effect.addedQty = quantity;
        }
    },

    [EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM]: (gameState, simulationService, effect) => {
        const commodityId = effect.target;
        const quantityToLose = Math.ceil(effect.value); 

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
    },

    [EVENT_CONSTANTS.EFFECTS.MODIFY_TRAVEL]: (gameState, simulationService, effect) => {
        if (gameState.pendingTravel) {
            let change = effect.value;
            
            if (effect.isCurrentPercent) {
                const baseDays = gameState.pendingTravel.days || 1;
                change = baseDays * (effect.value / 100);
            }
            
            change = Math.round(change);
            effect.actualChange = change;
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

    [EVENT_CONSTANTS.EFFECTS.UNLOCK_INTEL]: (gameState, simulationService, effect, outcome) => {
        if (gameState.activeIntelDeal !== null) {
            effect.failedIntel = true;
            
            // DEFENSIVE FIX: Refund items/credits robbed by the event's prior effects
            if (outcome && outcome.effects) {
                outcome.effects.forEach(eff => {
                    if (eff.type === EVENT_CONSTANTS.EFFECTS.REMOVE_ITEM) {
                        const refundId = eff.target;
                        const refundQty = Math.ceil(eff.value);
                        const shipId = gameState.player.activeShipId;
                        if (gameState.player.inventories[shipId] && gameState.player.inventories[shipId][refundId]) {
                            gameState.player.inventories[shipId][refundId].quantity += refundQty;
                        }
                    }
                    if (eff.type === EVENT_CONSTANTS.EFFECTS.MODIFY_CREDITS && eff.value < 0) {
                        gameState.player.credits += Math.abs(Math.round(eff.value));
                    }
                });
            }
            return;
        }

        const revealedTier = gameState.player.revealedTier;
        const unlockedCommodities = DB.COMMODITIES.filter(c => c.tier <= revealedTier).map(c => c.id);

        if (unlockedCommodities.length === 0) return;

        const commodityId = unlockedCommodities[Math.floor(Math.random() * unlockedCommodities.length)];
        
        const playerUnlockedLocations = gameState.player.unlockedLocationIds || [];
        const possibleDealLocations = DB.MARKETS.map(m => m.id).filter(id => playerUnlockedLocations.includes(id));

        if (possibleDealLocations.length === 0) return;
        const dealLocationId = possibleDealLocations[Math.floor(Math.random() * possibleDealLocations.length)];

        const discountPercent = 0.20 + Math.random() * 0.30; 
        
        let travelTime = gameState.TRAVEL_DATA[gameState.currentLocationId]?.[dealLocationId]?.time || 30;

        if (gameState.player.activePerks && gameState.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelTime = Math.round(travelTime * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
        }

        let durationMultiplier = 1.9;
        if (gameState.currentLocationId === LOCATION_IDS.VENUS) {
            durationMultiplier *= 2.0;
        }

        const ageDurationBonus = gameState.player.statModifiers?.intelDuration || 0;
        if (ageDurationBonus > 0) {
            durationMultiplier *= (1 + ageDurationBonus);
        }

        const newDurationDays = Math.ceil(travelTime * durationMultiplier);
        const expiryDay = gameState.day + newDurationDays;

        let galacticAverage = 0;
        if (simulationService.marketService) {
            galacticAverage = simulationService.marketService.getGalacticAverage(commodityId);
        } else {
             const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
             galacticAverage = commodity ? commodity.basePrice : 100;
        }
        
        const overridePrice = Math.floor(galacticAverage * (1 - discountPercent));

        gameState.activeIntelDeal = {
            locationId: dealLocationId,
            commodityId: commodityId,
            overridePrice: overridePrice,
            expiryDay: expiryDay,
            sourcePacketId: `evt_intel_${gameState.day}_${Math.floor(Math.random() * 999)}`,
            sourceSaleLocationId: gameState.currentLocationId
        };

        const commodityName = DB.COMMODITIES.find(c => c.id === commodityId)?.name || 'goods';
        const locationName = DB.MARKETS.find(m => m.id === dealLocationId)?.name || 'a local market';

        effect.intelLocation = locationName;
        effect.intelCommodity = commodityName;
    },

    [EVENT_CONSTANTS.EFFECTS.LOSE_RANDOM_CARGO]: (gameState, simulationService, effect) => {
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
            let totalQty = 0;
            for (const key of heldCommodityIds) {
                totalQty += fleetInventory[key];
            }

            const multiplier = effect.isCurrentPercent ? (effect.value / 100) : effect.value;
            const quantityToLose = Math.floor(totalQty * multiplier);
            
            let lostItemsTracker = {};
            let remainingToRemove = quantityToLose;
            
            while(remainingToRemove > 0) {
                const availableIds = heldCommodityIds.filter(id => fleetInventory[id] > 0);
                if (availableIds.length === 0) break;

                const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
                
                fleetInventory[randomId] -= 1;
                lostItemsTracker[randomId] = (lostItemsTracker[randomId] || 0) + 1;
                remainingToRemove--;
            }

            effect.lostItems = [];

            for (const [commodityId, amount] of Object.entries(lostItemsTracker)) {
                let toRemoveItem = amount;
                
                const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (commodity) {
                    effect.lostItems.push({ name: commodity.name, qty: amount });
                }

                const activeShipId = gameState.player.activeShipId;
                
                const shipInventories = gameState.player.ownedShipIds.map(shipId => {
                    const qty = gameState.player.inventories[shipId]?.[commodityId]?.quantity || 0;
                    const maxCapacity = simulationService.getEffectiveShipStats(shipId).cargoCapacity;
                    return { shipId, qty, maxCapacity };
                }).sort((a, b) => {
                    if (a.shipId === activeShipId) return -1;
                    if (b.shipId === activeShipId) return 1;
                    return b.maxCapacity - a.maxCapacity;
                });
                
                for (const shipData of shipInventories) {
                    if (toRemoveItem <= 0) break;
                    const removing = Math.min(toRemoveItem, shipData.qty);
                    if (removing > 0) {
                        const invItem = gameState.player.inventories[shipData.shipId][commodityId];
                        invItem.quantity -= removing;
                        if (invItem.quantity === 0) invItem.avgCost = 0;
                        toRemoveItem -= removing;
                    }
                }
            }
            
            const totalLost = quantityToLose - remainingToRemove;
            effect.actualChange = totalLost; 
        }
    },

    [EVENT_CONSTANTS.EFFECTS.ADD_RANDOM_CARGO]: (gameState, simulationService, effect) => {
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
             effect.failedCapacity = true;
             return;
        }

        const validCommodities = DB.COMMODITIES.filter(c => 
            c.id !== 'fuel_rod' && 
            c.tier <= gameState.player.revealedTier
        ); 

        if (validCommodities.length === 0) {
            effect.failedTier = true;
            return;
        }

        const randomCom = validCommodities[Math.floor(Math.random() * validCommodities.length)];
        let amountToAdd = effect.value;
        
        if (effect.isCurrentPercent) {
             const randomPercent = Math.max(0.01, Math.random() * (effect.value / 100));
             amountToAdd = totalAvailableSpace * randomPercent;
        }
        
        amountToAdd = Math.min(Math.floor(amountToAdd), totalAvailableSpace);
        
        if (amountToAdd > 0) {
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
            
            effect.addedQty = amountToAdd;
            effect.targetName = randomCom.name;
        }
    },

    [EVENT_CONSTANTS.EFFECTS.ADD_UPGRADE]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        const upgradeId = effect.target;

        shipState.upgrades = shipState.upgrades || [];
        const def = GameAttributes.getDefinition(upgradeId);
        const name = def ? def.name : upgradeId;

        if (shipState.upgrades.length >= 3 && !shipState.upgrades.includes(upgradeId)) {
            effect.pendingOverwrite = upgradeId;
        } else if (!shipState.upgrades.includes(upgradeId)) {
            shipState.upgrades.push(upgradeId);
            effect.installedUpgrade = name;
        } else {
            effect.failedUpgrade = true;
            effect.targetName = name;
        }
    },

    [EVENT_CONSTANTS.EFFECTS.FULL_REFUEL]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        shipState.fuel = ship.maxFuel;
        effect.refueled = true;
    },

    [EVENT_CONSTANTS.EFFECTS.REDIRECT_TRAVEL]: (gameState, simulationService, effect) => {
        if (!gameState.pendingTravel) return;

        const originId = gameState.currentLocationId;
        const destId = gameState.pendingTravel.destinationId;

        if (originId === destId) return;

        const originIndex = ORBITAL_ORDER.indexOf(originId);
        const destIndex = ORBITAL_ORDER.indexOf(destId);

        if (originIndex === -1 || destIndex === -1 || Math.abs(destIndex - originIndex) <= 1) {
            gameState.pendingTravel.destinationId = originId;
            return;
        }

        const direction = destIndex > originIndex ? 1 : -1;
        const intermediateIndex = destIndex - direction;
        const newDestId = ORBITAL_ORDER[intermediateIndex];

        gameState.pendingTravel.destinationId = newDestId;
    },

    [EVENT_CONSTANTS.EFFECTS.APPLY_STATUS]: (gameState, simulationService, effect) => {
        const ship = simulationService._getActiveShip();
        const shipState = gameState.player.shipStates[ship.id];
        shipState.statusEffects = shipState.statusEffects || [];

        const statusId = effect.target;
        const duration = Math.floor(Math.random() * (480 - 120 + 1)) + 120;
        const expiryDay = gameState.day + duration;

        const existing = shipState.statusEffects.find(s => s.id === statusId);
        if (existing) {
            existing.expiryDay = expiryDay;
        } else {
            shipState.statusEffects.push({ id: statusId, expiryDay });
        }

        const def = Object.values(STATUS_EFFECTS).find(s => s.id === statusId);
        effect.statusName = def ? def.name : statusId;
    },

    [EVENT_CONSTANTS.EFFECTS.QUEUE_EVENT]: (gameState, simulationService, effect) => {
        gameState.pendingEventChains = gameState.pendingEventChains || [];
        gameState.pendingEventChains.push({
            followUpEventId: effect.target,
            tripsRemaining: effect.value || 0,
            payload: {} 
        });
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