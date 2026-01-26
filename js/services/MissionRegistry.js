/**
 * MissionRegistry.js
 * * Central database for all mission definitions.
 * Decouples logic (MissionService) from content (Mission Data).
 * Allows for modular loading of mission packs (e.g. Intro, Act 1, Side Quests).
 */

const MissionRegistry = {
    // storage for all loaded definitions
    definitions: new Map(),
    
    // Categorization for faster lookups
    categories: {
        story: new Set(),
        side: new Set(),
        dynamic: new Set(),
        tutorial: new Set()
    },

    /**
     * Loads a pack of missions into the game.
     * @param {Array} missionPack - Array of MissionDefinition objects
     */
    registerPack: function(missionPack) {
        if (!Array.isArray(missionPack)) {
            console.error("MissionRegistry: Failed to register pack. Expected Array.");
            return;
        }

        missionPack.forEach(mission => {
            if (this.validateMission(mission)) {
                this.definitions.set(mission.id, mission);
                
                // Index by type/category
                const type = mission.type || 'side';
                if (!this.categories[type]) {
                    this.categories[type] = new Set();
                }
                this.categories[type].add(mission.id);
            }
        });

        console.log(`MissionRegistry: Loaded ${missionPack.length} missions.`);
    },

    /**
     * specific lookup for a mission by ID
     */
    getMission: function(id) {
        return this.definitions.get(id);
    },

    /**
     * Validates that a mission object has the required schema structure.
     * Essential for the future 'Mission Maker' app integration.
     */
    validateMission: function(mission) {
        const requiredFields = ['id', 'title', 'type'];
        const missing = requiredFields.filter(field => !mission[field]);
        
        if (missing.length > 0) {
            console.error(`MissionRegistry: Invalid mission ${mission.id || 'unknown'}. Missing: ${missing.join(', ')}`);
            return false;
        }
        return true;
    },

    /**
     * Evaluates if a mission is available to the player based on state.
     * @param {string} missionId 
     * @param {object} gameState - The entire player state object
     * @returns {boolean}
     */
    isMissionAvailable: function(missionId, gameState) {
        const mission = this.definitions.get(missionId);
        if (!mission) return false;

        // 1. Check Prerequisite Missions
        if (mission.prerequisites && mission.prerequisites.completed_missions) {
            for (let reqId of mission.prerequisites.completed_missions) {
                if (!gameState.completedMissions.includes(reqId)) return false;
            }
        }

        // 2. Check Exclusions (Mutually exclusive choices)
        if (mission.prerequisites && mission.prerequisites.excluded_by) {
            for (let excId of mission.prerequisites.excluded_by) {
                if (gameState.completedMissions.includes(excId)) return false;
            }
        }

        // 3. Check Stats (Level, Credits, etc)
        if (mission.prerequisites && mission.prerequisites.stats) {
            const stats = mission.prerequisites.stats;
            if (stats.min_level && gameState.level < stats.min_level) return false;
            if (stats.min_credits && gameState.credits < stats.min_credits) return false;
        }

        return true;
    }
};

window.MissionRegistry = MissionRegistry;