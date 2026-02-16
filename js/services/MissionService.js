// js/services/MissionService.js
/**
 * @fileoverview Manages the state and flow of player missions.
 * Orchestrates the MissionObjectiveEvaluator and MissionTriggerEvaluator.
 */
import { DB } from '../data/database.js';
import { formatCredits } from '../utils.js';
import { MissionObjectiveEvaluator } from './mission/MissionObjectiveEvaluator.js';
import { MissionTriggerEvaluator } from './mission/MissionTriggerEvaluator.js';

export class MissionService {
    /**
     * @param {import('./GameState.js').GameState} gameState The central game state.
     * @param {import('./UIManager.js').UIManager} uiManager The UI manager instance.
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(gameState, uiManager, logger) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.simulationService = null; // Will be injected post-instantiation
        
        // Initialize Logic Engines
        this.objectiveEvaluator = new MissionObjectiveEvaluator();
        this.triggerEvaluator = new MissionTriggerEvaluator();
    }

    /**
     * Injects the SimulationService after all services have been instantiated.
     * @param {import('./SimulationService.js').SimulationService} simulationService
     */
    setSimulationService(simulationService) {
        this.simulationService = simulationService;
    }

    /**
     * Checks if all prerequisites for a given mission are met.
     * Delegates to MissionTriggerEvaluator.
     * @param {string} missionId The ID of the mission to check.
     * @returns {boolean} True if all prerequisites are met, false otherwise.
     */
    arePrerequisitesMet(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission) return false;
        
        // Support both old 'prerequisites' and new 'triggers' fields
        const constraints = mission.triggers || mission.prerequisites;
        
