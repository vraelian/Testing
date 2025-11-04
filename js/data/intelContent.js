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
        "details": "PACKET DECRYPTED: A [commodity name] surplus at [location name] allows for purchase at [discount amount %] below galactic average. This price is locked for [durationDays] days. A minor Corporate State is quietly liquidating assets to meet quarterly quotas. This is a standard, low-risk procurement opportunity. This intel was secured for [⌬ credit price]."
    },
    "SUPPLY_CHAIN_DISRUPTION": {
        "sample": "A reliable node reports a supply chain disruption affecting [location name]. This packet identifies a specific commodity now available at a statistical discount.",
        "details": "DATA UNLOCKED: [commodity name] is available at [location name] for [discount amount %] off standard pricing. This window is open for [durationDays] days. A Merchant's Guild freighter was damaged, forcing them to offload their cargo here at a loss. Their misfortune is your gain. This access was [⌬ credit price]."
    },
    // ... Additional 28 entries can be added here following the same structure
};