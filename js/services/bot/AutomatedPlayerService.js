// js/services/bot/AutomatedPlayerService.js
/**
 * @fileoverview This file contains the AutomatedPlayer class.
 * This bot is designed to stress-test the in-game economy by simulating
 * an advanced player. It has been stripped of "omniscience" and now relies
 * on heuristic projections (Map details) and local trend awareness to make trades.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, LOCATION_IDS, PERK_IDS } from '../../data/constants.js';
import { calculateInventoryUsed, formatCredits } from '../../utils.js';

/**
 * Defines the operational states for the bot's state machine.
 * @enum {string}
 */
const BotState = {
    IDLE: 'IDLE',                                 
    MAINTENANCE: 'MAINTENANCE',                   
    SELLING_HELD_CARGO: 'SELLING_HELD_CARGO',     
    SEEKING_MANIPULATION: 'SEEKING_MANIPULATION', 
    PREPARING_CRASH: 'PREPARING_CRASH',           
    EXECUTING_CRASH: 'EXECUTING_CRASH',           
    EXECUTING_EXPLOIT: 'EXECUTING_EXPLOIT',       
    SELLING_EXPLOITED_GOODS: 'SELLING_EXPLOITED_GOODS', 
    TIME_WASTER: 'TIME_WASTER',                   
    SEEKING_DEPLETION: 'SEEKING_DEPLETION',       
    EXECUTING_DEPLETION: 'EXECUTING_DEPLETION',   
    WAITING_FOR_HIKE: 'WAITING_FOR_HIKE',         
    EXPLOITING_HIKE: 'EXPLOITING_HIKE',
    DEADHEADING: 'DEADHEADING' // Traveling empty to find better local markets
};

const BotStrategy = {
    MIXED: 'MIXED',               
    HONEST_TRADER: 'HONEST_TRADER', 
    MANIPULATOR: 'MANIPULATOR',   
    DEPLETE_ONLY: 'DEPLETE_ONLY',    
    PROSPECTOR: 'PROSPECTOR'      
};


