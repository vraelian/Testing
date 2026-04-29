// js/services/world/TravelService.js
/**
 * @fileoverview Handles all aspects of interstellar travel, including
 * initiating trips, calculating costs, and managing the random event system.
 * UPDATED: Re-routes modal resolution specifically to UIEventControl intercept hook.
 * UPDATED: Cleaned up Starfield handling to allow persistence during Story Events.
 */
import { DB } from '../../data/database.js';
import { GAME_RULES, SCREEN_IDS, NAV_IDS, PERK_IDS, LOCATION_IDS, ATTRIBUTE_TYPES, EVENT_CONSTANTS, COMMODITY_IDS } from '../../data/constants.js';
import { applyEffect } from '../eventEffectResolver.js';
import { GameAttributes } from '../../services/GameAttributes.js';
import { RandomEventService } from '../RandomEventService.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { starfieldService } from '../ui/StarfieldService.js';

export class TravelService {
    constructor(gameState, uiManager, timeService, logger, simulationServiceFacade) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.timeService = timeService;
        this.logger = logger;
        this.simulationService = simulationServiceFacade;
        
        this.randomEventService = new RandomEventService(); 
        this.debugAlwaysTriggerEvents = false;
    }

    travelTo(locationId, useFoldedDrive = false) {
        this.uiManager.resetMarketTransactionState();
        const { tutorials } = this.gameState;
        const { navLock } = tutorials;

        if (navLock && navLock.screenId === SCREEN_IDS.NAVIGATION && navLock.enabledElementQuery) {
            if (!navLock.enabledElementQuery.includes(`[data-location-id='${locationId}']`)) {
                return;
            }
        }

        const state = this.gameState.getState();
        if (state.isGameOver || state.pendingTravel) return;
        
        if (state.currentLocationId === locationId) {
            starfieldService.triggerQuickExit();
            this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            return;
        }

        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) {
            starfieldService.triggerQuickExit();
            this.uiManager.queueModal('event-modal', "No Active Ship", "You must have an active vessel to travel.");
            return;
        }

        const effectiveStats = this.simulationService.getEffectiveShipStats(activeShip.id);
        const effectiveMaxFuel = effectiveStats.maxFuel;
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        const shipState = state.player.shipStates[activeShip.id];
        const upgrades = shipState.upgrades || [];

        const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
        let requiredFuel = travelInfo.fuelCost;
        
        if (useFoldedDrive) {
             const inventory = state.player.inventories[activeShip.id] || {};
             const qty = inventory[COMMODITY_IDS.FOLDED_DRIVES]?.quantity || 0;

             if (qty <= 0) {
                 this.uiManager.queueModal('event-modal', "Missing Component", "You do not have a Folded-Space Drive to consume.");
                 return;
             }
             requiredFuel = 0;
        } else {
            if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
                requiredFuel = Math.round(requiredFuel * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
            }

            const attrFuelMod = GameAttributes.getFuelBurnModifier(upgrades);
            requiredFuel = Math.round(requiredFuel * attrFuelMod);

            if (shipAttributes.includes('ATTR_METABOLIC_BURN')) {
                requiredFuel = Math.round(requiredFuel * 0.5);
            }

            if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
                const fromDist = DB.MARKETS.find(m => m.id === state.currentLocationId)?.distance || 0;
                const toDist = DB.MARKETS.find(m => m.id === locationId)?.distance || 0;
                if (toDist < fromDist) {
                    requiredFuel = 0;
                }
            }

            if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) {
                requiredFuel = 0;
            }

            const systemState = state.systemState;
            const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

            if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.travelFuelBurnMod) {
                requiredFuel = Math.round(requiredFuel * activeStateDef.modifiers.travelFuelBurnMod);
            }
        }

        const currentFuel = Math.floor(state.player.shipStates[activeShip.id].fuel);
        
        if (currentFuel < requiredFuel || effectiveMaxFuel < requiredFuel) {
            starfieldService.triggerQuickExit();
            
            const shipDef = DB.SHIPS[activeShip.id];
            let shipClassColor = 'text-white'; 
            
            if (shipDef && shipDef.class) {
                switch(shipDef.class.toUpperCase()) {
                    case 'C': shipClassColor = 'text-white'; break;
                    case 'B': shipClassColor = 'text-emerald-400'; break;
                    case 'A': shipClassColor = 'text-sky-400'; break;
                    case 'S': shipClassColor = 'text-glow-gold'; break;
                    case 'O': shipClassColor = 'text-glow-orange'; break;
                    case 'Z': shipClassColor = 'text-glow-red'; break;
                    default: shipClassColor = 'text-white';
                }
            }
            
            const shipNameHtml = `<span class="${shipClassColor} font-bold">${shipDef ? shipDef.name : 'Vessel'}</span>`;
            const fuelHtml = `<span class="text-blue-400 font-bold">fuel</span>`;
            const destName = DB.MARKETS.find(m => m.id === locationId)?.name || 'destination';

            let message = `You need ${requiredFuel} ${fuelHtml} but your ${shipNameHtml} has ${currentFuel}.`;
            
            if (effectiveMaxFuel < requiredFuel) {
                message += `<br><br>A direct flight to ${destName} requires more ${fuelHtml} than your ship can hold.`;
            }

            this.uiManager.queueModal(
                'event-modal', 
                "Insufficient Fuel", 
                message, 
                () => {
                    this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.SERVICES);
                }, 
                { 
                    buttonText: "Return to Starport",
                    dismissOutside: true
                } 
            );
            return;
        }

        const isFirstTutorialFlight = state.tutorials.activeBatchId === 'intro_missions' && state.tutorials.activeStepId === 'mission_1_6';
        if (!isFirstTutorialFlight && !useFoldedDrive) { 
            this._processStoryEvents(locationId, useFoldedDrive, 0);
            return;
        }

        this.initiateTravel(locationId, { useFoldedDrive });
    }

    /**
     * Recursively processes the pending story events queue up to a limit of 2 per trip.
     * Persists the starfield background and overrides standard random events.
     * @private
     */
    _processStoryEvents(locationId, useFoldedDrive, eventsResolvedCount = 0) {
        if (!this.gameState.pendingStoryEvents) this.gameState.pendingStoryEvents = [];
        
        if (eventsResolvedCount >= 2 || this.gameState.pendingStoryEvents.length === 0) {
            // Processing complete. Hand off to actual travel sequence.
            if (eventsResolvedCount > 0) {
                this.initiateTravel(locationId, { useFoldedDrive });
            } else {
                if (!this._checkForRandomEvent(locationId)) {
                    this.initiateTravel(locationId, { useFoldedDrive });
                }
            }
            return;
        }

        const eventId = this.gameState.pendingStoryEvents.shift();
        const eventDef = DB.STORY_EVENTS[eventId];
        
        if (!eventDef) {
            this.logger.error('TravelService', `Story event ${eventId} not found in registry.`);
            this._processStoryEvents(locationId, useFoldedDrive, eventsResolvedCount);
            return;
        }

        this.logger.info.system('Event', this.gameState.day, 'STORY_EVENT_TRIGGER', `Triggered story event: ${eventDef.title}`);

        // --- PHASE 4: Initiate Warp Background early for Story Events ---
        if (eventsResolvedCount === 0) {
            if (useFoldedDrive) {
                starfieldService.setFoldedSpaceWarp();
            } else {
                starfieldService.setEngageWarp();
            }
        }
        
        // Secure state to protect against hard closures during modal rendering
        const baseTime = this.gameState.TRAVEL_DATA[this.gameState.currentLocationId]?.[locationId]?.time || 7;
        this.gameState.setState({ pendingTravel: { destinationId: locationId, days: baseTime } });

        this.uiManager.eventControl.showStoryEventModal(eventDef, (choiceId) => {
            if (choiceId && eventDef.choices) {
                const choiceDef = eventDef.choices.find(c => c.id === choiceId);
                if (choiceDef && choiceDef.resolution) {
                    const result = this.randomEventService.resolveChoice(eventId, choiceId, this.gameState, this.simulationService);
                    if (result && result.effects && result.effects.length > 0) {
                        if (this.uiManager.eventControl && this.uiManager.eventControl.showEventResultModal) {
                            this.uiManager.eventControl.showEventResultModal(
                                result.title,
                                result.text,
                                result.effects,
                                () => this._processStoryEvents(locationId, useFoldedDrive, eventsResolvedCount + 1)
                            );
                        } else if (this.uiManager.showEventResultModal) {
                            this.uiManager.showEventResultModal(
                                result.title,
                                result.text,
                                result.effects,
                                () => this._processStoryEvents(locationId, useFoldedDrive, eventsResolvedCount + 1)
                            );
                        }
                        return; // Halt recursion until result modal resolves
                    }
                }
            }
            // If linear event (no choices) or effectless choice, immediately recurse
            this._processStoryEvents(locationId, useFoldedDrive, eventsResolvedCount + 1);
        });
    }

    initiateTravel(locationId, eventMods = {}) {
        this.gameState.setState({ activeHotIntel: null });

        if (this.simulationService.toastService) {
            this.simulationService.toastService.clearQueueAndHide();
        }

        const state = this.gameState.getState();
        const fromId = state.currentLocationId;
        
        if (fromId === locationId) {
             if (eventMods && eventMods.travelTimeAdd > 0) {
                 this.timeService.advanceDays(eventMods.travelTimeAdd);
             }
             this.gameState.setState({ pendingTravel: null });
             this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
             return;
        }

        if (state.player.debt > 0 && state.player.loanType === 'syndicate' && state.player.repoNextEventDay && state.day >= state.player.repoNextEventDay) {
            const activeShip = this.simulationService._getActiveShip();
            const activeShipState = this.gameState.player.shipStates[activeShip.id];
            
            const damage = Math.floor(activeShipState.health * 0.85);
            activeShipState.health = Math.max(1, activeShipState.health - damage);
            
            state.player.repoNextEventDay = null;
            state.player.lastRepoStrikeDay = state.day;

            this.gameState.setState({ pendingTravel: null });
            
            this.uiManager.showEventResultModal(
                "<span style='font-size: smaller;'>Catastrophic Pre-Flight Sabotage</span>",
                `Just as your ship engines begin to throttle up for launch, a violent explosion tears through the hull. Multiple systems cascade into failure, forcing an immediate emergency launch abort.<br><br>An untraceable message suddenly reaches your terminal: <i>'Consider this a courtesy notice. You owe the Syndicate. Pay your debts.'</i>`,
                [
                    { type: 'EFF_HULL', value: -damage }
                ]
            );
            
            this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            return;
        }

        if (fromId === 'sol' && this.timeService.solStationService) {
            if (typeof this.timeService.solStationService.stopLocalLiveLoop === 'function') {
                this.timeService.solStationService.stopLocalLiveLoop();
            }
        }

        let travelInfo = { ...state.TRAVEL_DATA[fromId][locationId] };
        const baseTravelTime = travelInfo.time;
        
        this.logger.info.player(state.day, 'TRAVEL_START', `Departing from ${fromId} to ${locationId}.`);

        const activeShip = this.simulationService._getActiveShip();
        const activeShipState = this.gameState.player.shipStates[activeShip.id];
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        const upgrades = activeShipState.upgrades || [];
        const statusEffects = activeShipState.statusEffects || [];

        const hasStatus = (id) => statusEffects.some(s => s.id === id);

        const systemState = state.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;

        if (!eventMods.useFoldedDrive) {
            if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.travelFuelBurnMod) {
                travelInfo.fuelCost = Math.round(travelInfo.fuelCost * activeStateDef.modifiers.travelFuelBurnMod);
            }
            
            if (hasStatus('status_plasma_leak')) {
                travelInfo.fuelCost = Math.round(travelInfo.fuelCost * 1.25);
            }
            if (hasStatus('status_thrust_imbalance')) {
                travelInfo.time = Math.round(travelInfo.time * 1.20);
            }
            if (hasStatus('status_nav_glitch')) {
                travelInfo.time += Math.floor(Math.random() * 26) + 5;
            }
        }

        if (eventMods.useFoldedDrive) {
            travelInfo.time = 0;
            travelInfo.fuelCost = 0;

            const inv = this.gameState.player.inventories[activeShip.id];
            if (inv && inv[COMMODITY_IDS.FOLDED_DRIVES]) {
                inv[COMMODITY_IDS.FOLDED_DRIVES].quantity = Math.max(0, inv[COMMODITY_IDS.FOLDED_DRIVES].quantity - 1);
                this.uiManager.createFloatingText("-1 Folded Drive", window.innerWidth / 2, window.innerHeight / 2, '#ef4444');
                this.logger.info.player(state.day, 'ITEM_CONSUMED', 'Folded-Space Drive consumed for instant travel.');
            }
        } else {
            if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
                travelInfo.time = Math.round(travelInfo.time * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
                travelInfo.fuelCost = Math.round(travelInfo.fuelCost * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
            }

            const attrFuelMod = GameAttributes.getFuelBurnModifier(upgrades);
            const attrTimeMod = GameAttributes.getTravelTimeModifier(upgrades);
            
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * attrFuelMod);
            travelInfo.time = Math.max(1, Math.round(travelInfo.time * attrTimeMod));

            if (shipAttributes.includes('ATTR_METABOLIC_BURN')) {
                travelInfo.fuelCost = Math.round(travelInfo.fuelCost * 0.5);
            }

            if (shipAttributes.includes('ATTR_HYPER_CALCULATION')) {
                travelInfo.time = Math.max(1, Math.round(travelInfo.time * 0.75));
            }

            if (shipAttributes.includes('ATTR_SOLAR_HARMONY')) {
                const fromDist = DB.MARKETS.find(m => m.id === fromId)?.distance || 0;
                const toDist = DB.MARKETS.find(m => m.id === locationId)?.distance || 0;
                if (toDist < fromDist) {
                    travelInfo.fuelCost = 0;
                    this.uiManager.createFloatingText("Solar Harmony Active", window.innerWidth / 2, window.innerHeight / 2, '#fbbf24');
                }
            }

            if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) {
                travelInfo.fuelCost = 0;
                travelInfo.time *= 10;
            }

            shipAttributes.forEach(attrId => {
                const def = GameAttributes.getDefinition(attrId);
                if (def.type === ATTRIBUTE_TYPES.MOD_TRAVEL_TIME) {
                    if (attrId !== 'ATTR_HYPER_CALCULATION' && def.value) travelInfo.time *= def.value;
                }
                if (attrId === 'ATTR_SLEEPER') {
                    travelInfo.time *= 4.5;
                    travelInfo.fuelCost = 0;
                }
            });

            if (shipAttributes.includes('ATTR_SOLAR_SAIL')) {
                if (Math.random() < 0.15) {
                    travelInfo.fuelCost = 0;
                    travelInfo.time *= 2;
                    this.uiManager.createFloatingText("Solar Winds Caught!", window.innerWidth / 2, window.innerHeight / 2, '#60a5fa');
                }
            }

            const speedBonus = state.player.statModifiers?.travelSpeed || 0;
            if (speedBonus > 0) {
                travelInfo.time = travelInfo.time / (1 + speedBonus);
            }

            if (eventMods.travelTimeAdd) travelInfo.time += eventMods.travelTimeAdd;
            if (eventMods.travelTimeAddPercent) travelInfo.time *= (1 + eventMods.travelTimeAddPercent);
            if (eventMods.setTravelTime) travelInfo.time = eventMods.setTravelTime;
        }

        travelInfo.time = Math.max(0, Math.round(travelInfo.time)); 
        travelInfo.fuelCost = Math.round(travelInfo.fuelCost);

        const effectiveStats = this.simulationService.getEffectiveShipStats(activeShip.id);

        // --- ACHIEVEMENTS: NAVIGATION PRE-FLIGHT HOOKS ---
        const ach = this.simulationService.achievementService;
        if (ach) {
            const destId = locationId;
            const outerRim = ['loc_jupiter', 'loc_saturn', 'loc_uranus', 'loc_neptune', 'loc_kepler', 'loc_pluto'];
            const innerRim = ['loc_mercury', 'loc_venus', 'loc_earth', 'loc_mars', 'loc_luna'];
            
            if (innerRim.includes(destId)) ach.increment('jumpsInnerSystem', 1);
            if (outerRim.includes(destId)) ach.increment('jumpsOuterSystem', 1);
            if (destId === 'loc_belt') ach.increment('jumpsBelt', 1);

            const healthPct = activeShipState.health / effectiveStats.maxHealth;
            if (healthPct <= 0.20) ach.increment('transitLowHull', 1);

            ach.increment('totalTravelDays', travelInfo.time);
            if (travelInfo.time <= 2 && travelInfo.time > 0) ach.increment('jumpsShort', 1);
            if (travelInfo.time >= 100) ach.increment('jumpsLong', 1);

            let totalQty = 0, totalCap = 0;
            state.player.ownedShipIds.forEach(id => {
                const cap = this.simulationService.getEffectiveShipStats(id).cargoCapacity;
                const used = calculateInventoryUsed(state.player.inventories[id]);
                totalQty += used;
                totalCap += cap;
            });
            if (totalQty === 0) ach.increment('jumpsEmptyHold', 1);
            if (totalCap > 0 && totalQty >= totalCap) ach.increment('jumpsMaxCapacity', 1);
            
            const mono = state.achievements.metrics.monoTradeId;
            if (mono && mono !== 'FAILED') {
                ach.increment('consecutiveMonoTrades', 1);
            } else {
                ach.increment('consecutiveMonoTrades', 0, true); 
            }
            state.achievements.metrics.monoTradeId = null; 
        }

        if (activeShipState.fuel < travelInfo.fuelCost) {
            const originName = DB.MARKETS.find(m => m.id === fromId)?.name || "Origin";
            const lostDays = travelInfo.time;
            
            activeShipState.fuel = 0;
            this.timeService.advanceDays(lostDays);
            this.gameState.setState({ pendingTravel: null });
            
            this.logger.info.player(this.gameState.day, 'TRAVEL_STRANDED', `Stranded returning to ${originName}.`);
            
            if (this.uiManager.eventControl && this.uiManager.eventControl.showStrandedModal) {
                this.uiManager.eventControl.showStrandedModal(originName, lostDays);
            } else {
                this.uiManager.showEventResultModal(
                    "Critical Failure: Stranded",
                    `Event delays and route deviations have pushed your fuel requirements beyond your current reserves. <br><br>Your engines sputter and die, leaving you drifting in the void. After <span class="text-result-time">${lostDays}</span> grueling days on emergency life support, a passing freighter tows you back to <b>${originName}</b>.<br><br>The rescue fees have drained your remaining fuel. Your arbitrage run has failed.`,
                    [
                        { type: 'EFF_FUEL', value: 0 },
                        { type: 'EFF_TRAVEL_TIME', value: lostDays }
                    ]
                );
            }
            
            this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            return;
        }

        const hullStressMod = GameAttributes.getHullStressModifier(upgrades);
        let travelHullDamage = Math.ceil(baseTravelTime * GAME_RULES.HULL_DECAY_PER_TRAVEL_DAY * hullStressMod * 0.8);
        
        if (hasStatus('status_micro_fractures')) {
            travelHullDamage *= 1.20;
        }

        if (activeStateDef && activeStateDef.modifiers) {
            if (activeStateDef.modifiers.travelHullDecayMod) travelHullDamage *= activeStateDef.modifiers.travelHullDecayMod;
            if (activeStateDef.modifiers.travelHullDecayMitigation) travelHullDamage *= activeStateDef.modifiers.travelHullDecayMitigation;
        }

        if (shipAttributes.includes('ATTR_XENO_HULL') || 
            shipAttributes.includes('ATTR_FLUID_HULL') || 
            shipAttributes.includes('ATTR_NO_DECAY')) {
            travelHullDamage = 0;
        } else if (shipAttributes.includes('ATTR_RESILIENT')) {
            travelHullDamage *= 0.5;
        }
        
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) travelHullDamage *= DB.PERKS[PERK_IDS.NAVIGATOR].hullDecayMod;
        
        activeShipState.health -= travelHullDamage;
        this.simulationService._checkHullWarnings(activeShip.id);

        if (activeShipState.health <= 0) {
            this._handleShipDestruction(activeShip.id);
            return;
        }
        
        activeShipState.fuel -= travelInfo.fuelCost;

        const additionalShips = Math.max(0, this.gameState.player.ownedShipIds.length - 1);
        const convoyTaxRate = additionalShips * 0.02; 

        let convoyFuelTax = Math.max(0, Math.ceil(travelInfo.fuelCost * convoyTaxRate));
        let convoyHullTax = Math.max(0, Math.ceil(travelHullDamage * convoyTaxRate));

        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.convoyTaxWaiver) {
            convoyFuelTax = 0;
            convoyHullTax = 0;
        }

        if (convoyFuelTax > 0 || convoyHullTax > 0) {
            for (const shipId of this.gameState.player.ownedShipIds) {
                if (shipId === activeShip.id) continue;
                
                const inactiveState = this.gameState.player.shipStates[shipId];
                if (!inactiveState) continue;

                if (inactiveState.fuel > 25 && convoyFuelTax > 0) {
                    inactiveState.fuel = Math.max(25, inactiveState.fuel - convoyFuelTax);
                }
                if (inactiveState.health > 10 && convoyHullTax > 0) {
                    inactiveState.health = Math.max(10, inactiveState.health - convoyHullTax);
                }
            }
        }

        this.timeService.advanceDays(travelInfo.time);
        if (this.gameState.isGameOver) return;
        
        this.simulationService.newsTickerService.onLocationChange(locationId);
        
        if (typeof this.gameState.player.tripCount === 'undefined') {
            this.gameState.player.tripCount = 0;
        }
        this.gameState.player.tripCount++;

        if (shipAttributes.includes('ATTR_TRAVELLER') && this.gameState.player.tripCount % 20 === 0) {
            activeShipState.health = effectiveStats.maxHealth;
            activeShipState.fuel = effectiveStats.maxFuel;
            this.logger.info.player(state.day, 'ATTR_TRIGGER', 'Atlas systems engaged: Hull and Fuel fully restored.');
            this.uiManager.createFloatingText("Systems Restored", window.innerWidth / 2, window.innerHeight / 2, '#34d399');
        }

        if (shipAttributes.includes('ATTR_OSSEOUS_REGROWTH')) {
            const healAmount = effectiveStats.maxHealth * 0.10;
            if (activeShipState.health < effectiveStats.maxHealth) {
                activeShipState.health = Math.min(effectiveStats.maxHealth, activeShipState.health + healAmount);
                this.uiManager.createFloatingText("Hull Regenerated", window.innerWidth / 2, window.innerHeight / 2, '#e2e8f0');
            }
        }

        if (shipAttributes.includes('ATTR_FUEL_SCOOP')) {
            const fuelRestore = effectiveStats.maxFuel * 0.15;
            activeShipState.fuel = Math.min(effectiveStats.maxFuel, activeShipState.fuel + fuelRestore);
        }

        if (shipAttributes.includes('ATTR_MATTER_ABSORPTION') && !eventMods.useFoldedDrive) {
            const refund = travelInfo.fuelCost * 0.5;
            if (refund > 0) {
                activeShipState.fuel = Math.min(effectiveStats.maxFuel, activeShipState.fuel + refund);
                this.uiManager.createFloatingText(`Fuel Refunded: +${Math.round(refund)}`, window.innerWidth / 2, window.innerHeight / 2 + 30, '#991b1b');
            }
        }
        
        this.gameState.setState({ currentLocationId: locationId, pendingTravel: null, isTraveling: true });

        const fromLocation = DB.MARKETS.find(m => m.id === fromId);
        const destination = DB.MARKETS.find(m => m.id === locationId);
        
        if (!fromLocation || !destination) {
            this.logger.error('TravelService', `Invalid location ID provided for travel animation. From: ${fromId}, To: ${locationId}`);
            this.uiManager.queueModal('event-modal', 'Navigation Error', 'Could not plot a course. The destination is unknown.');
            return;
        }

        const totalHullDamagePercentForDisplay = (travelHullDamage / effectiveStats.maxHealth) * 100;
        
        this.logger.info.player(this.gameState.day, 'TRAVEL_END', `Arrived at ${locationId}.`, {
            fuelUsed: travelInfo.fuelCost,
            hullDamage: totalHullDamagePercentForDisplay.toFixed(2) + '%'
        });

        const finalCallback = () => {
            this.gameState.isTraveling = false;

            // --- ACHIEVEMENTS: POST-FLIGHT ARRIVAL HOOKS ---
            if (this.simulationService.achievementService) {
                const achievementService = this.simulationService.achievementService;
                achievementService.increment('docked_' + locationId, 1);
                
                const fuelPct = activeShipState.fuel / effectiveStats.maxFuel;
                if (fuelPct <= 0.05) achievementService.increment('arriveLowFuel', 1);
                
                const arrivalHealthPct = Math.round((activeShipState.health / effectiveStats.maxHealth) * 100);
                if (arrivalHealthPct === 1) achievementService.increment('arriveCriticalHull', 1);
            }

            if (!eventMods.useFoldedDrive && this.gameState.pendingEventChains && this.gameState.pendingEventChains.length > 0) {
                this.gameState.pendingEventChains.forEach(chain => {
                    chain.tripsRemaining--;
                });
            }
            
            if (this.simulationService.missionService) {
                this.simulationService.missionService.checkTriggers();
            }

            if (this.simulationService.intelService) {
                this.simulationService.intelService.evaluateHotIntelTrigger();
            }

            if (this.simulationService.toastService) {
                this.simulationService.toastService.evaluateArrivalTriggers();
            }

            if (locationId === 'sol' && this.timeService.solStationService) {
                if (typeof this.timeService.solStationService.catchUpDays === 'function') {
                    this.timeService.solStationService.catchUpDays(this.gameState.day);
                    this.timeService.solStationService.startLocalLiveLoop();
                }
            }

            this.simulationService.saveGame();

            const isTut5Active = this.gameState.missions?.activeMissionIds?.includes('mission_tutorial_05');
            if (isTut5Active && locationId === LOCATION_IDS.LUNA) {
                this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            } else if (this.gameState.tutorials.activeBatchId === 'intro_missions' && this.gameState.tutorials.activeStepId === 'mission_1_7' && locationId === LOCATION_IDS.LUNA) {
                this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            } else {
                this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            }
        };
        
        this.uiManager.showTravelAnimation(fromLocation, destination, travelInfo, totalHullDamagePercentForDisplay, finalCallback);
    }
    
    resumeTravel() {
        if (!this.gameState.pendingTravel) return;
        this.logger.info.system('Game', this.gameState.day, 'TRAVEL_RESUME', 'Resuming travel after event.');
        const { destinationId, ...eventMods } = this.gameState.pendingTravel;
        this.initiateTravel(destinationId, eventMods);
    }

    _checkForRandomEvent(destinationId, force = false) {
        if (this.gameState.pendingEventChains && this.gameState.pendingEventChains.length > 0) {
            const readyIndex = this.gameState.pendingEventChains.findIndex(c => c.tripsRemaining <= 0);
            if (readyIndex !== -1) {
                const chain = this.gameState.pendingEventChains[readyIndex];
                const eventId = chain.followUpEventId;
                
                this.gameState.pendingEventChains.splice(readyIndex, 1);
                
                const event = DB.RANDOM_EVENTS.find(e => e.id === eventId);
                if (event) {
                    this.logger.info.system('Event', this.gameState.day, 'EVENT_TRIGGER_CHAIN', `Triggered chained event: ${event.title}`);
                    const baseTime = this.gameState.TRAVEL_DATA[this.gameState.currentLocationId]?.[destinationId]?.time || 7;
                    this.gameState.setState({ pendingTravel: { destinationId, days: baseTime } });
                    
                    // --- PHASE 4: Initiate Warp Background early ---
                    starfieldService.setEngageWarp();

                    this.uiManager.showRandomEventModal(event, (choiceId) => this._resolveEventChoice(event.id, choiceId));
                    return true;
                }
            }
        }

        const systemState = this.gameState.systemState;
        const activeStateDef = systemState && systemState.activeId ? DB.SYSTEM_STATES[systemState.activeId] : null;
        
        if (activeStateDef && activeStateDef.modifiers && activeStateDef.modifiers.hazardsRemoved) {
             return false; 
        }

        const activeShip = this.simulationService._getActiveShip();
        const shipState = this.gameState.player.shipStates[activeShip.id];
        const upgrades = shipState.upgrades || [];
        const shipAttributes = GameAttributes.getShipAttributes(activeShip.id);
        const statusEffects = shipState.statusEffects || [];
        const currentLoc = this.gameState.currentLocationId;
        
        let eventChance = GAME_RULES.RANDOM_EVENT_CHANCE;

        if (this.debugAlwaysTriggerEvents) {
            eventChance = 1.0;
            this.logger.warn('TravelService', 'DEBUG: Event chance forced to 100%.');
        }

        const chanceMod = GameAttributes.getEventChanceModifier(upgrades);
        eventChance += chanceMod;

        if (statusEffects.some(s => s.id === 'status_corporate_blacklist')) {
             eventChance *= 1.40;
        }

        const baseTime = this.gameState.TRAVEL_DATA[currentLoc]?.[destinationId]?.time || 7;
        if (baseTime > 0) {
            eventChance += ((baseTime / 3) * 0.005);
        }

        if (shipAttributes.includes('ATTR_ADVANCED_COMMS')) {
            eventChance *= 1.25;
        }

        if (force === false && Math.random() > eventChance) return false;

        let event;

        if (typeof force === 'number') {
            event = DB.RANDOM_EVENTS[force];
        } else {
            const contextTags = [EVENT_CONSTANTS.TAGS.SPACE]; 
            event = this.randomEventService.tryTriggerEvent(this.gameState, this.simulationService, contextTags);
        }
        
        if (!event) return false;
        
        this.logger.info.system('Event', this.gameState.day, 'EVENT_TRIGGER', `Triggered random event: ${event.title}`);
        
        this.gameState.setState({ pendingTravel: { destinationId, days: baseTime } });

        // --- PHASE 4: Initiate Warp Background early ---
        starfieldService.setEngageWarp();
        
        this.uiManager.showRandomEventModal(event, (choiceId) => this._resolveEventChoice(event.id, choiceId));
        return true;
    }

    _resolveEventChoice(eventId, choiceId) {
        const result = this.randomEventService.resolveChoice(eventId, choiceId, this.gameState, this.simulationService);

        if (!result) {
            this.logger.error('TravelService', 'Event resolution returned null.');
            this.resumeTravel();
            return;
        }

        this.logger.info.player(this.gameState.day, 'EVENT_CHOICE', `Chose outcome: ${result.outcomeId}`);
        
        if (this.uiManager.eventControl && this.uiManager.eventControl.showEventResultModal) {
            this.uiManager.eventControl.showEventResultModal(
                result.title,
                result.text,
                result.effects,
                () => this._postEventCheck()
            );
        } else if (this.uiManager.showEventResultModal) {
            this.uiManager.showEventResultModal(
                result.title,
                result.text,
                result.effects,
                () => this._postEventCheck()
            );
        }
    }

    _postEventCheck() {
        const ship = this.simulationService._getActiveShip();
        if (!ship) { 
            this.resumeTravel(); 
            return; 
        }

        if (ship.health <= 0) {
            this.gameState.pendingTravel = null;
            this._handleShipDestruction(ship.id);
            return;
        }

        if (ship.fuel <= 0) {
            this.gameState.player.shipStates[ship.id].fuel = 0;
        }

        this.resumeTravel();
    }

    _handleShipDestruction(shipId) {
        if (Math.random() <= 0.33) {
            this._handleShipDisabledAndTowed(shipId);
        } else {
            this._executeShipDestruction(shipId);
        }
    }

    _handleShipDisabledAndTowed(shipId) {
        const state = this.gameState.getState();
        const shipState = this.gameState.player.shipStates[shipId];
        const originName = DB.MARKETS.find(m => m.id === state.currentLocationId)?.name || "Origin";
        const lostDays = 21;

        shipState.health = 1;
        shipState.fuel = 0;

        starfieldService.triggerQuickExit();
        const travelModal = document.getElementById('travel-animation-modal');
        if (travelModal) travelModal.classList.add('hidden');

        this.timeService.advanceDays(lostDays);
        this.gameState.setState({ pendingTravel: null });

        this.logger.info.player(this.gameState.day, 'TRAVEL_TOWED', `Ship disabled and towed back to ${originName}. Lost ${lostDays} days.`);

        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.SERVICES);

        this.uiManager.showEventResultModal(
            "Critical Failure: Systems Dead",
            `Your ship suffered catastrophic system failure during transit. Drifting in the void for weeks on failing life support, you were eventually found by a passing deep-space freighter and towed back to <b>${originName}</b>.<br><br>Your ship survived, but just barely.`,
            [
                { type: 'EFF_HULL', value: -1 }, 
                { type: 'EFF_FUEL', value: 0 },
                { type: 'EFF_TRAVEL_TIME', value: lostDays }
            ]
        );
    }

    _executeShipDestruction(shipId) {
        const shipName = DB.SHIPS[shipId].name;
        this.logger.error('TravelService', `Ship ${shipName} was destroyed.`);
        
        const isGameOver = this.gameState.player.ownedShipIds.length <= 1;

        if (!isGameOver) {
            starfieldService.triggerQuickExit();
        } else {
            if (starfieldService.setDecelerateWarp) {
                starfieldService.setDecelerateWarp();
            }
        }
        
        const travelModal = document.getElementById('travel-animation-modal');
        if (travelModal) {
            travelModal.classList.add('hidden');
            travelModal.classList.remove('modal-hiding', 'dismiss-disabled');
        }

        const gameContainer = document.getElementById('game-container');
        if (isGameOver && gameContainer) {
            gameContainer.style.opacity = '0';
            gameContainer.style.pointerEvents = 'none';
        }

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.zIndex = '9999'; 
        overlay.style.pointerEvents = 'none';
        document.body.appendChild(overlay);

        const animation = overlay.animate([
            { backgroundColor: 'transparent', offset: 0 },
            { backgroundColor: '#991b1b', offset: 0.6 }, 
            { backgroundColor: '#000000', offset: 1 }    
        ], {
            duration: 5000,
            fill: 'forwards',
            easing: 'ease-in-out'
        });

        animation.onfinish = () => {
            this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
            delete this.gameState.player.shipStates[shipId];
            delete this.gameState.player.inventories[shipId];
            this.gameState.pendingTravel = null; 

            this.gameState.setState({});

            if (isGameOver) {
                const fadeOut = overlay.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: 1000, fill: 'forwards' });
                
                fadeOut.onfinish = () => {
                    overlay.remove();
                    this.simulationService._gameOver(`Your last ship, the ${shipName}, was destroyed. Your trading career ends here.`);
                };
            } else {
                this.gameState.player.activeShipId = this.gameState.player.ownedShipIds[0];
                const newShipName = DB.SHIPS[this.gameState.player.activeShipId].name;
                const message = `The ${shipName} suffered a catastrophic hull breach and was destroyed. All cargo was lost.<br><br>You now command your backup vessel, the ${newShipName}.`;
                
                this.uiManager.queueModal('event-modal', 'Vessel Lost', message, () => {
                    this.simulationService.setHangarShipyardMode('hangar');
                    this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                }, { dismissOutside: false });

                const fadeOut = overlay.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: 1000, fill: 'forwards' });
                
                fadeOut.onfinish = () => overlay.remove();
            }
        };
    }
}