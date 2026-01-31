// js/data/officers.js

export const OFFICER_ROLES = {
    COMMANDER: { id: 'COMMANDER', name: 'Station Commander', icon: '👑' },
    QUARTERMASTER: { id: 'QUARTERMASTER', name: 'Quartermaster', icon: '📦' },
    ENGINEER: { id: 'ENGINEER', name: 'Chief Engineer', icon: '🔧' },
    DIPLOMAT: { id: 'DIPLOMAT', name: 'Diplomat', icon: '🤝' }
};

export const OFFICER_DB = [
    {
        id: 'OFF_001',
        name: 'Cpt. Valeris',
        role: OFFICER_ROLES.COMMANDER,
        tier: 1,
        buffs: {
            production: 0.05 // +5% Output
        },
        flavor: "A veteran of the Perimeter Wars. Runs a tight ship."
    },
    {
        id: 'OFF_002',
        name: 'Lt. Bixby',
        role: OFFICER_ROLES.QUARTERMASTER,
        tier: 1,
        buffs: {
            consumption: -1 // Reduces burn requirement by 1 (min 1)
        },
        flavor: "Can stretch a ration pack for three days."
    },
    {
        id: 'OFF_003',
        name: 'Eng. Sparky',
        role: OFFICER_ROLES.ENGINEER,
        tier: 2,
        buffs: {
            decay: -0.1 // -0.1% Daily Decay
        },
        flavor: "Doesn't trust anything he hasn't welded himself."
    }
    // Expand list as needed
];