// js/data/events.js
/**
 * @fileoverview
 * Defines all static random event data for the game.
 */
import { COMMODITY_IDS } from './constants.js';

export const RANDOM_EVENTS = [
    {
        id: 'distress_call',
        title: 'Distress Call',
        scenario: 'You pick up a distress signal from a small, damaged ship. They are out of fuel and requesting an emergency transfer to restart their reactor.',
        precondition: (gameState, activeShip) => activeShip.fuel >= 20, // Event can only trigger if player has enough fuel to offer.
        choices: [
            {
                title: 'Offer Aid (20 Fuel)',
                outcomes: [
                    {
                        chance: 0.75,
                        description: 'The fuel transfer is successful. The grateful captain rewards you with 10,000 credits for your timely assistance.',
                        effects: [ { type: 'fuel', value: -20 }, { type: 'credits', value: 10000 } ]
                    },
                    {
                        chance: 0.25,
                        description: 'As the fuel transfer begins, their reactor overloads! The resulting explosion damages your hull by 15%.',
                        effects: [ { type: 'fuel', value: -20 }, { type: 'hull_damage_percent', value: 15 } ]
                    }
                ]
            },
            {
                title: 'Ignore the Call',
                outcomes: [ { chance: 1.0, description: 'You press on, and the desperate signal fades behind you.', effects: [] } ]
            }
        ]
    },
    {
        id: 'floating_cargo',
        title: 'Floating Cargo Pod',
        scenario: 'Long-range sensors detect an unmarked, sealed cargo pod adrift in the shipping lane. It appears to be intact.',
        precondition: () => true,
        choices: [
            {
                title: 'Bring it Aboard',
                outcomes: [
                    {
                        chance: 0.60,
                        description: `The pod contains valuable goods. You gain 25 units of Neural Processors.`,
                        effects: [ { type: 'add_cargo', value: { id: COMMODITY_IDS.PROCESSORS, quantity: 25 } } ]
                    },
                    {
                        chance: 0.40,
                        description: 'It was a trap! The pod is booby-trapped and detonates as your tractor beam locks on, causing 20% hull damage.',
                        effects: [ { type: 'hull_damage_percent', value: 20 } ]
                    }
                ]
            },
            {
                title: 'Report it',
                outcomes: [ { chance: 1.0, description: 'You notify the nearest station of the hazard and receive a small finder\'s fee of 1,000 credits.', effects: [ { type: 'credits', value: 1000 } ] } ]
            }
        ]
    },
    {
        id: 'adrift_passenger',
        title: 'Adrift Passenger',
        scenario: 'You find a spacer in a functioning escape pod. Their beacon is down, and they ask for passage to the nearest civilized port.',
        precondition: (gameState, activeShip) => activeShip.fuel >= 30,
        choices: [
            {
                title: 'Take Aboard for Payment',
                outcomes: [ { chance: 1.0, description: 'The passenger is grateful for the rescue and pays you 10,000 credits upon arrival at your destination.', effects: [ { type: 'credits', value: 10000 } ] } ]
            },
            {
                title: 'Give a Fuel Cell (30 Fuel)',
                outcomes: [
                    {
                        chance: 1.0,
                        descriptions: {
                            'reward_cybernetics': `In gratitude, the passenger gives you a crate of <span class="hl-green">40 Cybernetics</span>.`,
                            'reward_debt_paid': `Seeing your tight cargo, the passenger pays off 20% of your debt, reducing it by <span class="hl-green">{amount}</span>.`,
                            'reward_credits': `With no room and no debt, the passenger transfers you <span class="hl-green">{amount}</span>.`
                        },
                        effects: [ { type: 'ADRIFT_PASSENGER' } ]
                    }
                ]
            }
        ]
    },
    {
        id: 'meteoroid_swarm',
        title: 'Micrometeoroid Swarm',
        scenario: 'Alarms blare as you fly into an uncharted micrometeoroid swarm. Your navigation computer suggests two options to minimize damage.',
        precondition: (gameState, activeShip) => activeShip.fuel >= 15,
        choices: [
            {
                title: 'Evade Aggressively (+15 Fuel)',
                outcomes: [ { chance: 1.0, description: 'You burn extra fuel to successfully dodge the worst of the swarm, emerging unscathed.', effects: [ { type: 'fuel', value: -15 } ] } ]
            },
            {
                title: 'Brace for Impact',
                outcomes: [ { chance: 1.0, description: 'You trust your hull to withstand the impacts, taking a beating but saving fuel.', effects: [ { type: 'hull_damage_percent', value: [10, 25] } ] } ]
            }
        ]
    },
    {
        id: 'engine_malfunction',
        title: 'Engine Malfunction',
        scenario: 'A sickening shudder runs through the ship. A key plasma injector has failed, destabilizing your engine output.',
        precondition: (gameState, activeShip, getActiveInventory) => (getActiveInventory()[COMMODITY_IDS.PLASTEEL]?.quantity || 0) >= 5,
        choices: [
            {
                title: 'Quick, Risky Fix (5 Plasteel)',
                outcomes: [
                    {
                        chance: 0.50,
                        description: 'The patch holds! The engine stabilizes and you continue your journey without further incident.',
                        effects: [ { type: 'lose_cargo', value: { id: COMMODITY_IDS.PLASTEEL, quantity: 5 } } ]
                    },
                    {
                        chance: 0.50,
                        description: 'The patch fails catastrophically, causing a small explosion that deals 20% hull damage.',
                        effects: [ { type: 'lose_cargo', value: { id: COMMODITY_IDS.PLASTEEL, quantity: 5 } }, { type: 'hull_damage_percent', value: 20 } ]
                    }
                ]
            },
            {
                title: 'Limp to Destination',
                outcomes: [ { chance: 1.0, description: 'You shut down the faulty injector. The ship is slower, but stable. Your remaining travel time increases by 25%.', effects: [ { type: 'travel_time_add_percent', value: 0.25 } ] } ]
            }
        ]
    },
    {
        id: 'nav_glitch',
        title: 'Navigation Sensor Glitch',
        scenario: 'The nav-console flashes red. Your primary positioning sensors are offline, and you\'re flying blind in the deep dark.',
        precondition: () => true,
        choices: [
            {
                title: 'Attempt Hard Reboot',
                outcomes: [
                    {
                        chance: 0.50,
                        description: 'Success! The sensors come back online. In your haste, you find a shortcut, shortening your trip. You will arrive the next day.',
                        effects: [ { type: 'set_travel_time', value: 1 } ]
                    },
                    {
                        chance: 0.50,
                        description: 'The reboot corrupts your course data, sending you on a long, meandering path. This adds 15 days to your journey.',
                        effects: [ { type: 'travel_time_add', value: 15 } ]
                    }
                ]
            },
            {
                title: 'Navigate Manually',
                outcomes: [ { chance: 1.0, description: 'You rely on old-fashioned star charts. It\'s slow but safe, adding 7 days to your trip.', effects: [ { type: 'travel_time_add', value: 7 } ] } ]
            }
        ]
    },
    {
        id: 'life_support_fluctuation',
        title: 'Life Support Fluctuation',
        scenario: 'An alarm indicates unstable oxygen levels. It\'s not critical yet, but the crew is on edge and efficiency is dropping.',
        precondition: (gameState, activeShip) => activeShip.health > (activeShip.maxHealth * 0.25),
        choices: [
            {
                title: 'Salvage materials from the ship to repair the atmospheric regulators. (This will cost 25% hull damage)',
                outcomes: [ { chance: 1.0, description: 'You cannibalize some non-essential hull plating to get the regulators working again. The system stabilizes, but the ship\'s integrity is compromised.', effects: [ { type: 'hull_damage_percent', value: 25 } ] } ]
            },
            {
                title: 'Defer Maintenance Costs',
                outcomes: [ { chance: 1.0, description: 'You log the issue for later. The cost of repairs and crew hazard pay, 5,000 credits, is added to your debt.', effects: [ { type: 'add_debt', value: 5000 } ] } ]
            }
        ]
    },
    {
        id: 'cargo_rupture',
        title: 'Cargo Hold Rupture',
        scenario: 'A micrometeorite has punched a small hole in the cargo bay. One of your cargo stacks is exposed to hard vacuum.',
        precondition: (gameState, activeShip, getActiveInventory) => {
            const inventory = getActiveInventory();
            if (!inventory) return false;
            return Object.values(inventory).some(item => item.quantity > 0);
        },
        choices: [
            {
                title: 'Jettison Damaged Cargo',
                outcomes: [ { chance: 1.0, description: 'You vent the damaged section, losing 10% of a random cargo stack from your hold into the void.', effects: [ { type: 'lose_random_cargo_percent', value: 0.10 } ] } ]
            },
            {
                title: 'Attempt EVA Repair',
                outcomes: [
                    {
                        chance: 0.75,
                        description: 'The emergency patch holds! The cargo is safe, but the repair adds 2 days to your trip.',
                        effects: [ { type: 'travel_time_add', value: 2 } ]
                    },
                    {
                        chance: 0.25,
                        description: 'The patch fails to hold. Explosive decompression destroys 50% of the cargo stack, and the repair still adds 2 days to your trip.',
                        effects: [ { type: 'lose_random_cargo_percent', value: 0.50 }, { type: 'travel_time_add', value: 2 } ]
                    }
                ]
            }
        ]
    },
    {
        id: 'space_race',
        title: 'Space Race Wager',
        scenario: 'A smug-looking luxury ship pulls alongside and its captain, broadcasted on your main screen, challenges you to a "friendly" race to the destination.',
        precondition: (gameState) => gameState.player.credits > 100,
        choices: [
            {
                title: 'Accept Wager (Bet: 80% of current credits)',
                outcomes: [
                    {
                        chance: 1.0,
                        description: 'You accept the high-stakes challenge...',
                        effects: [ { type: 'SPACE_RACE', wagerPercentage: 0.80, winChance: { 'S': 0.85, 'A': 0.70, 'B': 0.55, 'C': 0.40, 'O': 0.95 } } ]
                    }
                ]
            },
            {
                title: 'Politely Decline',
                outcomes: [ { chance: 1.0, description: 'You decline the race. The luxury ship performs a flashy maneuver and speeds off, leaving you to travel in peace.', effects: [] } ]
            }
        ]
    },
    {
        id: 'supply_drop',
        title: 'Emergency Supply Drop',
        scenario: 'You intercept a system-wide emergency broadcast. A new outpost is offering a massive premium for an immediate delivery of a specific commodity that you happen to be carrying.',
        precondition: (gameState, activeShip, getActiveInventory) => {
            const inventory = getActiveInventory();
            return inventory && Object.values(inventory).some(item => item.quantity > 0);
        },
        choices: [
            {
                title: 'Divert Course to Deliver',
                outcomes: [ { chance: 1.0, description: 'You sell your entire stack of the requested commodity for 3 times its galactic average value. Your course is diverted to a new, random destination, adding 7 days to your trip.', effects: [ { type: 'sell_random_cargo_premium', value: 3 }, { type: 'travel_time_add', value: 7 }, { type: 'set_new_random_destination' } ] } ]
            },
            {
                title: 'Decline and Continue',
                outcomes: [ { chance: 1.0, description: 'You stick to your original plan and let someone else handle the emergency supply run.', effects: [] } ]
            }
        ]
    }
];