        return this.triggerEvaluator.checkAll(constraints, this.gameState);
    }
    
    /**
     * Gets a list of all missions that are currently available to the player.
     * A mission is available if it's not active, not completed, and its triggers are met.
     * EXCLUDES 'DEBUG' TYPE MISSIONS.
     * @returns {Array<object>} An array of available mission objects.
     */
    getAvailableMissions() {
        const { activeMissionIds, completedMissionIds } = this.gameState.missions;
        return Object.values(DB.MISSIONS).filter(mission => {
            const isAvailable =
                !activeMissionIds.includes(mission.id) &&
                !completedMissionIds.includes(mission.id) &&
                mission.type !== 'DEBUG' && // [FIX] Hide debug missions from standard terminal
                this.arePrerequisitesMet(mission.id);
            return isAvailable;
        });
    }

    /**
     * Generates and injects a set of test missions into the database.
     * Covers various Hosts and Objective types with trivial requirements.
     */
    injectTestMissions() {
        const timestamp = Date.now();
        const testMissions = [
            {
                id: `test_station_delivery_${timestamp}`,
                name: '[TEST] Station Delivery',
                type: 'DELIVERY', // Standard type
                host: 'STATION', // Host A
                description: 'Simple delivery test. Deliver 1 Water Ice.',
                triggers: [], // Always available
                objectives: [
                    { id: 'obj_deliver_ice', type: 'DELIVER_ITEM', goodId: 'water_ice', quantity: 1 }
                ],
                providedCargo: [{ goodId: 'water_ice', quantity: 1 }],
                completion: {
                    locationId: null,
                    title: 'Delivery Success',
                    text: 'Station delivery logic verified.',
                    buttonText: 'Close'
                },
                rewards: [{ type: 'credits', amount: 100 }]
            },
            {
                id: `test_guild_travel_${timestamp}`,
                name: '[TEST] Guild Travel',
                type: 'TRAVEL', // Standard type
                host: 'GUILD', // Host B
                description: 'Simple travel test. Travel to any location.',
                triggers: [],
                objectives: [
                    { id: 'obj_travel_luna', type: 'TRAVEL_TO', target: 'loc_luna' } // Trivial target
                ],
                completion: {
                    locationId: null,
                    title: 'Travel Success',
                    text: 'Guild travel logic verified.',
                    buttonText: 'Close'
                },
                rewards: [{ type: 'item', goodId: 'propellant', quantity: 10 }]
            },
            {
                id: `test_syndicate_wealth_${timestamp}`,
                name: '[TEST] Syndicate Wealth',
                type: 'WEALTH',
                host: 'SYNDICATE', // Host C
                description: 'Simple wealth check. Have > 1 Credit.',
                triggers: [],
                objectives: [
                    { id: 'obj_wealth_check', type: 'WEALTH_CHECK', value: 1 }
                ],
                completion: {
                    locationId: null,
                    title: 'Wealth Success',
                    text: 'Syndicate wealth logic verified.',
                    buttonText: 'Pay Up'
                },
                rewards: [{ type: 'credits', amount: 666 }]
            },
            {
                id: `test_unknown_cargo_${timestamp}`,
                name: '[TEST] Unknown Protocol (Item)',
                type: 'STATUS', // [[FIX]] Renamed from MYSTERY
                host: 'UNKNOWN', // Host D
                description: 'Tests checking CARGO for Propellant (Item).',
                triggers: [],
                objectives: [
                    { id: 'obj_check_prop', type: 'have_item', goodId: 'propellant', quantity: 1 }
                ],
                completion: {
                    locationId: null,
                    title: 'Cargo Verified',
                    text: 'Inventory item check successful.',
                    buttonText: 'End'
                },
                rewards: [{ type: 'credits', amount: 5000 }]
            },
            {
                id: `test_unknown_tank_${timestamp}`,
                name: '[TEST] Unknown Protocol (Tank)',
                type: 'STATUS', // [[FIX]] Renamed from MYSTERY
                host: 'UNKNOWN', // Host D
                description: 'Tests checking SHIP TANK for Fuel Level.',
                triggers: [],
                objectives: [
                    { id: 'obj_check_tank', type: 'have_fuel_tank', value: 10 }
                ],
                completion: {
                    locationId: null,
                    title: 'Tank Verified',
                    text: 'Ship fuel tank logic verified.',
                    buttonText: 'Ignite'
                },
                rewards: [{ type: 'credits', amount: 5000 }]
            },
            {
                id: `test_maintenance_std_${timestamp}`,
                name: '[TEST] Maintenance Standard',
                type: 'INSPECTION',
                host: 'GUILD', 
                description: 'Requires Hull Integrity >= 90%. Repair if needed.',
                triggers: [],
                objectives: [
                    { id: 'obj_check_hull', type: 'HAVE_HULL_PCT', value: 90, comparator: '>=' }
                ],
                completion: {
                    locationId: null,
                    title: 'Inspection Passed',
                    text: 'Your ship meets Guild safety standards.',
                    buttonText: 'OK'
                },
                rewards: [{ type: 'credits', amount: 250 }]
            },
            {
                id: `test_ghost_run_${timestamp}`,
                name: '[TEST] Ghost Run',
                type: 'SMUGGLING',
                host: 'SYNDICATE',
                description: 'Requires Empty Cargo Hold (0% Usage). Sell everything.',
                triggers: [],
                objectives: [
                    { id: 'obj_check_cargo_pct', type: 'HAVE_CARGO_PCT', value: 0, comparator: '<=' }
                ],
                completion: {
                    locationId: null,
                    title: 'Ghost Run Complete',
                    text: 'You arrived clean. Good work.',
                    buttonText: 'Vanish'
                },
                rewards: [{ type: 'credits', amount: 2000 }]
            }
        ];

        // Inject into DB
        testMissions.forEach(m => {
            DB.MISSIONS[m.id] = m;
        });

        this.logger.warn('MissionService', `Injected ${testMissions.length} Test Missions into Mission Terminal.`);
        
        // Force refresh of the UI to show new missions in the terminal
        if (this.uiManager) {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Accepts a new mission, setting it as active.
     * @param {string} missionId The ID of the mission to accept.
     * @param {boolean} [force=false] If true, bypasses checks.
     */
    acceptMission(missionId, force = false) {
        const mission = DB.MISSIONS[missionId];
        
        // 1. Validation (skipped if forced)
        if (!force) {
            // Check max missions (4)
            if (this.gameState.missions.activeMissionIds.length >= 4) {
                this.logger.warn('MissionService', `Cannot accept ${missionId}: Mission log full (4/4).`);
                return;
            }
            if (!mission || !this.arePrerequisitesMet(missionId)) {
                return;
            }
        }

        // 2. Handle Existing (Prevent Duplicate)
        if (this.gameState.missions.activeMissionIds.includes(missionId)) {
            return; 
        }

        // 3. Initialize State
        this.gameState.missions.activeMissionIds.push(missionId);
        
        // Initialize progress with isCompletable flag
        this.gameState.missions.missionProgress[missionId] = {
            objectives: {},
            isCompletable: false
        };

        // [[NEW]] Auto-track logic: If no mission is being tracked, track this one.
        if (!this.gameState.missions.trackedMissionId) {
            this.gameState.missions.trackedMissionId = missionId;
        }
        
        this.logger.info.player(this.gameState.day, 'MISSION_ACCEPT', `Accepted mission: ${missionId} ${force ? '(FORCED)' : ''}`);
        
        // 4. Grant Start Items
        if (this.simulationService) {
            this.simulationService.grantMissionCargo(missionId);
        }
        
        // 5. Initial Check & Render
        this.checkTriggers(); 

        // If the mission has no objectives, complete it immediately.
        if (!mission.objectives || mission.objectives.length === 0) {
            this.completeMission(missionId, force);
        } else {
            this.uiManager.render(this.gameState.getState());
        }
    }

    /**
     * Abandons a specific active mission.
     * @param {string} missionId - The ID of the mission to abandon.
     */
    abandonMission(missionId) {
        if (!missionId || !this.gameState.missions.activeMissionIds.includes(missionId)) return;

        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        // We do NOT delete from missionProgress to preserve partial progress if re-accepted.
        // But we DO reset isCompletable to be safe.
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // [[NEW]] Logic: If abandoned mission was tracked, clear tracking or pick next.
        if (this.gameState.missions.trackedMissionId === missionId) {
            // Pick next active mission or null
            const nextMission = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMission || null;
        }

        this.logger.info.player(this.gameState.day, 'MISSION_ABANDON', `Abandoned mission: ${missionId}`);
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Checks all mission triggers against the current game state.
     * Iterates through ALL active missions and evaluates objectives using the Logic Engine.
     * [[UPDATED]] Supports silent execution for render loop integration.
     * @param {boolean} [suppressNotify=false] - If true, mutates state but skips setState/render to avoid loops.
     */
    checkTriggers(suppressNotify = false) {
        const { activeMissionIds } = this.gameState.missions;
        if (!activeMissionIds || activeMissionIds.length === 0) return;
    
        let stateChanged = false;

        activeMissionIds.forEach(missionId => {
            const mission = DB.MISSIONS[missionId];
            if (!mission) return;

            let allObjectivesMet = true;
            let progressChanged = false;
            
            // Ensure progress object exists
            if (!this.gameState.missions.missionProgress[missionId]) {
                this.gameState.missions.missionProgress[missionId] = { objectives: {}, isCompletable: false };
            }
            const progress = this.gameState.missions.missionProgress[missionId];

            if (mission.objectives) {
                mission.objectives.forEach(obj => {
                    // [[FIX]] Pass simulationService to enable advanced checks (Effective Stats)
                    const result = this.objectiveEvaluator.evaluate(obj, this.gameState, this.simulationService);
                    
                    // Identify the objective (fallback to legacy goodId if no specific ID)
                    const objKey = obj.id || obj.goodId;
                    
                    if (!progress.objectives[objKey]) {
                        progress.objectives[objKey] = { current: 0, target: result.target };
                    }

                    // Check for value change
                    if (progress.objectives[objKey].current !== result.current) {
                        progress.objectives[objKey].current = result.current;
                        progress.objectives[objKey].target = result.target; // Update target just in case
                        progressChanged = true;
                    }

                    // Check for Met status
                    if (!result.isMet) {
                        allObjectivesMet = false;
                    }
                });
            } else {
                // No objectives = auto meet
                allObjectivesMet = true;
            }

            // Update Completion Status
            if (progress.isCompletable !== allObjectivesMet) {
                progress.isCompletable = allObjectivesMet;
                stateChanged = true;
                if (allObjectivesMet && !suppressNotify) {
                    this.logger.info.player(this.gameState.day, 'OBJECTIVES_MET', `All objectives for mission ${missionId} are met.`);
                }
            }

            if (progressChanged) stateChanged = true;
        });
    
        // Only update state and re-render if there's a change AND we aren't suppressing notifications.
        if (stateChanged && !suppressNotify) {
            this.gameState.setState({}); // Set the new state
            this.uiManager.render(this.gameState.getState()); // Trigger a full re-render
            this.uiManager.flashObjectiveProgress();
        }
    }

    /**
     * Completes a specific active mission.
     * @param {string} missionId - The ID of the mission to complete.
     * @param {boolean} [force=false] If true, bypasses "Objectives Met" check.
     */
    completeMission(missionId, force = false) {
        if (!this.gameState.missions.activeMissionIds.includes(missionId)) return;
        
        const mission = DB.MISSIONS[missionId];
        const progress = this.gameState.missions.missionProgress[missionId];
        
        // Check Conditions
        const isCompletable = progress ? progress.isCompletable : false;
        const noObjectives = !mission.objectives || mission.objectives.length === 0;
        
        if (!isCompletable && !noObjectives && !force) {
            return; // Can't complete yet
        }

        // 1. Deduct objective items (if applicable) using Sequential Fleet Drain
        if (mission.objectives) {
            mission.objectives.forEach(obj => {
                // Only deduct if it's an item delivery type
                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
                    const itemId = obj.goodId || obj.target;
                    let remainingToRemove = obj.quantity || 1;
                    
                    if (remainingToRemove > 0) {
                        const activeShipId = this.gameState.player.activeShipId;
                        const shipInventories = [];
                        
                        for (const shipId of this.gameState.player.ownedShipIds) {
                            const qty = this.gameState.player.inventories[shipId]?.[itemId]?.quantity || 0;
                            // Sort heuristic requires maxCapacity
                            const maxCapacity = this.simulationService ? 
                                this.simulationService.getEffectiveShipStats(shipId).cargoCapacity : 
                                (DB.SHIPS[shipId]?.cargoCapacity || 100);
                            
                            shipInventories.push({ shipId, qty, maxCapacity });
                        }

                        // Sort: Active ship first, then remaining inactive ships by max capacity descending
                        shipInventories.sort((a, b) => {
                            if (a.shipId === activeShipId) return -1;
                            if (b.shipId === activeShipId) return 1;
                            return b.maxCapacity - a.maxCapacity;
                        });

                        for (const shipData of shipInventories) {
                            if (remainingToRemove <= 0) break;
                            const toRemove = Math.min(remainingToRemove, shipData.qty);
                            if (toRemove > 0) {
                                const invItem = this.gameState.player.inventories[shipData.shipId][itemId];
                                invItem.quantity -= toRemove;
                                if (invItem.quantity === 0) invItem.avgCost = 0;
                                remainingToRemove -= toRemove;
                            }
                        }
                    }
                }
            });
        }

        // 2. Grant rewards
        if (this.simulationService) {
            this.simulationService._grantRewards(mission.rewards, mission.name);
        }
        this.logger.info.player(this.gameState.day, 'MISSION_COMPLETE', `Completed mission: ${missionId} ${force ? '(FORCED)' : ''}`);

        // 3. Update mission state
        this.gameState.missions.completedMissionIds.push(missionId);
        this.gameState.missions.activeMissionIds = this.gameState.missions.activeMissionIds.filter(id => id !== missionId);
        
        // Cleanup progress if desired, though keeping it is fine for history. 
        if (this.gameState.missions.missionProgress[missionId]) {
            this.gameState.missions.missionProgress[missionId].isCompletable = false;
        }

        // [[NEW]] Auto-Track Logic: If the completed mission was being tracked, auto-track the next one in the list.
        if (this.gameState.missions.trackedMissionId === missionId) {
            // Grab the next available active mission (the list was already filtered above)
            const nextMissionId = this.gameState.missions.activeMissionIds[0];
            this.gameState.missions.trackedMissionId = nextMissionId || null;
        }

        // 4. Update state and re-render
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());
    }
}