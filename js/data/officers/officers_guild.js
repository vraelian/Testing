export const OFFICERS_GUILD = [
    {
        id: "off_gld_01",
        name: "Logistics Officer Haren",
        faction: "GUILD",
        role: "Logistics",
        portrait: "assets/portraits/guild_01.png", // Placeholder path
        flavor: "Former blockade runner turned efficiency expert. He smells slightly of ozone and desperate margins.",
        buffs: {
            entropy_decay_mult: -0.05, // -5% Decay
            credit_output_mult: 0.10,  // +10% Credits
            antimatter_output_mult: 0.0,
            burn_rate_mult: 0.0
        },
        unlockCondition: {
            type: "LICENSE",
            value: "license_tier_4"
        }
    },
    {
        id: "off_gld_02",
        name: "Auditor Vex",
        faction: "GUILD",
        role: "Finance",
        portrait: "assets/portraits/guild_02.png",
        flavor: "A walking spreadsheet. Claims to have optimized her own sleep cycle to 2 hours a day.",
        buffs: {
            entropy_decay_mult: 0.0,
            credit_output_mult: 0.15, // +15% Credits
            antimatter_output_mult: -0.05, // -5% Antimatter (Penalty)
            burn_rate_mult: -0.05 // -5% Consumption
        },
        unlockCondition: {
            type: "WEALTH",
            value: 10000000
        }
    }
];