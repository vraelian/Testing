// js/data/systemStateRegistry.js
import { COMMODITY_IDS } from './constants.js';

export const SYSTEM_STATE_REGISTRY = {
    'NEUTRAL': {
        name: 'Stable Economy',
        archetype: 'Neutral',
        durationBounds: [240, 1387], // 8 months to 3.8 years
        varietals: [
            "System-wide markets are stable. Trade lanes are clear.",
            "Standard macroeconomic conditions apply. No major disruptions reported.",
            "Guild forecasts predict a prolonged period of economic baseline stability."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-text-muted);\">The system economy is operating under normal, baseline parameters.</span>",
        modifiers: {}
    },
    'GUILD_EMBARGO': {
        name: 'Guild Embargo (Logistical Gridlock)',
        archetype: 'Bear Market (Restrictive)',
        durationBounds: [240, 1387],
        varietals: [
            "Guild customs frigates have established hard blockades at major transit junctions. Mandatory manifest audits are crippling bulk shipping lanes, resulting in widespread inventory stagnation.",
            "Citing a surge in unregulated cybernetic transit, the Guild has slashed export quotas. Warehouses are overflowing, but automated loading docks refuse to clear cargo without quadruple-stamped clearance.",
            "A localized strike by the Stevedore’s Union in the Belt has caused a cascading logistical failure. Guild routing algorithms are intentionally throttling market replenishment to prevent a system-wide crash."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-loss);\">Stations are restocking goods 80% slower, and their market capacity for purchasing goods has been halved.</span>",
        modifiers: {
            replenishmentRateMod: 0.02,
            targetStockTiers: [1, 2, 3],
            targetStockMod: 0.5
        }
    },
    'CORONAL_MASS_EJECTION': {
        name: 'Coronal Mass Ejection (Radiation Storms)',
        archetype: 'Bear Market (Restrictive)',
        durationBounds: [240, 1387],
        varietals: [
            "Sol Station telemetry indicates a massive breach in the solar corona. High-energy plasma waves are sweeping the system, forcing ship reactors to burn excess fuel just to maintain minimum deflector integrity.",
            "A Class-X solar storm is saturating the interplanetary medium with ionizing radiation. Expect severe ablation to outer hull plating and vastly reduced fuel efficiency during deep-space transit.",
            "The Guild has issued a system-wide radiation hazard warning. Navigational computers are automatically diverting power to electromagnetic shielding, driving up fuel consumption and maintenance overhead."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-loss);\">Your engines are burning 25% more fuel just to stay shielded, and your hull is taking 40% more damage while flying.</span>",
        modifiers: {
            travelFuelBurnMod: 1.25,
            travelHullDecayMod: 1.40
        }
    },
    'AD_ASTRA_DIVIDEND': {
        name: 'The Ad Astra Dividend (Tech Boom)',
        archetype: 'Bull Market (Expansive)',
        durationBounds: [240, 1387],
        varietals: [
            "Earth’s Sovereign Board has authorized the release of a recovered Ad Astra fabrication cache. A sudden influx of hyper-efficient, standardized replacement parts has driven maintenance costs to historic lows.",
            "A massive surplus of pre-Stagnation fuel cells has hit the open market. Guild-sanctioned service stations are practically giving away propellant and hull plating to clear inventory.",
            "The syndication of an ancient, open-source engineering patent has revolutionized port services. Automated repair drones and refueling umbilicals are operating at peak, frictionless efficiency."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">All station services and repairs are 40% cheaper, and your ship takes 25% less damage when traveling.</span>",
        modifiers: {
            serviceCostMod: 0.60, // 40% discount
            travelHullDecayMitigation: 0.75 // Mitigated by 25%
        }
    },
    'SYSTEMIC_INFRASTRUCTURE_PUSH': {
        name: 'Systemic Infrastructure Push',
        archetype: 'Bull Market (Expansive)',
        durationBounds: [240, 1387],
        varietals: [
            "The immortal executives of Mars and Venus have jointly mandated a multi-trillion credit infrastructure overhaul. Demand for industrial bulk materials has completely outpaced standard system supply.",
            "A panic over degrading terraforming arrays has triggered massive government spending. Planetary markets are absorbing endless shipments of Plasteel and Atmo Processors at massive premiums.",
            "The Guild’s 'Century Expansion Initiative' is officially underway. Construction hubs are offering blank checks for structural composites and environmental hardware to meet absurdly aggressive building quotas."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">Industrial materials like Plasteel are selling for 35% more credits, and their market capacity for purchasing these goods has doubled.</span>",
        modifiers: {
            affectedCommodities: [COMMODITY_IDS.PLASTEEL, COMMODITY_IDS.GRAPHENE_LATTICES, COMMODITY_IDS.ATMO_PROCESSORS],
            basePriceInflate: 1.35,
            targetStockMod: 2.0
        }
    },
    'BLACK_MARKET_BLUEPRINT_LEAK': {
        name: 'Black Market Blueprint Leak',
        archetype: 'Opportunistic Market (High Volatility)',
        durationBounds: [240, 1387],
        varietals: [
            "A massive data breach at a quantum research facility on Uranus has flooded the dark-net with classified ship schematics. Tuning shops are quietly offering experimental gear, for a hefty 'handling fee.'",
            "Military-grade technology is inexplicably bleeding into civilian shipyards. Mechanics have the parts, but they are demanding exorbitant bribes to overlook the Guild licensing laws required to install them.",
            "The black market is currently saturated with unstable, elite-tier ship modifications. If you have the credits to bribe the local shipwrights, you can refit a hauler into a dreadnought."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-text-muted);\">The best ship upgrades are three times easier to find in tuning shops, but mechanics are charging 50% more to install them.</span>",
        modifiers: {
            upgradeSpawnMod: 3.0,
            installCostMod: 1.50
        }
    },
    'LONG_WATCH_PHILANTHROPY': {
        name: 'The Long Watch Philanthropy',
        archetype: 'Charitable Market (Beneficial)',
        durationBounds: [240, 1387],
        varietals: [
            "A Martian Sovereign is celebrating their second century of life with a systemic tax write-off. Debt interest has been temporarily frozen, and baseline survival rations are heavily subsidized.",
            "In a rare display of corporate benevolence, the Guild has suspended all loan interest accruals for the fiscal quarter. Furthermore, foundational agricultural goods are trading at half their standard cost.",
            "An anonymous philanthropic trust is dumping trillions of credits into the system. Debt clocks have stopped, and basic life-support commodities are practically free."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">Your loan interest has been completely frozen, and basic survival goods like Water Ice cost half as much to buy everywhere.</span>",
        modifiers: {
            interestFrozen: true,
            affectedCommodities: [COMMODITY_IDS.WATER_ICE, COMMODITY_IDS.HYDROPONICS],
            survivalGoodsDiscountMod: 0.50
        }
    },
    'SILENT_CORRECTION': {
        name: 'Silent Correction',
        archetype: 'Charitable Market (Beneficial)',
        durationBounds: [240, 1387],
        varietals: [
            "A benign ghost in the machine is rewriting the routing tables. Nav-computers are plotting impossibly safe trajectories through deep space, and automated drydocks are repairing ships without registering a billing cycle.",
            "Captains are reporting an unprecedented streak of luck across all trade lanes. Micro-meteoroid fields are parting perfectly, pirate signals are dead, and port mechanics are finding their labor ledgers mysteriously zeroed out.",
            "An anomalous, decentralized AI process is sweeping the Guild's network, quietly optimizing the physical world. Hazards simply aren't manifesting on sensors, and structural repairs are executing for free."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">Dangerous travel hazards have mysteriously vanished from space, and all station mechanics are repairing your hull for free.</span>",
        modifiers: {
            hazardsRemoved: true,
            repairCostMod: 0.0
        }
    },
    'VENETIAN_JUBILEE': {
        name: 'The Venetian Jubilee',
        archetype: 'Charitable Market (Beneficial)',
        durationBounds: [240, 1387],
        varietals: [
            "A massive cyber-attack on corporate banking sectors has resulted in an unexpected windfall. Shadow brokers are quietly funneling stolen credits into the open market, padding the payouts for every independent trader.",
            "The Venetian Syndicate is feeling generous. They've hacked the Guild's purchasing algorithms, forcing every station in the system to pay a massive premium to independent captains for their cargo.",
            "To launder trillions in stolen corporate assets, black-market algorithms are artificially inflating the value of every single commodity you sell. The banks are bleeding, and the haulers are getting rich."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">Shadow brokers are rigging the system in your favor, granting a massive 20% bonus to every single item you sell.</span>",
        modifiers: {
            sellPriceBonusMod: 1.20
        }
    },
    'GEOPOLITICAL_STALEMATE': {
        name: 'Geopolitical Stalemate',
        archetype: 'Conservative Market (Stagnant)',
        durationBounds: [240, 1387],
        varietals: [
            "A bitter tariff dispute between the Terran Alliance and the Martian colonies has brought speculative trade to a standstill. Markets are shedding inventory and aggressively reverting to baseline average prices.",
            "Interplanetary trade has cooled into a tense geopolitical standoff. Nobody wants to hold excess stock. Ports are buying less, selling less, and any artificial price spikes are being instantly corrected by nervous algorithms.",
            "Corporate states are hoarding their credits and halting bulk imports while they wait for the diplomatic dust to settle. Market capacities are severely shrunken, and prices are stubbornly returning to the galactic mean."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-loss);\">Stations have 40% less market capacity for purchasing cargo, and any price spikes will drop back down to normal twice as fast.</span>",
        modifiers: {
            meanReversionMod: 2.0,
            targetStockMod: 0.60 // -40%
        }
    },
    'PLANETARY_GOLD_RUSH': {
        name: 'Planetary Gold Rush',
        archetype: 'Extreme (Single-Location Bull Market)',
        durationBounds: [240, 1387],
        varietals: [
            "[Loc] is experiencing an unprecedented economic boom! Corporate investors are pouring endless credits into the local economy, driving demand for absolutely everything through the roof.",
            "A massive colonial expansion at [Loc] has created a bottomless pit of demand. They have uncapped their purchasing budgets and will pay top credit for any cargo that docks.",
            "It's a genuine gold rush at [Loc]. Local brokers are fighting over every scrap of incoming cargo, offering exorbitant prices and massively expanding their import limits."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">[Loc] is booming! They are paying 75% more for everything and their market capacity for purchasing goods has tripled.</span>",
        modifiers: {
            requiresLocationTarget: true,
            locationCount: 1,
            localBasePriceInflate: 1.75,
            localTargetStockMod: 3.0
        }
    },
    'STATION_QUARANTINE': {
        name: 'Station Quarantine',
        archetype: 'Extreme (Single-Location Bear Market)',
        durationBounds: [240, 1387],
        varietals: [
            "A severe crisis has forced the Guild to enact a total quarantine over [Loc]. The market has completely frozen, and the few mechanics still working are extorting captains for basic services.",
            "Life support failures at [Loc] have triggered a mass panic. Commercial trading has been entirely suspended, and the cost of refueling or patching a hull there has reached criminal levels.",
            "[Loc] is currently under martial lockdown. The trade floors are empty, nothing is being restocked, and docking fees and services have skyrocketed to exploit anyone desperate enough to land."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-loss);\">[Loc] is in total lockdown. Their market is completely frozen, and local mechanics are charging triple for basic services.</span>",
        modifiers: {
            requiresLocationTarget: true,
            locationCount: 1,
            localReplenishmentMod: 0.0,
            localServiceCostMod: 3.0
        }
    },
    'SOVEREIGNS_RETREAT': {
        name: "The Sovereign's Retreat",
        archetype: 'Extreme (Single-Location Charitable Market)',
        durationBounds: [240, 1387],
        varietals: [
            "A mysterious benefactor has turned [Loc] into a temporary haven for independent captains. Local tech shops are practically giving away military-grade ship upgrades, and data brokers are handing out intel for free.",
            "[Loc] has been declared an open-source hub for the season. Elite shipwrights and local spies are completely subsidizing their services, offering unparalleled tech and secrets to anyone who docks.",
            "Corporate subsidies have transformed [Loc] into a captain's paradise. The tuning shops have slashed their prices to rock bottom, and the local intel network is open to the public."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-profit);\">[Loc] has become a haven! Ship upgrades here are 75% off, and the local data brokers are giving away intel for free.</span>",
        modifiers: {
            requiresLocationTarget: true,
            locationCount: 1,
            localUpgradeCostMod: 0.25, // 75% off
            localIntelFree: true
        }
    },
    'SECTOR_COLLAPSE': {
        name: 'Sector Collapse',
        archetype: 'Extreme (Tri-Location Bear Market)',
        durationBounds: [240, 1387],
        varietals: [
            "A catastrophic economic contagion has swept through [Loc 1], [Loc 2], and [Loc 3]. Trade across this entire sector has collapsed. Nobody is buying, and the value of goods has hit absolute rock bottom.",
            "Cascading industrial failures have triggered a localized depression spanning [Loc 1], [Loc 2], and [Loc 3]. The markets are dead. Cargo capacities are practically non-existent, and prices have completely tanked.",
            "The Guild has declared a 'Dead Zone' covering [Loc 1], [Loc 2], and [Loc 3]. A vicious cycle of supply chain failures has crushed the local economies, rendering trade in this sector entirely worthless."
        ],
        quantitativeDisplay: "<span style=\"color: var(--color-loss);\">A massive economic crash has hit [Loc 1], [Loc 2], and [Loc 3]. Their market capacity for purchasing goods has plummeted, and their prices have absolutely tanked.</span>",
        modifiers: {
            requiresLocationTarget: true,
            locationCount: 3,
            localTargetStockMod: 0.20, // -80%
            localBasePriceMod: 0.50
        }
    }
};