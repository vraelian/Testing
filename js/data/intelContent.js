// js/data/intelContent.js
/**
 * @fileoverview Defines the static "sample" and "details" message pairs
 * for the Local Data Broker (Intel Market) system.
 *
 * This file uses a flat, universal object structure. All messages are
 * location-agnostic and can be applied to any deal.
 *
 * Placeholders:
 * - [location name]
 * - [commodity name]
 * - [discount amount %]
 * - [durationDays]
 * - [credit price]
 */

export const INTEL_CONTENT = {
    "CORP_FAILURE_01": {
        "sample": "We've flagged a minor subsidiary going into receivership.",
        "details": "A parent corp is cutting its losses and dissolving a failed venture that was flagged for going into receivership. They are dumping all assets to avoid Guild fees.<br><br>This has created a temporary surplus of [commodity name] at [location name] for [discount amount %] off market value.<br><br>The liquidation is scheduled to be finalized by creditors in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "CORP_FAILURE_02": {
        "sample": "A corporate partner's trade charter has just been revoked.",
        "details": "Following a trade charter revocation, the corporate state has seized a partner's assets and is holding a no-notice auction to pay their local debts.<br><br>We've secured a manifest: [commodity name] is available at [location name] for [discount amount %] below its valuation.<br><br>This is a one-time, unlisted auction ending in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "CORP_FAILURE_03": {
        "sample": "Our analysts project a high-profile bankruptcy announcement is imminent.",
        "details": "A firm our analysts flagged for imminent bankruptcy is in a death spiral and has begun a shadow liquidation to pay its key investors before the public announcement.<br><br>This means a large cache of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The firm's assets will be frozen by the Guild in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "CORP_FAILURE_04": {
        "sample": "A corporate buyout we were tracking has just turned hostile.",
        "details": "A corporate buyout has turned hostile, and the losing entity is being stripped by the new owners. All non-essential inventories are being sold off immediately.<br><br>They are clearing out all [commodity name] at [location name] for [discount amount %] below market price.<br><br>This fire sale will be over once the transition is complete in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "CORP_FAILURE_05": {
        "sample": "We've confirmed a local governor has seized a corporation's assets.",
        "details": "A local governor has seized a corporation's assets and is using a legal loophole to auction all seized goods for a public works fund, and they need it done fast.<br><br>This has resulted in a surplus of [commodity name] at [location name], now available for [discount amount %] off.<br><br>This asset seizure auction will close in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "LOGISTICS_FAILURE_01": {
        "sample": "Tracking a freighter captain who just paid a massive Guild fine.",
        "details": "A freighter captain, having just paid a massive Guild fine for an improper manifest, is now selling cargo at a loss to cover port fees.<br><br>Their entire hold of [commodity name] is being sold at [location name] for [discount amount %] off.<br><br>The ship is scheduled to be released and will depart in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "LOGISTICS_FAILURE_02": {
        "sample": "We've confirmed a long-haul freighter has suffered critical damage.",
        "details": "We've confirmed a long-haul freighter is too damaged to complete its journey. The captain is dumping their entire cargo hold to pay for emergency repairs.<br><br>This has created a buyer's market for [commodity name] at [location name], with goods going for [discount amount %] off.<br><br>The repairs are estimated to be complete in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "LOGISTICS_FAILURE_03": {
        "sample": "A major port is experiencing a catastrophic logistics backlog.",
        "details": "A major port is experiencing a catastrophic logistics backlog due to a system failure, leaving dozens of ships unable to dock. Captains are panic-selling cargo at a discount.<br><br>A significant surplus of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The port authority expects to have the system back online in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "LOGISTICS_FAILURE_04": {
        "sample": "A high-priority supply contract was just canceled mid-transport.",
        "details": "A high-priority supply contract was canceled mid-transport, leaving a freighter stuck with a full hold of bespoke goods and no buyer. The captain is selling the entire shipment for pennies.<br><br>Their cargo of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The captain will dump the cargo as scrap if not sold in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "LOGISTICS_FAILURE_05": {
        "sample": "Pirate activity has forced a freighter miles off-route.",
        "details": "A freighter, forced miles off-route by pirate activity, survived the encounter but burned too much fuel. They are selling valuable cargo to afford the refuel.<br><br>A stock of [commodity name] is being sold at [location name] for [discount amount %] below value.<br><br>The ship will refuel and depart in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "PRODUCTION_ERROR_01": {
        "sample": "An automated factory's quarterly quota was massively miscalculated.",
        "details": "A logistical AI at an automated factory put a decimal in the wrong place, resulting in a 100x surplus. The factory is dumping it before auditors arrive.<br><br>They are quietly liquidating [commodity name] at [location name] for [discount amount %] off.<br><br>The audit is scheduled for [durationDays], at which point this deal vanishes.<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "PRODUCTION_ERROR_02": {
        "sample": "A major manufacturing line is retooling for a new-gen product.",
        "details": "A major manufacturing line is retooling for a new-gen product, and all old-generation materials are being cleared out to make room. It's all considered scrap to them.<br><br>This means all [commodity name] stock is available at [location name] for [discount amount %] off.<br><br>The retooling will be complete in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "PRODUCTION_ERROR_03": {
        "sample": "A recent batch of high-spec goods failed its final QA check.",
        "details": "A shipment of high-spec goods failed its 99.9% purity standard. The corporation is selling this sub-par but still excellent stock at a loss.<br><br>This entire batch of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The shipment will be disposed of if not sold in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "PRODUCTION_ERROR_04": {
        "sample": "We're tracking an industrial AI experiencing... anomalies.",
        "details": "An industrial AI has been experiencing anomalies, ordering triple the required raw materials for weeks, and the local warehouse is now overflowing.<br><br>They are selling excess [commodity name] at [location name] for [discount amount %] off to clear space.<br><br>A diagnostic and reset is scheduled for [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "PRODUCTION_ERROR_05": {
        "sample": "A new, experimental production line has... unexpected byproducts.",
        "details": "A test run of a new, experimental manufacturing process has, ironically, created a massive surplus of a key component. The R&D lab is selling it off-book.<br><br>This surplus of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The test run concludes and the line is shut down in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "REGULATORY_ERROR_01": {
        "sample": "A new interstellar tariff is being announced in 48 hours.",
        "details": "We've seen the memo for a new interstellar tariff being announced in 48 hours. Suppliers are desperately dumping all pre-tariff stock to avoid the new, massive tax.<br><br>This panic-sell means [commodity name] is available at [location name] for [discount amount %] off.<br><br>This regulatory loophole will snap shut in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "REGULATORY_ERROR_02": {
        "sample": "A Guild auditor just made a surprise visit to a local port.",
        "details": "A Guild auditor's surprise visit has a local port authority in a panic. They are auctioning all unclaimed and improperly manifested cargo immediately. No questions asked.<br><br>A large lot of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The audit will be complete and the auction closed in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "REGULATORY_ERROR_03": {
        "sample": "We've flagged a shipment seized for manifest violations.",
        "details": "A shipment was seized for manifest violations, declared contraband on a technicality. The local authorities are now selling it at a disposal auction.<br><br>This seized shipment of [commodity name] is available at [location name] for [discount amount %] off.<br><br>The auction is unlisted and ends in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "REGULATORY_ERROR_04": {
        "sample": "A local trade license has been unexpectedly revoked.",
        "details": "A company's local trade license has been unexpectedly revoked, barring them from trading. Their entire inventory is being sold off by Guild-appointed receivers.<br><br>This has created a one-time surplus of [commodity name] at [location name], available for [discount amount %] off.<br><br>The receivers' sale will end in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "REGULATORY_ERROR_05": {
        "sample": "A health inspector has quarantined a station's cargo bay.",
        "details": "A (likely faked) health scare from an inspector has forced the liquidation of all perishable goods in a quarantined cargo bay. The corporation is writing it off as a total loss.<br><br>This means all [commodity name] in the bay is being sold at [location name] for [discount amount %] off.<br><br>The bay will be 'sterilized' and the remaining stock destroyed in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "INSIDER_INTEL_01": {
        "sample": "A high-level corporate executive is about to be retired.",
        "details": "A high-level corporate exec knows they are being forced out and is panic-selling all their personal and corporate assets before they are frozen.<br><br>This includes a private stash of [commodity name], available at [location name] for [discount amount %] off.<br><br>The exec's accounts will be seized in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "INSIDER_INTEL_02": {
        "sample": "We've identified a shell corporation that is being dissolved.",
        "details": "A shell corporation we identified as a smuggling front is being dissolved. Its 'legitimate' assets are being rapidly absorbed into the public market.<br><br>This has created a shadow surplus of [commodity name] at [location name] for [discount amount %] off.<br><br>The assets will be fully liquidated in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "INSIDER_INTEL_03": {
        "sample": "A rival corporation is initiating a hostile price war.",
        "details": "A rival corporation is intentionally flooding the market to bankrupt a competitor. This has temporarily, and artificially, crashed the price.<br><br>This means [commodity name] is available at [location name] for [discount amount %] below its actual value.<br><br>We project the smaller firm will fold and prices will stabilize in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "INSIDER_INTEL_04": {
        "sample": "We have a tip from a disgruntled corporate officer.",
        "details": "A disgruntled corporate officer is about to blow the whistle on a major product line failure and is dumping their personal stock before the news breaks.<br><br>This fire sale on [commodity name] is happening at [location name] for [discount amount %] off.<br><br>The announcement is expected in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "INSIDER_INTEL_05": {
        "sample": "An info-broker is dumping physical assets for liquid credits.",
        "details": "A rival info-broker is restructuring and needs cash, fast. They are selling their entire non-data inventory at a loss.<br><br>Their holdings of [commodity name] are available at [location name] for [discount amount %] off.<br><br>This is a one-time offer, ending in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "DEMAND_SPIKE_01": {
        "sample": "A critical supply freighter has just been declared lost with all hands.",
        "details": "A critical supply freighter has been declared lost with all hands, creating a system-wide shortage of a key material. Buyers are paying a massive premium.<br><br>The market for [commodity name] at [location name] is buying at [discount amount %] over galactic average.<br><br>This bubble will pop when replacement shipments arrive in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "DEMAND_SPIKE_02": {
        "sample": "A major factory just suffered a catastrophic failure.",
        "details": "A major factory just suffered a catastrophic failure. As the system's primary supplier of a key component, the supply chain has collapsed.<br><br>Demand for [commodity name] at [location name] has skyrocketed, with prices at [discount amount %] above normal.<br><br>This shortage is expected to last [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "DEMAND_SPIKE_03": {
        "sample": "We've intercepted a project's emergency supply request.",
        "details": "We've intercepted an emergency supply request from a major terraforming project that has a massive, miscalculated shortfall. They are paying any price.<br><br>They are buying [commodity name] at [location name] for [discount amount %] over market value.<br><br>Their emergency charter is expected to be filled in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "DEMAND_SPIKE_04": {
        "sample": "A local warehouse was just breached by... something.",
        "details": "The entire local stock of a commodity was destroyed after a warehouse breach. This has created a sudden, desperate demand from local industries.<br><br>The local market for [commodity name] at [location name] is paying [discount amount %] above average.<br><br>This localized shortage will be resolved in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    },
    "DEMAND_SPIKE_05": {
        "sample": "A new, unexpected corporate construction charter was just approved.",
        "details": "A new, unexpected corporate construction charter was just approved. The corporation is rushing to build and is paying a premium to bypass normal supply channels.<br><br>Their project managers are buying [commodity name] at [location name] for [discount amount %] above the average price.<br><br>This buy-order will be filled in [durationDays].<br><br>You paid <span class=\"credits-text-pulsing\">⌬ [credit price]</span> for this intel."
    }
};