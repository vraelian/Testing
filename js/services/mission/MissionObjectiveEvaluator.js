// js/services/mission/MissionObjectiveEvaluator.js
/**
 * @fileoverview Stateless logic engine for evaluating mission objectives.
 * Determines the current progress and completion status of a given objective against the GameState.
 */
import { DB } from '../../data/database.js';
import { GameAttributes } from '../GameAttributes.js';

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
        const collected = objProgress.collected || 0;
        const stepIndex = objProgress.stepIndex || 0;
        
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
                
                // [FIX] Latch progress for accumulation objectives (like Procurement)
                if (objective.latch) {
                    current = Math.max(currentProgress, current);
                }
                break;
            }

            case 'deliver_item':
            case 'DELIVER_ITEM': {
                // STRICT DELIVERY TRACKING:
                // Only tracks what the player has explicitly offloaded/deposited at the target location.
                // Decouples fleet inventory from objective completion logic.
                current = deposited;
                break;
            }
            
            case 'collect_item':
            case 'COLLECT_ITEM': {
                // STRICT COLLECTION TRACKING:
                // Only tracks what the player has explicitly picked up from the target location.
                current = collected;
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
                        if (targetLoc && entry.locationId !== targetLoc) return;
                        
                        // [FIX] Case-insensitive matching to prevent log variations from failing validation
                        if (entry.type === 'trade' && entry.description.toLowerCase().includes(searchName.toLowerCase())) {
                            const isBuy = entry.description.toLowerCase().startsWith('bought');
                            const isSell = entry.description.toLowerCase().startsWith('sold');
                            
                            const matchesType = !tradeType || 
                                                (tradeType.toLowerCase() === 'buy' && isBuy) || 
                                                (tradeType.toLowerCase() === 'sell' && isSell);
                            
                            if (matchesType) {
                                // [FIX] Robust Regex to catch "Sold 15x" or "Sold 15"
                                const match = entry.description.match(/(?:bought|sold)\s+(\d+)/i) || entry.description.match(/\s(\d+)x\s/i);
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
            case 'has_ship_class':
            case 'HAS_SHIP_CLASS': {
                const activeShipId = gameState.player.activeShipId;
                const shipDef = getShipStats(activeShipId);
                const requiredClass = objective.target;
                const classRanks = { 'C': 1, 'B': 2, 'A': 3, 'S': 4, 'O': 5, 'Z': 6, 'F': 0 };
                const reqRank = classRanks[requiredClass ? requiredClass.toUpperCase() : 'C'] || 1;
                
                let currentRank = 0;
                if (shipDef && shipDef.class) {
                    currentRank = classRanks[shipDef.class.toUpperCase()] || 0;
                }
                
                current = currentRank;
                target = reqRank;
                comparator = '>=';
                break;
            }

            case 'has_upgrade_rank':
            case 'HAS_UPGRADE_RANK': {
                const activeShipId = gameState.player.activeShipId;
                const shipState = gameState.player.shipStates[activeShipId];
                // Added parsing for objective.rank to map to Mission 34's parameters
                const reqRank = objective.rank || objective.quantity || objective.value || parseInt(objective.target, 10) || 1;
                let highestRank = 0;
                
                if (shipState && shipState.upgrades && Array.isArray(shipState.upgrades)) {
                    for (const upgradeId of shipState.upgrades) {
                        let upgradeDef = (DB.ITEMS && DB.ITEMS[upgradeId]) || (DB.UPGRADES && DB.UPGRADES[upgradeId]);
                        
                        if (!upgradeDef && GameAttributes && typeof GameAttributes.getDefinition === 'function') {
                            upgradeDef = GameAttributes.getDefinition(upgradeId);
                        }

                        if (upgradeDef) {
                            const rank = upgradeDef.rank || upgradeDef.tier || 1;
                            if (rank > highestRank) {
                                highestRank = rank;
                            }
                        }
                    }
                }
                
                current = highestRank;
                target = reqRank;
                comparator = '>=';
                break;
            }

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

            case 'sequential_travel':
            case 'SEQUENTIAL_TRAVEL': {
                const targetArray = objective.targetArray || [];
                let currentStep = stepIndex;

                if (currentStep < targetArray.length) {
                    const expectedLocation = targetArray[currentStep];
                    if (gameState.currentLocationId === expectedLocation) {
                        currentStep++;
                        objProgress.stepIndex = currentStep; // Mutate the reference directly to latch step completion
                    }
                }

                current = currentStep;
                target = targetArray.length;
                comparator = '>=';
                break;
            }

            // --- PLAYER STATE CHECKS ---
            case 'have_ship':
            case 'OWN_SHIP': {
                const requiredShipId = objective.target;
                const ownsShip = gameState.player.ownedShipIds.includes(requiredShipId);
                current = ownsShip ? 1 : 0;
                break;
            }
            
            case 'own_ship_class':
            case 'OWN_SHIP_CLASS': {
                const requiredClass = objective.target;
                const classRanks = { 'C': 1, 'B': 2, 'A': 3, 'S': 4, 'O': 5, 'Z': 6, 'F': 0 };
                const reqRank = classRanks[requiredClass ? requiredClass.toUpperCase() : 'C'] || 1;
                
                let highestRank = 0;
                for (const shipId of gameState.player.ownedShipIds) {
                    const shipDef = getShipStats(shipId);
                    if (shipDef && shipDef.class) {
                        const rank = classRanks[shipDef.class.toUpperCase()] || 0;
                        if (rank > highestRank) highestRank = rank;
                    }
                }
                
                current = highestRank;
                target = reqRank;
                comparator = '>=';
                break;
            }
            
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

        // --- DEPENDENCY GATE ---
        // Do not mathematically clamp `current` as that breaks UI for non-volume dependencies (like ship classes).
        // Instead, we track if the dependency is met to gate `isMet` during final evaluation.
        let dependencyMet = true;
        if (objective.dependsOn) {
            const depProgress = missionProgress.objectives?.[objective.dependsOn];
            if (!depProgress || depProgress.current < depProgress.target) {
                dependencyMet = false;
            }
        }
        // -------------------------------------

        // --- EVALUATION LOGIC ---
        if (typeof current !== 'number' || isNaN(current)) {
            current = 0;
        }

        switch (comparator) {
            case '>=':
                if (current >= target) {
                    current = target; 
                    if (dependencyMet) isMet = true;
                }
                break;
            case '<=':
                if (current <= target) {
                    if (dependencyMet) isMet = true;
                }
                break;
            case '==':
                if (current === target) {
                    if (dependencyMet) isMet = true;
                }
                break;
            default:
                console.warn(`[MissionObjectiveEvaluator] Unknown comparator: ${comparator}`);
                if (current >= target && dependencyMet) isMet = true;
        }

        // Failsafe closure: If the dependency is not met, the objective cannot be met
        if (!dependencyMet) {
            isMet = false;
        }

        return { current, target, isMet };
    }
}