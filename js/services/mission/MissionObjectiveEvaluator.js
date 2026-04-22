// js/services/mission/MissionObjectiveEvaluator.js
/**
 * @fileoverview Stateless logic engine for evaluating mission objectives.
 * Determines the current progress and completion status of a given objective against the GameState.
 */
import { DB } from '../../data/database.js';

export class MissionObjectiveEvaluator {
    /**
     * Evaluates a single objective against the current game state.
     * @param {object} objective - The objective schema object.
     * @param {import('../GameState.js').GameState} gameState - The current state of the game.
     * @param {import('../SimulationService.js').SimulationService} [simulationService] - Optional access to derived stats.
     * @param {object} [objProgress={}] - The existing progress object of the objective (contains current, target, deposited).
     * @param {object} [missionProgress={}] - The existing progress object for the entire mission.
     * @returns {object} { current: number, target: number, isMet: boolean }
     */
    evaluate(objective, gameState, simulationService, objProgress = {}, missionProgress = {}) {
        let current = 0;
        
        const currentProgress = objProgress.current || 0;
        const deposited = objProgress.deposited || 0;
        
        // Allow 0 as a valid target (e.g. Empty Hold = 0 items)
        let val = objective.quantity !== undefined ? objective.quantity : objective.value;
        let target = val !== undefined ? val : 1; 

        let isMet = false;
        
        let comparator = objective.comparator || '>='; 

        // Helper to get ship stats (Effective > Base)
        const getShipStats = (shipId) => {
            if (simulationService) {
                return simulationService.getEffectiveShipStats(shipId);
            }
            return DB.SHIPS[shipId];
        };

        switch (objective.type) {
            // --- RESOURCE / INVENTORY CHECKS ---
            case 'have_item':
            case 'DELIVER_ITEM':
            case 'HAVE_ITEM': {
                const itemId = objective.goodId || objective.target;
                let totalQty = 0;
                // --- FLEET OVERFLOW SYSTEM: Aggregate across entire fleet ---
                for (const shipId of gameState.player.ownedShipIds) {
                    const inventory = gameState.player.inventories[shipId];
                    if (inventory && inventory[itemId]) {
                        totalQty += (inventory[itemId].quantity || 0);
                    }
                }
                current = totalQty + deposited;
                break;
            }

            case 'have_credits':
            case 'HAVE_CREDITS':
            case 'WEALTH_CHECK':
                current = gameState.player.credits;
                break;
                
            case 'have_debt':
            case 'HAVE_DEBT':
                current = gameState.player.debt;
                // Force comparator to <= if we are targeting 0 debt and none is provided
                if (target === 0 && !objective.comparator) {
                    comparator = '<=';
                }
                break;

            // --- UI / NAVIGATION CHECKS ---
            case 'visit_screen':
            case 'VISIT_SCREEN': {
                const reqNav = objective.navId;
                const reqScreen = objective.screenId;
                const isCorrectNav = !reqNav || gameState.activeNav === reqNav;
                const isCorrectScreen = !reqScreen || gameState.activeScreen === reqScreen;
                
                const isVisiting = (isCorrectNav && isCorrectScreen) ? 1 : 0;
                
                // Latch progress: Once the screen is visited, it stays met even if they navigate away
                current = Math.max(currentProgress, isVisiting);
                target = 1;
                break;
            }

            // --- ACTION / TRADE CHECKS ---
            case 'trade_item':
            case 'TRADE_ITEM': {
                const itemId = objective.goodId || objective.target;
                const tradeType = objective.tradeType; 
                const targetLoc = objective.target; 
                let tradeCount = 0;
                
                const log = gameState.player.financeLog || [];
                const commodity = DB.COMMODITIES ? DB.COMMODITIES.find(c => c.id === itemId) : null;
                const searchName = commodity ? commodity.name : itemId;
                
                const acceptDay = missionProgress.acceptDay || 0;
                
                log.forEach(entry => {
                    // Only count trades that occurred AFTER the mission was accepted
                    if (entry.day >= acceptDay) {
                        // Enforce location matching if the objective specifically requires it
                        if (targetLoc && entry.locationId && entry.locationId !== targetLoc) return;
                        
                        if (entry.type === 'trade' && entry.description.includes(searchName)) {
                            const isBuy = entry.description.startsWith('Bought');
                            const isSell = entry.description.startsWith('Sold');
                            
                            const matchesType = !tradeType || 
                                                (tradeType.toLowerCase() === 'buy' && isBuy) || 
                                                (tradeType.toLowerCase() === 'sell' && isSell);
                            
                            if (matchesType) {
                                const match = entry.description.match(/\s(\d+)x\s/);
                                if (match) {
                                    tradeCount += parseInt(match[1], 10);
                                } else {
                                    tradeCount += 1;
                                }
                            }
                        }
                    }
                });
                
                // Latch progress to prevent transaction history culling from un-meeting the objective
                current = Math.max(currentProgress, tradeCount);
                break;
            }

            // --- SHIP STATE CHECKS ---
            case 'have_fuel_tank':
            case 'HAVE_FUEL_TANK': {
                const activeShipId = gameState.player.activeShipId;
                const fShipState = gameState.player.shipStates[activeShipId];
                const fShipDef = getShipStats(activeShipId);
                if (fShipState && fShipDef) {
                    current = Math.floor(fShipState.fuel); 
                    target = Math.floor(fShipDef.maxFuel);
                }
                break;
            }

            case 'have_hull_pct':
            case 'HAVE_HULL_PCT': {
                const activeShipId = gameState.player.activeShipId;
                const hShipState = gameState.player.shipStates[activeShipId];
                const hShipDef = getShipStats(activeShipId);
                
                if (hShipState && hShipDef && hShipDef.maxHealth > 0) {
                    current = Math.floor(hShipState.health);
                    // The objective value defines the target percentage (e.g. 100 means 100%)
                    target = Math.floor((val / 100) * hShipDef.maxHealth);
                } else {
                    current = 0;
                }
                break;
            }

            // --- FLEET OVERFLOW SYSTEM: Aggregate Fleet Cargo Percentage ---
            case 'have_cargo_pct':
            case 'HAVE_CARGO_PCT': {
                let fleetTotalUsed = 0;
                let fleetTotalCapacity = 0;

                for (const shipId of gameState.player.ownedShipIds) {
                    const cShipDef = getShipStats(shipId); 
                    const cInventory = gameState.player.inventories[shipId];
                    
                    if (cShipDef && cInventory && cShipDef.cargoCapacity > 0) {
                        fleetTotalCapacity += cShipDef.cargoCapacity;
                        fleetTotalUsed += Object.values(cInventory).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    }
                }

                if (fleetTotalCapacity > 0) {
                    current = Math.floor((fleetTotalUsed / fleetTotalCapacity) * 100);
                } else {
                    current = 0;
                }
                break;
            }

            // --- WORLD STATE CHECKS ---
            case 'travel_to':
            case 'TRAVEL_TO':
                const targetLoc = objective.target;
                const atLocation = gameState.currentLocationId === targetLoc;
                current = atLocation ? 1 : 0;
                break;

            // --- PLAYER STATE CHECKS ---
            case 'have_ship':
            case 'OWN_SHIP':
                const requiredShipId = objective.target;
                const ownsShip = gameState.player.ownedShipIds.includes(requiredShipId);
                current = ownsShip ? 1 : 0;
                break;
            
            case 'mission_complete':
            case 'MISSION_COMPLETE':
                const reqMissionId = objective.target;
                const hasCompleted = gameState.missions.completedMissionIds.includes(reqMissionId);
                current = hasCompleted ? 1 : 0;
                break;

            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown objective type: ${objective.type}`);
                break;
        }

        // --- EVALUATION LOGIC ---
        if (typeof current !== 'number' || isNaN(current)) {
            current = 0;
        }

        switch (comparator) {
            case '>=':
                if (current >= target) {
                    current = target; 
                    isMet = true;
                }
                break;
            case '<=':
                if (current <= target) {
                    isMet = true;
                }
                break;
            case '==':
                if (current === target) {
                    isMet = true;
                }
                break;
            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown comparator: ${comparator}`);
                if (current >= target) isMet = true;
        }

        return { current, target, isMet };
    }
}