// js/data/intelMessages.js
/**
 * @fileoverview Defines all static intel-related messages for the news ticker.
 * Exports constants for use in NewsTickerService.
 */

// Tiered messages for Free, Present-Location Intel (Section 3.3)
export const FREE_INTEL_MESSAGES = {
    tier1: [ // 5-10% Below Avg
        "Minor price drop for {Commodity Name}.",
        "Low prices reported for {Commodity Name}.",
        "{Commodity Name} trending below average.",
        "{Commodity Name}: Favorable pricing reported.",
        "Good time to buy {Commodity Name}.",
        "It's a buyer's market for {Commodity Name}."
    ],
    tier2: [ // 11-20% Below Avg
        "{Commodity Name} prices are looking good.",
        "{Commodity Name} is on sale.",
        "Exceptional pricing available for {Commodity Name}.",
        "Act now for the best price on {Commodity Name}.",
        "Get your cheap {Commodity Name} now!",
        "{Commodity Name} is trading far below average.",
        "Get {Commodity Name} for cheap while you can.",
        "Traders are eyeing cheap {Commodity Name}.",
        "Now is the time to acquire {Commodity Name}.",
        "Capitalize on falling {Commodity Name} prices.",
        "Solid discount on {Commodity Name}."
    ],
    tier3: [ // 21-30% Below Avg
        "Don't miss out: {Commodity Name} is a bargain.",
        "Prime buying opportunity for {Commodity Name}.",
        "{Commodity Name}: Prices slashed!",
        "{Commodity Name} is a 'hot buy' right now.",
        "{Commodity Name} is a steal at this price.",
        "Significant price drop for {Commodity Name}.",
        "Traders report massive discounts on {Commodity Name}.",
        "Unbeatable deals on {Commodity Name} right now.",
        "Deep discounts on {Commodity Name}!",
        "{Commodity Name} value has dropped significantly.",
        "{Commodity Name} prices are tumbling."
    ],
    tier4: [ // 31-50% Below Avg
        "{Commodity Name} prices are nosediving.",
        "{Commodity Name} prices have plummeted!",
        "Major price correction for {Commodity Name}.",
        "Fire sale! Get your {Commodity Name} while it lasts.",
        "{Commodity Name} prices are getting crushed.",
        "{Commodity Name} is practically a giveaway."
    ],
    tier5: [ // 51%+ Below Avg
        "{Commodity Name}: Prices have never been lower.",
        "Historic lows for {Commodity Name}.",
        "{Commodity Name} prices hit rock-bottom!",
        "{Commodity Name} prices are in freefall.",
        "Price crash reported for {Commodity Name}.",
        "Market update: {Commodity Name} valuation has collapsed.",
        "{Commodity Name} is being sold for scrap prices.",
        "{Commodity Name}: Total market collapse!",
        "{Commodity Name} is virtually worthless."
    ]
};

// Messages for Purchased, Solar-System Intel (Section 3.4)
export const PURCHASED_INTEL_MESSAGES = [
    "Prime buying opportunity for {Commodity Name} at {Location Name}!",
    "{Location Name} reports massive discounts on {Commodity Name}!",
    "{Commodity Name} is a steal at {Location Name} right now!",
    "Don't miss out: {Commodity Name} is a bargain at {Location Name}!",
    "{Location Name}: Prices slashed on {Commodity Name}!",
    "Head to {Location Name} for deep discounts on {Commodity Name}!",
    "Traders flocking to {Location Name} for cheap {Commodity Name}!",
    "Significant price drops for {Commodity Name} at {Location Name}!",
    "{Location Name} is the hot spot to buy {Commodity Name}!",
    "Unbeatable deals on {Commodity Name} available at {Location Name}!",
    "{Location Name} is dumping its {Commodity Name} stock!",
    "Get to {Location Name}! {Commodity Name} prices are nosediving!",
    "{Commodity Name} prices have plummeted at {Location Name}!",
    "{Location Name} is practically giving away {Commodity Name}!",
    "Fire sale on {Commodity Name} at {Location Name}!",
    "{Commodity Name} prices are getting crushed at {Location Name}!",
    "{CommodITY Name} market is in a freefall at {Location Name}!",
    "Rumor: A major holder just dumped {Commodity Name} at {Location Name}!",
    "{Commodity Name} selling for practically nothing at {Location Name}!",
    "Price crash! {Commodity Name} is worthless at {Location Name}!",
    "The {Commodity Name} market has collapsed at {Location Name}!",
    "Historic lows for {Commodity Name} reported at {Location Name}!",
    "{Location Name}: {Commodity Name} prices have hit rock-bottom!",
    "Total market failure for {Commodity Name} at {Location Name}!",
    "{Location Name} can't get rid of its {Commodity Name}!",
    "{Commodity Name}: Prices have never been lower at {Location Name}!",
    "{Commodity Name} is being sold for scrap prices at {Location Name}!",
    "{Location Name}'s {Commodity Name} valuation has evaporated!"
];