/**
 * MissionService.js
 * * THE MISSION ENGINE
 * * This service is now a generic logic processor. It does not know about specific missions.
 * It strictly follows the instructions provided by the MissionRegistry data.
 * * Workflow:
 * 1. Event happens in game (e.g. 'ENEMY_KILLED') -> Game calls MissionService.handleEvent()
 * 2. Service checks all ACTIVE missions.
 * 3. If event matches a mission objective, progress is updated.
 * 4. If all objectives in a mission are done, mission is completed.
 */

class MissionService {
    constructor() {
        this.activeMissions = []; // Array of hydrated mission objects with current progress
        this.completedMissionIds = []; // Array of strings (IDs)
        this.missionHistory = []; // Log of past completions for stats
        
        // Internal event mapping to optimize lookups
        // Key: EventType (string), Value: Array of MissionIDs listening for this
        this.eventListeners = new Map();
    }

    init() {
        console.log("MissionService: Engine Initialized.");
        // Load save data here if applicable in future phases
        // this.loadState(); 
        
        // Initial check for auto-start missions (like the Intro)
        this.checkForNewMissions();
    }

    /**
     * The heartbeat of the system.
     * Checks the Registry for any missions that match current player state.
     */
    checkForNewMissions() {
        if (!window.MissionRegistry) return;

        // Get all known definitions
        window.MissionRegistry.definitions.forEach(missionDef => {
            // 1. Skip if already active or completed
            if (this.isMissionActive(missionDef.id) || this.isMissionCompleted(missionDef.id)) {
                return;
            }

            // 2. Check Prerequisites (The Gating System)
            // We pass a mock 'gameState' - in a real scenario, pass the actual Game.state object
            const gameState = {
                completedMissions: this.completedMissionIds,
                level: window.Game?.state?.level || 1,
                credits: window.Game?.state?.credits || 0
            };

            if (window.MissionRegistry.isMissionAvailable(missionDef.id, gameState)) {
                // 3. Auto-accept logic (if mission type implies it, e.g. 'tutorial')
                // Later, this can be moved to a "Mission Board" UI check
                if (missionDef.type === 'tutorial' || missionDef.auto_start) {
                    this.startMission(missionDef.id);
                }
            }
        });
    }

    /**
     * Activates a mission from the Registry.
     * Hydrates the static data into a dynamic tracking object.
     */
    startMission(missionId) {
        const def = window.MissionRegistry.getMission(missionId);
        if (!def) {
            console.error(`MissionService: Cannot start unknown mission '${missionId}'`);
            return;
        }

        console.log(`MissionService: Starting mission '${def.title}'`);

        // Create a tracking object (The instance)
        const missionInstance = {
            id: def.id,
            objectives: def.objectives.map(obj => ({
                id: obj.id,
                current: 0,
                target: obj.count || 1,
                isComplete: false,
                definition: obj // Reference to static logic
            })),
            startTime: Date.now()
        };

        this.activeMissions.push(missionInstance);
        
        // Map listeners for performance (O(1) lookup instead of iterating all missions on every click)
        this.mapEventListeners();

        // Notify UI
        if (window.UIManager) {
            // UIManager.updateMissionTracker(); // Hypothetical hook
            // UIManager.showToast(`Mission Started: ${def.title}`);
        }
    }

    /**
     * Re-calculates which events we need to listen for based on active missions.
     * Optimization: Prevents checking 'MINING' events if no mining missions are active.
     */
    mapEventListeners() {
        this.eventListeners.clear();
        
        this.activeMissions.forEach(mission => {
            mission.objectives.forEach(obj => {
                if (!obj.isComplete) {
                    const evt = obj.definition.target_event;
                    if (!this.eventListeners.has(evt)) {
                        this.eventListeners.set(evt, []);
                    }
                    this.eventListeners.get(evt).push({
                        missionId: mission.id,
                        objectiveId: obj.id
                    });
                }
            });
        });
    }

    /**
     * CORE ENGINE METHOD
     * Called by Game.js whenever something interesting happens.
     * @param {string} eventType - e.g., "PLAYER_BOUGHT_ITEM", "ENEMY_KILLED"
     * @param {object} eventData - Context (e.g., { itemId: "fuel", quantity: 1 })
     */
    handleEvent(eventType, eventData = {}) {
        // 1. Fast exit if no missions care about this event
        if (!this.eventListeners.has(eventType)) return;

        // 2. Iterate listeners
        const listeners = this.eventListeners.get(eventType);
        let progressMade = false;

        listeners.forEach(listener => {
            const mission = this.activeMissions.find(m => m.id === listener.missionId);
            if (!mission) return;

            const objective = mission.objectives.find(o => o.id === listener.objectiveId);
            if (!objective || objective.isComplete) return;

            // 3. Verify Criteria (e.g. did they buy the *right* item?)
            // This relies on the 'target' field in the JSON data matching eventData
            // Simple implementation: If definition has 'required_item', check eventData.itemId
            const def = objective.definition;
            let matches = true;

            if (def.required_item && def.required_item !== eventData.itemId) matches = false;
            if (def.required_target && def.required_target !== eventData.targetId) matches = false;

            if (matches) {
                // 4. Update Progress
                objective.current += (eventData.quantity || 1);
                if (objective.current >= objective.target) {
                    objective.current = objective.target;
                    objective.isComplete = true;
                    console.log(`MissionService: Objective '${def.text}' Complete!`);
                }
                progressMade = true;
            }
        });

        if (progressMade) {
            this.checkCompletions();
            this.mapEventListeners(); // Remap to stop listening for completed objectives
        }
    }

    /**
     * Checks if any active missions have all objectives fulfilled.
     */
    checkCompletions() {
        // Filter out completed missions
        const newlyCompleted = [];
        
        this.activeMissions = this.activeMissions.filter(mission => {
            const allDone = mission.objectives.every(obj => obj.isComplete);
            
            if (allDone) {
                newlyCompleted.push(mission);
                return false; // Remove from active
            }
            return true; // Keep in active
        });

        // Process completions
        newlyCompleted.forEach(mission => {
            this.completeMission(mission.id);
        });
    }

    completeMission(missionId) {
        const def = window.MissionRegistry.getMission(missionId);
        this.completedMissionIds.push(missionId);
        
        console.log(`MissionService: MISSION COMPLETE - ${def.title}`);

        // 1. Grant Rewards
        if (def.rewards) {
            this.grantRewards(def.rewards);
        }

        // 2. Trigger Next Steps (Chaining)
        if (def.on_complete) {
            if (def.on_complete.trigger_event) {
                // Example: Triggering a generic event that the Tutorial system listens to
                // window.Game.emit(def.on_complete.trigger_event, def.on_complete.trigger_args);
            }
            
            if (def.on_complete.auto_accept_next) {
                this.startMission(def.on_complete.auto_accept_next);
            }
        }

        // 3. Refresh available missions (newly unlocked stuff)
        this.checkForNewMissions();
    }

    grantRewards(rewards) {
        // Hook into Player/Game state
        if (rewards.credits) {
            console.log(`> Reward: ${rewards.credits} Credits`);
            if (window.Game) window.Game.state.credits += rewards.credits;
        }
        if (rewards.xp) {
            console.log(`> Reward: ${rewards.xp} XP`);
        }
        // Add item logic here
    }

    // --- Utility ---

    isMissionActive(id) {
        return this.activeMissions.some(m => m.id === id);
    }

    isMissionCompleted(id) {
        return this.completedMissionIds.includes(id);
    }
}

// Global Singleton
window.MissionService = new MissionService();