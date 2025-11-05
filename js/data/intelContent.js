// js/data/intelContent.js
/**
 * @fileoverview Defines the static "sample" and "details" message pairs
 * for the Local Data Broker (Intel Market) system.
 *
 * Placeholders:
 * - [location name]
 * - [commodity name]
 * - [discount amount %]
 * - [durationDays]
 * - [⌬ credit price]
 */

export const INTEL_CONTENT = {
    "CORPORATE_LIQUIDATION": {
        "sample": "We have confirmed actionable intelligence at [location name]. The data points to a significant, short-term market inefficiency.",
        // VIRTUAL WORKBENCH: Re-structured details text per user request (A, B)
        "details": "A minor Corporate State is quietly liquidating assets to meet quarterly quotas. This has created a [commodity name] surplus at [location name], allowing for purchase at [discount amount %] below galactic average.<br><br>The liquidation is scheduled and expected to last for [durationDays].<br><br>You paid [⌬ credit price] for this intel."
    },
    "SUPPLY_CHAIN_DISRUPTION": {
        "sample": "A reliable node reports a supply chain disruption affecting [location name]. This packet identifies a specific commodity now available at a statistical discount.",
        // VIRTUAL WORKBENCH: Re-structured details text per user request (A, B)
        "details": "A Merchant's Guild freighter was damaged, forcing them to offload cargo at a loss. [commodity name] is available at [location name] for [discount amount %] off standard pricing.<br><br>Their misfortune is your gain, but this window is only open for [durationDays].<br><br>You paid [⌬ credit price] for this intel."
    },
    // ... Additional 28 entries can be added here following the same structure
};