export class AutomatedPlayer {
    constructor(gameState, simulationService, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.logger = logger;

        this.isRunning = false;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        this.activeStrategy = BotStrategy.MIXED; 

        this.currentObjective = null;
        this.plannedObjectives = [];
        
        this.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalNetProfit: 0,
            totalFuelCost: 0,
            totalRepairCost: 0,
            daysSimulated: 0,
            profitByGood: {},
            objectivesStarted: 0,
            objectivesCompleted: 0,
            objectivesAborted: 0,
            strategyUsed: BotStrategy.MIXED,
            volatilityLosses: 0 
        };
        this.simulationStartDay = 0;
    }

    async runSimulation({ daysToRun, strategy }, updateCallback) {
        if (this.isRunning) {
            this.logger.warn('Bot', 'AUTOTRADER-01 is already running.');
            return;
        }

        this.isRunning = true;
        this.stopRequested = false;
        this.botState = BotState.IDLE;
        this.activeStrategy = strategy || BotStrategy.MIXED; 
        const startDay = this.gameState.day;
        const endDay = startDay + daysToRun;
        
        this.simulationStartDay = startDay;
        this.metrics = {
            totalTrades: 0, profitableTrades: 0, totalNetProfit: 0,
            totalFuelCost: 0, totalRepairCost: 0, daysSimulated: 0,
            profitByGood: {}, objectivesStarted: 0, objectivesCompleted: 0,
            objectivesAborted: 0, strategyUsed: this.activeStrategy, volatilityLosses: 0
        };

        this.logger.info.system('Bot', startDay, 'SIMULATION_START', `Starting Heuristic simulation for ${daysToRun} days using strategy: ${this.activeStrategy}.`);

        while (this.gameState.day < endDay && !this.stopRequested) {
            await this._decideNextAction();
            updateCallback(this.gameState.day, endDay);
            await new Promise(resolve => setTimeout(resolve, 10)); 
        }

        this._logSummaryReport();
        if (this.stopRequested) {
             this.logger.info.system('Bot', this.gameState.day, 'SIMULATION_END', 'Simulation halted early due to stop request or bankruptcy.');
        } else {
             this.logger.info.system('Bot', this.gameState.day, 'SIMULATION_END', 'Simulation finished.');
        }
        this.isRunning = false;
    }

    stop() {
        this.stopRequested = true;
    }

    async _decideNextAction() {
        if (this._handleAgeEventChoice()) return; 

        // --- FATAL ERROR CHECK: Fleet Destroyed ---
        const activeShipId = this.gameState.player.activeShipId;
        if (!activeShipId || !this.gameState.player.shipStates[activeShipId]) {
            this.logger.error('Bot', `BANKRUPTCY: Active ship destroyed mid-flight. Fleet lost. Halting simulation.`);
            this.stopRequested = true;
            return;
        }

        if (this.botState !== BotState.MAINTENANCE && 
            (!this.currentObjective || this.currentObjective.type !== 'REFUEL_FOR_TRAVEL') &&
            this._needsMaintenance()) {
            this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Low resources detected. Switching to maintenance state.');
            this.botState = BotState.MAINTENANCE;
        }

        switch (this.botState) {
            case BotState.IDLE: await this._evaluateOpportunities(); break;
            case BotState.MAINTENANCE: await this._executeMaintenance(); break;
            case BotState.SELLING_HELD_CARGO: await this._executeSellHeldCargo(); break;
            case BotState.SEEKING_MANIPULATION: await this._findCrashOpportunity(); break;
            case BotState.PREPARING_CRASH: await this._executePreparation(); break; 
            case BotState.EXECUTING_CRASH: await this._executeCrash(); break; 
            case BotState.EXECUTING_EXPLOIT: await this._executeExploit(); break; 
            case BotState.SELLING_EXPLOITED_GOODS: await this._executeSellExploited(); break;
            case BotState.TIME_WASTER: await this._executeTimeWaster(); break;
            case BotState.SEEKING_DEPLETION: await this._findDepletionOpportunity(); break;
            case BotState.EXECUTING_DEPLETION: await this._executeDepletion(); break; 
            case BotState.WAITING_FOR_HIKE: await this._executeWait(); break;
            case BotState.EXPLOITING_HIKE: await this._executeExploitHike(); break;
            case BotState.DEADHEADING: await this._executeDeadhead(); break; 
        }
    }

    async _evaluateOpportunities() {
        const inventory = this.simulationService._getActiveInventory();
        const activeShip = this.simulationService._getActiveShip();
        const usedSpace = (inventory && activeShip) ? calculateInventoryUsed(inventory) : 0;

        if (usedSpace > 0) {
            const heldCargoTrade = this._findBestSellLocationForHeldCargo();
            if (heldCargoTrade) {
                this.currentObjective = { type: 'SELL_HELD_CARGO', ...heldCargoTrade };
                this.botState = BotState.SELLING_HELD_CARGO;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[HELD CARGO]: Found heuristic sale for ${heldCargoTrade.quantity}x ${heldCargoTrade.goodId} @ ${heldCargoTrade.sellLocationId}. Est Profit: ${formatCredits(heldCargoTrade.estimatedProfit)}.`);
                this.metrics.objectivesStarted++;
                return;
            } else {
                // --- DEADLOCK BREAKER: FIRE SALE ---
                // If cargo is held but no profitable route exists globally, liquidate locally to free space and break the loop.
                this.logger.warn('Bot', `FIRE SALE: Unprofitable baggage detected. Dumping cargo locally to break inventory deadlock.`);
                for (const goodId in inventory) {
                    if (inventory[goodId] && inventory[goodId].quantity > 0) {
                        const sellQty = inventory[goodId].quantity;
                        const avgCost = inventory[goodId].avgCost;
                        const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
                        const profit = saleValue - (avgCost * sellQty);
                        
                        this.metrics.totalTrades++;
                        this.metrics.totalNetProfit += profit;
                        if (profit > 0) this.metrics.profitableTrades++;
                        if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
                        this.metrics.profitByGood[goodId] += profit;
                        this.metrics.volatilityLosses++; // Forced loss
                    }
                }
                this.metrics.objectivesAborted++;
                // Do not return. Cargo is now clear, let it pick a new objective seamlessly.
                // ------------------------------------
            }
        }

        if (this.activeStrategy === BotStrategy.MIXED || this.activeStrategy === BotStrategy.MANIPULATOR) {
            const exploit = this._findReadySelfExploit();
            if (exploit) {
                this.currentObjective = exploit;
                this.botState = BotState.EXECUTING_EXPLOIT;
                this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `Found self-created exploit: Buy ${exploit.goodId} @ ${exploit.exploitLocationId}`);
                this.metrics.objectivesStarted++;
                return;
            }
        }

        if (this.currentObjective) {
            if (this.currentObjective.type === 'CRASH' && this._isCrashPlanStillValid()) {
                this.botState = BotState.PREPARING_CRASH;
                return;
            } else if (this.currentObjective.type !== 'CRASH' && this.currentObjective.type !== 'SIMPLE_TRADE') {
                const goodIdToRevalidate = this.currentObjective.goodId; 
                const validPlan = this._findCrashOpportunity(goodIdToRevalidate);
                if (validPlan && validPlan.goodId && validPlan.crashLocationId) {
                    this.currentObjective = validPlan;
                    this.botState = BotState.PREPARING_CRASH;
                    this.metrics.objectivesStarted++;
                    return;
                }
            }
        }
        
        this.currentObjective = null;

        switch (this.activeStrategy) {
            case BotStrategy.HONEST_TRADER:
                this.botState = BotState.TIME_WASTER; 
                break;
            case BotStrategy.MANIPULATOR:
                this.botState = BotState.SEEKING_MANIPULATION;
                break;
            case BotStrategy.DEPLETE_ONLY:
                this.botState = BotState.SEEKING_DEPLETION;
                break;
            case BotStrategy.PROSPECTOR:
                const simpleTrade = this._findBestSimpleTrade();
                if (simpleTrade) {
                    this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                    this.botState = BotState.TIME_WASTER;
                    this.metrics.objectivesStarted++;
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[PROSPECTOR]: Local buy ${simpleTrade.goodId} -> Sell @ ${simpleTrade.sellLocationId}. Est Net Profit: ${formatCredits(simpleTrade.estimatedNetProfit)}.`);
                } else {
                    this.logger.info.system('Bot', this.gameState.day, 'OBJECTIVE', `[PROSPECTOR]: Local market is devoid of profitable routes. Deadheading to new location.`);
                    this.botState = BotState.DEADHEADING;
                }
                break;
            case BotStrategy.MIXED:
            default:
                if (Math.random() < 0.25) {
                    this.botState = BotState.SEEKING_DEPLETION;
                } else {
                    this.botState = BotState.SEEKING_MANIPULATION;
                }
                break;
        }
    }

    async _executeMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) {
            this.botState = BotState.IDLE;
            return;
        }
        const shipState = this.gameState.player.shipStates[activeShip.id];
        if (!shipState) return;

        if (this.currentObjective && this.currentObjective.type === 'REFUEL_FOR_TRAVEL') {
            const { needed, nextState, originalObjective } = this.currentObjective;

            if (needed > activeShip.maxFuel) {
                this.logger.error('Bot', `MAINTENANCE_FAIL: Requires ${needed} fuel, max is ${activeShip.maxFuel}. Aborting.`);
                this.currentObjective = null; 
                this.botState = BotState.IDLE; 
                this.metrics.objectivesAborted++; 
                return;
            }

            if (shipState.fuel < needed) {
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', `Executing local refuel to get ${needed} fuel.`);
                const fuelBought = this._botRefuel(needed); 
                
                if (fuelBought === 0 && this.gameState.player.credits < 100) {
                    this.logger.error('Bot', `BANKRUPTCY: Bot is stranded and broke (${formatCredits(this.gameState.player.credits)}). Halting simulation.`);
                    this.stopRequested = true;
                    return;
                } else if (fuelBought === 0) {
                    this.logger.warn('Bot', `MAINTENANCE_FAIL: Insufficient funds to buy required fuel. Aborting objective.`);
                    this.currentObjective = null;
                    this.botState = BotState.IDLE;
                    this.metrics.objectivesAborted++;
                }
                return; 
            } else {
                this.logger.info.system('Bot', this.gameState.day, 'MAINTENANCE', 'Local refuel complete. Resuming objective.');
                this.currentObjective = originalObjective; 
                this.botState = nextState; 
                return;
            }
        }

        const fuelPct = (shipState.fuel / activeShip.maxFuel) * 100;
        const healthPct = (shipState.health / activeShip.maxHealth) * 100;

        if (fuelPct < 30) {
            if (this.gameState.currentLocationId === LOCATION_IDS.JUPITER) {
                const bought = this._botRefuel(activeShip.maxFuel); 
                if (bought === 0 && this.gameState.player.credits < 100) {
                    this.logger.error('Bot', `BANKRUPTCY: Bot is broke on Jupiter. Halting simulation.`);
                    this.stopRequested = true;
                }
            } else {
                const state = this.gameState.getState();
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][LOCATION_IDS.JUPITER];
                const fuelToJupiter = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                
                if (shipState.fuel < fuelToJupiter) {
                    const bought = this._botRefuel(fuelToJupiter + 5); 
                    if (bought === 0 && this.gameState.player.credits < 100) {
                        this.logger.error('Bot', `BANKRUPTCY: Bot is stranded and broke. Halting simulation.`);
                        this.stopRequested = true;
                    }
                } else {
                    this.simulationService.travelService.initiateTravel(LOCATION_IDS.JUPITER);
                }
            }
            return; 
        }

        if (healthPct < 50) {
            if (this.gameState.currentLocationId !== LOCATION_IDS.LUNA) {
                this.simulationService.travelService.initiateTravel(LOCATION_IDS.LUNA);
            } else {
                const repaired = this._botRepair();
                if (repaired === 0 && this.gameState.player.credits < 100) {
                    this.logger.error('Bot', `BANKRUPTCY: Bot is broke on Luna. Halting simulation.`);
                    this.stopRequested = true;
                }
            }
            return;
        }

        this.botState = BotState.IDLE;
    }

    async _executeDeadhead() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        const hubs = [LOCATION_IDS.EARTH, LOCATION_IDS.MARS, LOCATION_IDS.EXCHANGE, LOCATION_IDS.SATURN];
        
        const validHubs = hubs.filter(h => {
            if (h === state.currentLocationId || !state.player.unlockedLocationIds.includes(h)) return false;
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId]?.[h];
            return travelInfo && travelInfo.fuelCost <= activeShip.maxFuel;
        });
        
        if (validHubs.length === 0) {
            this.simulationService.timeService.advanceDays(1);
            this.botState = BotState.IDLE;
            return;
        }

        const targetHub = validHubs[Math.floor(Math.random() * validHubs.length)];
        this.logger.info.system('Bot', state.day, 'DEADHEAD', `Relocating empty ship to ${targetHub} for better markets.`);
        
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId][targetHub];
        const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

        if (activeShip.fuel < requiredFuel) {
            this.currentObjective = {
                type: 'REFUEL_FOR_TRAVEL',
                needed: requiredFuel + 5,
                nextState: BotState.DEADHEADING,
                originalObjective: { type: 'DEADHEAD' }
            };
            this.botState = BotState.MAINTENANCE;
            return;
        }

        this.simulationService.travelService.initiateTravel(targetHub);
        this.botState = BotState.IDLE; 
    }

    async _executeSellHeldCargo() {
        const { goodId, sellLocationId, quantity, estimatedProfit } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        if (state.currentLocationId !== sellLocationId) {
            this.logger.info.system('Bot', state.day, 'SELL_HELD', `Traveling to ${sellLocationId} to sell ${quantity}x ${goodId}`);

            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                const originalObjective = this.currentObjective;
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5, 
                    nextState: BotState.SELLING_HELD_CARGO, 
                    originalObjective: originalObjective 
                };
                this.botState = BotState.MAINTENANCE; 
                return;
            }

            this.simulationService.travelService.initiateTravel(sellLocationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            if (profit < 0) {
                this.metrics.volatilityLosses++;
                this.logger.warn('Bot', `SELL_HELD: Volatility Loss. Heuristic projected ${formatCredits(estimatedProfit)} profit, but actual market crash resulted in ${formatCredits(profit)} loss.`);
            } else {
                this.logger.info.system('Bot', state.day, 'SELL_HELD', `Sold ${sellQty}x ${goodId}. Actual Profit: ${formatCredits(profit)}`);
            }

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;
            this.metrics.objectivesCompleted++;
        } else {
             this.metrics.objectivesAborted++;
        }

        this.currentObjective = null;
        this.botState = BotState.IDLE;
    }

    async _findCrashOpportunity(specificGoodId = null) {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!activeShip || !inventory) return null;
        
        // Ensure cargo space exists
        const space = activeShip.cargoCapacity - calculateInventoryUsed(inventory);
        if (space <= 0) return null; 
        
        const currentLoc = state.currentLocationId;
        let availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1);
        if (specificGoodId) availableCommodities = availableCommodities.filter(c => c.id === specificGoodId);

        let top5Plans = [];

        for (const good of availableCommodities) {
            const stock = state.market.inventory[currentLoc][good.id].quantity;
            if (stock <= 0) continue; 

            const buyPrice = state.market.prices[currentLoc][good.id];
            if (state.player.credits < buyPrice) continue;
            
            const crashLocation = this._findBestHeuristicCrashTarget(good.id, currentLoc, activeShip.maxFuel);
            if (!crashLocation) continue;
            
            const potential = good.tier * (crashLocation.estimatedPrice - buyPrice);
            
            if (potential > 0) {
                top5Plans.push({
                    potential,
                    plan: {
                        type: 'CRASH',
                        goodId: good.id,
                        buyFromLocationId: currentLoc, 
                        crashLocationId: crashLocation.id,
                    }
                });
            }
        }

        if (top5Plans.length > 0) {
            top5Plans.sort((a, b) => b.potential - a.potential);
            const bestPlans = top5Plans.slice(0, 5).map(p => p.plan);
            const chosenPlan = bestPlans[Math.floor(Math.random() * bestPlans.length)];
            
            if (specificGoodId) return chosenPlan;

            this.currentObjective = chosenPlan;
            this.botState = BotState.PREPARING_CRASH;
            this.metrics.objectivesStarted++;
            this.logger.info.system('Bot', this.gameState.day, 'PLAN', `New crash plan: Local buy ${chosenPlan.goodId}, Crash @ ${chosenPlan.crashLocationId}`);
        } else {
            if (!specificGoodId) {
                this.logger.info.system('Bot', this.gameState.day, 'PLAN', `No viable crash targets found. Falling back to simple trades.`);
                this.botState = BotState.TIME_WASTER; 
            }
            return null;
        }
    }

    async _executePreparation() {
        const { goodId, buyFromLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== buyFromLocationId) {
             this.botState = BotState.IDLE;
             return;
        }

        const price = state.market.prices[buyFromLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);
        
        if (buyQty > 0) {
            const success = this.simulationService.playerActionService.buyItem(goodId, buyQty);
            if (success) {
                this.logger.info.system('Bot', state.day, 'PREP_BUY', `Bought ${buyQty}x ${goodId} @ ${formatCredits(price)}`);
                this.botState = BotState.EXECUTING_CRASH;
            } else {
                this.logger.warn('Bot', `PREP_FAIL: Transaction rejected by engine. Aborting.`);
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
            }
        } else {
            this.logger.warn('Bot', `PREP_FAIL: Cannot execute buy (insufficient funds, cargo space, or stock). Aborting.`);
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    async _executeCrash() {
        const { goodId, crashLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== crashLocationId) {
            this.logger.info.system('Bot', state.day, 'CRASH', `Traveling to ${crashLocationId} to crash ${goodId}`);

            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][crashLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_CRASH, 
                    originalObjective: this.currentObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(crashLocationId);
            return; 
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);
            
            this.logger.info.system('Bot', state.day, 'CRASH_SELL', `CRASHED: Sold ${sellQty}x ${goodId}. Profit: ${formatCredits(profit)}`);
            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

            const inventoryItem = this.gameState.market.inventory[crashLocationId][goodId];
            this.plannedObjectives.push({
                goodId: goodId,
                locationId: crashLocationId,
                priceLockEndDay: inventoryItem.priceLockEndDay,
                crashedOnDay: this.gameState.day,
            });

            this.currentObjective.type = 'EXPLOIT';
            this.currentObjective.exploitLocationId = this.currentObjective.crashLocationId;
            delete this.currentObjective.buyFromLocationId;
            delete this.currentObjective.crashLocationId;

            this.botState = BotState.EXECUTING_EXPLOIT;
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
    }

    async _executeExploit() {
        const { goodId, exploitLocationId } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        if (state.currentLocationId !== exploitLocationId) {
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][exploitLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_EXPLOIT, 
                    originalObjective: this.currentObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(exploitLocationId);
            return;
        }

        const price = state.market.prices[exploitLocationId][goodId];
        const buyQty = this._calculateMaxBuy(goodId, price);

        if (buyQty > 0) {
            const success = this.simulationService.playerActionService.buyItem(goodId, buyQty);
            
            if (!success) {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }

            const sellLocation = this._findBestHeuristicSellLocation(goodId, exploitLocationId, activeShip.maxFuel);

            if (sellLocation) {
                this.currentObjective.type = 'SELL_EXPLOITED';
                this.currentObjective.sellToLocationId = sellLocation.id; 
                this.botState = BotState.SELLING_EXPLOITED_GOODS;
            } else {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
            }
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
        }
        this.plannedObjectives = this.plannedObjectives.filter(obj => !(obj.goodId === goodId && obj.locationId === exploitLocationId));
    }

    async _executeSellExploited() {
        const { goodId, sellToLocationId } = this.currentObjective;
        const state = this.gameState.getState();

        if (state.currentLocationId !== sellToLocationId) {
            const activeShip = this.simulationService._getActiveShip();
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellToLocationId];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            
            if (activeShip.fuel < requiredFuel) {
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.SELLING_EXPLOITED_GOODS, 
                    originalObjective: this.currentObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(sellToLocationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        if (sellQty > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;
        } 

        this.botState = BotState.IDLE;
        this.metrics.objectivesCompleted++;
    }

    async _executeTimeWaster() {
        if (!this.currentObjective || this.currentObjective.type !== 'SIMPLE_TRADE') {
            const simpleTrade = this._findBestSimpleTrade();
            if (simpleTrade) {
                this.currentObjective = { ...simpleTrade, type: 'SIMPLE_TRADE', hasGoods: false };
                this.metrics.objectivesStarted++;
            } else {
                this.botState = BotState.DEADHEADING;
                return;
            }
        }

        const { goodId, buyLocationId, sellLocationId, estimatedNetProfit, quantity, hasGoods } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        // STAGE 1: BUY
        if (!hasGoods) {
            if (state.currentLocationId !== buyLocationId) {
                this.botState = BotState.IDLE; 
                return;
            }
            
            const currentStock = state.market.inventory[buyLocationId][goodId].quantity;
            
            if (currentStock <= 0) {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
            
            const actualBuyQty = Math.min(quantity, currentStock);
            if (actualBuyQty > 0) {
                const success = this.simulationService.playerActionService.buyItem(goodId, actualBuyQty);
                if (success) {
                    this.currentObjective.hasGoods = true; 
                } else {
                    this.currentObjective = null;
                    this.botState = BotState.IDLE;
                    this.metrics.objectivesAborted++;
                    return;
                }
            } else {
                this.currentObjective = null;
                this.botState = BotState.IDLE;
                this.metrics.objectivesAborted++;
                return;
            }
        }

        // STAGE 2: SELL
        if (this.currentObjective.hasGoods) {
            if (state.currentLocationId !== sellLocationId) {
                const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocationId];
                const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;

                if (activeShip.fuel < requiredFuel) {
                    this.currentObjective = {
                        type: 'REFUEL_FOR_TRAVEL',
                        needed: requiredFuel + 5,
                        nextState: BotState.TIME_WASTER,
                        originalObjective: this.currentObjective
                    };
                    this.botState = BotState.MAINTENANCE;
                    return;
                }
                this.simulationService.travelService.initiateTravel(sellLocationId);
                return;
            }
            
            const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
            if (sellQty > 0) {
                const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
                const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
                const actualProfit = saleValue - (avgCost * sellQty);
                
                if (actualProfit < 0) {
                    this.metrics.volatilityLosses++;
                    this.logger.warn('Bot', `TRADE_VOLATILITY: Heuristic projected ${formatCredits(estimatedNetProfit)} net profit, but dynamic market shifts caused ${formatCredits(actualProfit)} loss.`);
                }

                this.metrics.totalTrades++;
                this.metrics.totalNetProfit += actualProfit;
                if (actualProfit > 0) this.metrics.profitableTrades++;
                if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
                this.metrics.profitByGood[goodId] += actualProfit;
                this.metrics.objectivesCompleted++;
            } else {
                this.metrics.objectivesAborted++;
            }

            this.currentObjective = null;
            this.botState = BotState.IDLE;
        }
    }

    async _findDepletionOpportunity() {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) {
            this.botState = BotState.IDLE;
            return;
        }
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        if (space <= 0) {
             this.botState = BotState.IDLE;
             return;
        }
        
        const currentLoc = state.currentLocationId;
        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier && c.tier > 1);
        let top5Plans = [];

        for (const good of availableCommodities) {
            const inventoryItem = state.market.inventory[currentLoc][good.id];
            if (state.day <= (inventoryItem.depletionBonusDay + 365)) continue;

            const price = state.market.prices[currentLoc][good.id];
            if (state.player.credits < price) continue; 

            const [minAvail, maxAvail] = good.canonicalAvailability;
            const marketData = DB.MARKETS.find(m => m.id === currentLoc);
            const modifier = marketData.availabilityModifier?.[good.id] ?? 1.0;
            const baseMeanStock = (minAvail + maxAvail) / 2 * modifier;
            let pressureForAdaptation = inventoryItem.marketPressure;
            if (pressureForAdaptation > 0) pressureForAdaptation = 0;
            const marketAdaptationFactor = 1 - Math.min(0.5, pressureForAdaptation * 0.5);
            const targetStock = Math.max(1, baseMeanStock * marketAdaptationFactor);
            const depletionThreshold = targetStock * 0.08;

            const stock = inventoryItem.quantity;
            
            if (stock >= depletionThreshold && 
                state.player.credits >= (stock * price) &&
                space >= stock) {
                
                top5Plans.push({
                    potential: good.tier * stock,
                    plan: {
                        type: 'DEPLETE',
                        goodId: good.id,
                        locationId: currentLoc, 
                        amountToBuy: stock
                    }
                });
            }
        }

        if (top5Plans.length > 0) {
            top5Plans.sort((a, b) => b.potential - a.potential);
            const bestPlans = top5Plans.slice(0, 5).map(p => p.plan);
            this.currentObjective = bestPlans[Math.floor(Math.random() * bestPlans.length)];
            this.botState = BotState.EXECUTING_DEPLETION;
            this.metrics.objectivesStarted++;
        } else {
            if (this.activeStrategy === BotStrategy.DEPLETE_ONLY) {
                this.botState = BotState.DEADHEADING;
            } else {
                this.botState = BotState.SEEKING_MANIPULATION;
            }
        }
    }

    async _executeDepletion() {
        const { goodId, locationId, amountToBuy } = this.currentObjective;
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        if (state.currentLocationId !== locationId) {
             this.botState = BotState.IDLE; 
             return;
        }

        const success = this.simulationService.playerActionService.buyItem(goodId, amountToBuy);
        if (!success) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }

        const sellLocation = this._findBestHeuristicSellLocation(goodId, locationId, activeShip.maxFuel);
        if (sellLocation) {
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXECUTING_DEPLETION, 
                    originalObjective: this.currentObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(sellLocation.id);
            return;
        }

        this.currentObjective.waitStartDay = this.gameState.day;
        this.botState = BotState.WAITING_FOR_HIKE;
    }

    async _executeWait() {
        if (this.gameState.day > this.currentObjective.waitStartDay + 7) {
            this.botState = BotState.EXPLOITING_HIKE;
            this.currentObjective.exploitRuns = 0; 
        } else {
            this.simulationService.timeService.advanceDays(1);
            this.botState = BotState.WAITING_FOR_HIKE; 
        }
    }

    async _executeExploitHike() {
        const { goodId, locationId } = this.currentObjective; 
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();

        const buyLocation = this._findBestHeuristicCrashTarget(goodId, locationId, activeShip.maxFuel); 
        if (!buyLocation || buyLocation.id === locationId) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }
        
        if (state.currentLocationId !== buyLocation.id) {
            const travelInfo = state.TRAVEL_DATA[state.currentLocationId][buyLocation.id];
            const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
            if (activeShip.fuel < requiredFuel) {
                this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXPLOITING_HIKE,
                    originalObjective: this.currentObjective
                };
                this.botState = BotState.MAINTENANCE;
                return;
            }
            this.simulationService.travelService.initiateTravel(buyLocation.id);
            return;
        }
        
        const actualPrice = state.market.prices[buyLocation.id][goodId];
        const buyQty = this._calculateMaxBuy(goodId, actualPrice);
        if (buyQty > 0) this.simulationService.playerActionService.buyItem(goodId, buyQty);
        
        if (state.currentLocationId !== locationId) {
             const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
             const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
             if (activeShip.fuel < requiredFuel) {
                 this.currentObjective = {
                    type: 'REFUEL_FOR_TRAVEL',
                    needed: requiredFuel + 5,
                    nextState: BotState.EXPLOITING_HIKE,
                    originalObjective: this.currentObjective
                 };
                 this.botState = BotState.MAINTENANCE;
                 return;
             }
            this.simulationService.travelService.initiateTravel(locationId);
            return;
        }

        const sellQty = this.simulationService._getActiveInventory()[goodId]?.quantity || 0;
        const hikedStock = state.market.inventory[locationId][goodId].quantity;
        if (sellQty > 0 && hikedStock > 0) {
            const avgCost = this.simulationService._getActiveInventory()[goodId]?.avgCost || 0;
            const saleValue = this.simulationService.playerActionService.sellItem(goodId, sellQty);
            const profit = saleValue - (avgCost * sellQty);

            this.metrics.totalTrades++;
            this.metrics.totalNetProfit += profit;
            if (profit > 0) this.metrics.profitableTrades++;
            if (!this.metrics.profitByGood[goodId]) { this.metrics.profitByGood[goodId] = 0; }
            this.metrics.profitByGood[goodId] += profit;

        } else if (sellQty > 0 && hikedStock <= 0) {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesAborted++;
            return;
        }

        this.currentObjective.exploitRuns++;
        const inventoryItem = state.market.inventory[locationId][goodId];
        if (this.currentObjective.exploitRuns < 2 && state.day < (inventoryItem.depletionDay + 7)) {
            this.botState = BotState.EXPLOITING_HIKE;
        } else {
            this.currentObjective = null;
            this.botState = BotState.IDLE;
            this.metrics.objectivesCompleted++;
        }
    }


    // --- "BRAIN" HELPER FUNCTIONS ---

    _isCrashPlanStillValid() {
        if (!this.currentObjective || this.currentObjective.type !== 'CRASH') {
            return false;
        }
        const { goodId, buyFromLocationId, crashLocationId } = this.currentObjective;
        if (!goodId || !buyFromLocationId || !crashLocationId) return false;

        const state = this.gameState.getState();
        if (state.currentLocationId !== buyFromLocationId) return false; 
        
        const buyPrice = state.market.prices[buyFromLocationId][goodId];
        const estSellPrice = this._estimateRemotePrice(crashLocationId, goodId);
        return (estSellPrice - buyPrice) > 0;
    }

    _findReadySelfExploit() {
        const state = this.gameState.getState();
        this.plannedObjectives = this.plannedObjectives.filter(obj => obj.priceLockEndDay > state.day); 
        for (const obj of this.plannedObjectives) {
            if (state.day > obj.crashedOnDay + 7) {
                if (state.currentLocationId === obj.locationId) {
                    const stock = state.market.inventory[obj.locationId][obj.goodId].quantity;
                    if (stock > 10) return { type: 'EXPLOIT', goodId: obj.goodId, exploitLocationId: obj.locationId };
                } else {
                    return { type: 'EXPLOIT', goodId: obj.goodId, exploitLocationId: obj.locationId };
                }
            }
        }
        return null;
    }

    _findBestSellLocationForHeldCargo() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!inventory || !activeShip) return null;

        let bestSale = null;
        let maxProfit = 0;

        for (const goodId in inventory) {
            const item = inventory[goodId];
            if (item && item.quantity > 0) {
                const avgCost = item.avgCost;
                const quantity = item.quantity;
                
                const sellLocation = this._findBestHeuristicSellLocation(goodId, state.currentLocationId, activeShip.maxFuel);
                
                if (sellLocation) {
                    const travelInfo = state.TRAVEL_DATA[state.currentLocationId][sellLocation.id];
                    const requiredFuel = travelInfo ? (travelInfo.fuelCost || 0) : 9999;
                    const fuelPrice = DB.MARKETS.find(m=>m.id === state.currentLocationId).fuelPrice / 10;
                    const estimatedFuelCost = (requiredFuel * 1.5) * fuelPrice;

                    const potentialProfit = ((sellLocation.estimatedPrice - avgCost) * quantity) - estimatedFuelCost;
                    
                    if (potentialProfit > maxProfit) {
                        maxProfit = potentialProfit;
                        bestSale = {
                            goodId: goodId,
                            quantity: quantity,
                            avgCost: avgCost,
                            sellLocationId: sellLocation.id,
                            sellPrice: sellLocation.estimatedPrice,
                            estimatedProfit: potentialProfit
                        };
                    }
                }
            }
        }
        return (bestSale && bestSale.estimatedProfit > 0) ? bestSale : null;
    }

    _getGalacticAverage(commodityId) {
        const good = DB.COMMODITIES.find(c => c.id === commodityId);
        if (!good) return 0;
        return (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
    }

    _estimateRemotePrice(locationId, commodityId) {
        const avg = this._getGalacticAverage(commodityId);
        const market = DB.MARKETS.find(m => m.id === locationId);
        const modifier = market?.availabilityModifier?.[commodityId] ?? 1.0;
        const targetPriceOffset = (1.0 - modifier) * avg;
        return avg + (targetPriceOffset * GAME_RULES.LOCAL_PRICE_MOD_STRENGTH);
    }

    _findBestHeuristicSellLocation(goodId, startLocationId, maxFuel) {
        const state = this.gameState.getState();
        let bestSell = null;
        let maxPrice = -Infinity;

        for (const location of DB.MARKETS) {
            if (location.id === startLocationId || !state.player.unlockedLocationIds.includes(location.id)) continue;
            
            const travelInfo = state.TRAVEL_DATA[startLocationId]?.[location.id];
            if (!travelInfo || travelInfo.fuelCost > maxFuel) continue;

            const estimatedPrice = this._estimateRemotePrice(location.id, goodId);
            if (estimatedPrice > maxPrice) {
                maxPrice = estimatedPrice;
                bestSell = { id: location.id, estimatedPrice: estimatedPrice };
            }
        }
        return bestSell;
    }

    _findBestHeuristicCrashTarget(goodId, startLocationId, maxFuel) {
        const state = this.gameState.getState();
        let bestTarget = null;
        let lowestPrice = Infinity; 

        for (const location of DB.MARKETS) {
            if (location.id === startLocationId || !state.player.unlockedLocationIds.includes(location.id)) continue;

            const travelInfo = state.TRAVEL_DATA[startLocationId]?.[location.id];
            if (!travelInfo || travelInfo.fuelCost > maxFuel) continue;

            const estimatedPrice = this._estimateRemotePrice(location.id, goodId);
            if (estimatedPrice < lowestPrice) {
                lowestPrice = estimatedPrice;
                bestTarget = { id: location.id, estimatedPrice: estimatedPrice };
            }
        }
        return bestTarget;
    }

    _findBestSimpleTrade() {
        const state = this.gameState.getState();
        const activeShip = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!activeShip || !inventory) return null; 
        
        const space = activeShip.cargoCapacity - calculateInventoryUsed(inventory);
        if (space <= 0) return null; 

        let bestTrade = null;
        let maxNetProfit = 0;

        const availableCommodities = DB.COMMODITIES.filter(c => c.tier <= state.player.revealedTier);
        const currentLocId = state.currentLocationId;
        const localFuelPrice = DB.MARKETS.find(m => m.id === currentLocId).fuelPrice / 10;

        for (const good of availableCommodities) {
            if (inventory[good.id] && inventory[good.id].quantity > 0) continue;

            const buyStock = state.market.inventory[currentLocId][good.id].quantity;
            if (buyStock < 15) continue; 

            const buyPrice = state.market.prices[currentLocId][good.id];
            
            // Affordability Check
            if (state.player.credits < buyPrice) continue;

            for (const sellLocation of DB.MARKETS) {
                if (currentLocId === sellLocation.id || !state.player.unlockedLocationIds.includes(sellLocation.id)) continue;

                const estimatedSellPrice = this._estimateRemotePrice(sellLocation.id, good.id);
                const profitPerUnit = estimatedSellPrice - buyPrice;
                
                if (profitPerUnit > 0) {
                    const affordableQty = Math.floor(state.player.credits / buyPrice);
                    const buyQty = Math.min(space, buyStock, affordableQty);
                    
                    if (buyQty <= 0) continue;

                    const grossProfit = profitPerUnit * buyQty;
                    
                    const travelInfo = state.TRAVEL_DATA[currentLocId]?.[sellLocation.id];
                    // Range limit check
                    if (!travelInfo || travelInfo.fuelCost > activeShip.maxFuel) continue;
                    
                    const estimatedFuelCost = (travelInfo.fuelCost * 1.5) * localFuelPrice;
                    const estimatedNetProfit = grossProfit - estimatedFuelCost;

                    if (estimatedNetProfit > maxNetProfit && estimatedNetProfit > 0) {
                        maxNetProfit = estimatedNetProfit;
                        bestTrade = {
                            goodId: good.id,
                            buyLocationId: currentLocId,
                            sellLocationId: sellLocation.id,
                            buyPrice,
                            sellPrice: estimatedSellPrice,
                            quantity: buyQty,
                            estimatedNetProfit: estimatedNetProfit,
                            estimatedPPD: estimatedNetProfit / (travelInfo.time + 1)
                        };
                    }
                }
            }
        }
        return bestTrade;
    }

    _handleAgeEventChoice() {
        const modal = document.getElementById('age-event-modal');
        if (!modal || modal.classList.contains('hidden')) return false; 

        const title = document.getElementById('age-event-title').textContent;
        const buttons = Array.from(modal.querySelectorAll('button'));
        if (buttons.length === 0) return false; 

        const profitKeywords = ['trademaster', 'merchant\'s guild', 'free ship', 'credits', 'profit'];
        const neutralKeywords = ['continue', 'ignore', 'dismiss', 'accept'];
        
        let chosenButton = null;

        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase();
            if (profitKeywords.some(kw => btnText.includes(kw))) { chosenButton = btn; break; }
        }

        if (!chosenButton) {
             for (const btn of buttons) {
                const btnText = btn.textContent.toLowerCase();
                if (neutralKeywords.some(kw => btnText.includes(kw))) { chosenButton = btn; break; }
            }
        }
        
        if (!chosenButton) chosenButton = buttons[0];
        
        chosenButton.click();
        return true;
    }
    
    _logSummaryReport() {
        this.metrics.daysSimulated = this.gameState.day - this.simulationStartDay;
        const { 
            totalTrades, profitableTrades, totalNetProfit, totalFuelCost, 
            totalRepairCost, daysSimulated, strategyUsed, objectivesStarted,
            objectivesCompleted, objectivesAborted, profitByGood, volatilityLosses
        } = this.metrics;
        
        const profitPct = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : 0;
        const profitPerDay = daysSimulated > 0 ? (totalNetProfit / daysSimulated) : 0;

        const header = '=== AUTO-TRADER PERFORMANCE SUMMARY ===';
        console.log(header);
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', header);
        
        const summary = [
            `Strategy Run: ${strategyUsed}`,
            `Days Simulated: ${daysSimulated}`,
            `Final Credit Balance: ${formatCredits(this.gameState.player.credits)}`,
            ``,
            `--- Performance ---`,
            `Total Net Profit: ${formatCredits(totalNetProfit)}`,
            `Profit Per Day: ${formatCredits(profitPerDay)}`,
            `Objectives (Started/Completed/Aborted): ${objectivesStarted} / ${objectivesCompleted} / ${objectivesAborted}`,
            `Total Trades Completed: ${totalTrades}`,
            `Profitable Trades: ${profitableTrades} (${profitPct}%)`,
            `Losses due to Market Volatility: ${volatilityLosses}`,
            ``,
            `--- Costs ---`,
            `Total Fuel Costs: ${formatCredits(totalFuelCost)}`,
            `Total Repair Costs: ${formatCredits(totalRepairCost)}`,
        ];

        for (const line of summary) {
            console.log(line);
            this.logger.info.system('Bot', this.gameState.day, 'REPORT', `  ${line}`); 
        }

        const profitHeader = `--- Profit Breakdown by Commodity ---`;
        console.log(profitHeader);
        this.logger.info.system('Bot', this.gameState.day, 'REPORT', `  ${profitHeader}`);
        
        const sortedGoods = Object.keys(profitByGood).sort((a, b) => profitByGood[b] - profitByGood[a]);
        if (sortedGoods.length === 0) {
             const noData = `No commodity trades recorded.`;
             console.log(noData);
             this.logger.info.system('Bot', this.gameState.day, 'REPORT', `    ${noData}`);
        } else {
            for (const goodId of sortedGoods) {
                const profit = profitByGood[goodId];
                const commodityName = DB.COMMODITIES.find(c => c.id === goodId)?.name || goodId;
                const line = `${commodityName}: ${formatCredits(profit)}`;
                console.log(line);
                this.logger.info.system('Bot', this.gameState.day, 'REPORT', `    ${line}`);
            }
        }
    }

    _needsMaintenance() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return false;

        const fuelPct = (this.gameState.player.shipStates[activeShip.id].fuel / activeShip.maxFuel) * 100;
        const healthPct = (this.gameState.player.shipStates[activeShip.id].health / activeShip.maxHealth) * 100;

        return fuelPct < 30 || healthPct < 50; 
    }

    _botRefuel(targetFuelAmount = null) {
        const ship = this.simulationService._getActiveShip();
        if (!ship || !this.gameState.player.shipStates[ship.id]) return 0;
        
        const finalTargetFuel = targetFuelAmount === null ? ship.maxFuel : Math.min(ship.maxFuel, targetFuelAmount);
        const fuelNeeded = finalTargetFuel - this.gameState.player.shipStates[ship.id].fuel;
        
        if (fuelNeeded <= 0) return 0;
        
        const currentMarket = DB.MARKETS.find(m => m.id === this.gameState.currentLocationId);
        let fuelPrice = currentMarket.fuelPrice / 2; 
        
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             fuelPrice *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        fuelPrice = Math.max(1, Math.round(fuelPrice));

        const ticksNeeded = Math.ceil(fuelNeeded / 5); 
        const totalCost = ticksNeeded * fuelPrice;
        let fuelBought = 0;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            fuelBought = ticksNeeded * 5;
            this.gameState.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, this.gameState.player.shipStates[ship.id].fuel + fuelBought);
            this.simulationService._logConsolidatedTransaction('fuel', -totalCost, 'Fuel Purchase');
            this.metrics.totalFuelCost += totalCost;
        } else {
            const affordableTicks = Math.floor(this.gameState.player.credits / fuelPrice);
            if (affordableTicks > 0) {
                const cost = affordableTicks * fuelPrice;
                this.gameState.player.credits -= cost;
                fuelBought = affordableTicks * 5;
                this.gameState.player.shipStates[ship.id].fuel += fuelBought;
                this.simulationService._logConsolidatedTransaction('fuel', -cost, 'Fuel Purchase');
                this.metrics.totalFuelCost += cost;
            }
        }
        return fuelBought;
    }

    _botRepair() {
        const ship = this.simulationService._getActiveShip();
        if (!ship || !this.gameState.player.shipStates[ship.id]) return 0;
        
        const healthNeeded = ship.maxHealth - this.gameState.player.shipStates[ship.id].health;
        if (healthNeeded <= 0) return 0;
        
        const repairAmountPerTick = ship.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100);
        let costPerTick = repairAmountPerTick * GAME_RULES.REPAIR_COST_PER_HP;
        
        if (this.gameState.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && this.gameState.currentLocationId === LOCATION_IDS.VENUS) {
             costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }
        costPerTick = Math.max(1, Math.round(costPerTick));

        const ticksNeeded = Math.ceil(healthNeeded / repairAmountPerTick);
        const totalCost = ticksNeeded * costPerTick;
        let healthRepaired = 0;

        if (this.gameState.player.credits >= totalCost) {
            this.gameState.player.credits -= totalCost;
            healthRepaired = ticksNeeded * repairAmountPerTick;
            this.gameState.player.shipStates[ship.id].health = ship.maxHealth;
            this.simulationService._logConsolidatedTransaction('repair', -totalCost, 'Hull Repairs');
            this.metrics.totalRepairCost += totalCost;
        } else {
            const affordableTicks = Math.floor(this.gameState.player.credits / costPerTick);
            if (affordableTicks > 0) {
                const cost = affordableTicks * costPerTick;
                this.gameState.player.credits -= cost;
                healthRepaired = affordableTicks * repairAmountPerTick;
                this.gameState.player.shipStates[ship.id].health += healthRepaired;
                this.simulationService._logConsolidatedTransaction('repair', -cost, 'Hull Repairs');
                this.metrics.totalRepairCost += cost;
            }
        }
        return healthRepaired;
    }

    _calculateMaxBuy(goodId, price) {
        const state = this.gameState.getState();
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        if (!ship || !inventory) return 0; 
        
        const space = ship.cargoCapacity - calculateInventoryUsed(inventory);
        const canAfford = (price > 0) ? Math.floor(state.player.credits / price) : Infinity;
        const stock = state.market.inventory[state.currentLocationId][goodId].quantity;
        return Math.max(0, Math.min(space, canAfford, stock));
    }
}