// js/data/ship_database.js
/**
 * @fileoverview This file contains the new, centralized ship database.
 * It merges the static data from the "Ship List" and "Ship Lore" spreadsheets
 * into a single, authoritative source.
 */

import { LOCATION_IDS } from './constants.js';

// Helper map to convert spreadsheet location names to LOCATION_IDS enums
const locationMap = {
    "Starter": null,
    "Mission (TBD)": null,
    "Moon": LOCATION_IDS.LUNA,
    "Earth": LOCATION_IDS.EARTH,
    "Mars": LOCATION_IDS.MARS,
    "Venus": LOCATION_IDS.VENUS,
    "Neptune": LOCATION_IDS.NEPTUNE,
    "Jupiter": LOCATION_IDS.JUPITER,
    "The Belt": LOCATION_IDS.BELT,
    "Pluto": LOCATION_IDS.PLUTO,
    "Saturn": LOCATION_IDS.SATURN,
    "Uranus": LOCATION_IDS.URANUS,
    "Kepler's Eye": LOCATION_IDS.KEPLER,
    "The Exchange": LOCATION_IDS.EXCHANGE,
};

/**
 * @typedef {object} ShipData
 * @property {string} name - The display name of the ship.
 * @property {string} class - The ship's class (e.g., 'C', 'B', 'A', 'S', 'O', 'Z', 'F').
 * @property {number} price - The purchase cost of the ship in credits.
 * @property {number} maxHealth - The maximum hull integrity.
 * @property {number} cargoCapacity - The maximum cargo space.
 * @property {number} maxFuel - The maximum fuel capacity.
 * @property {string} role - The ship's designated type (e.g., 'Explorer', 'Hauler').
 * @property {string} attribute - A special passive bonus or trait, or "None".
 * @property {string} description - The short, in-game card flavor text.
 * @property {string} lore - The long-form detailed lore for the ship.
 * @property {string|null} saleLocationId - The LOCATION_ID where this ship is sold, or null.
 * @property {number} spawnChance - The chance for this ship to appear in the shipyard (0-1).
 * @property {string} spawnTrigger - The condition for this ship to appear (e.g., "Tier 3 Unlock").
 * @property {boolean} isRare - (Auto-generated) True if spawn chance is < 1.
 * @property {string[]} mechanicIds - Array of GameAttribute keys defining special behaviors.
 */

/**
 * @const {Object<string, ShipData>} SHIP_DATABASE
 * @description The new single source of truth for all static ship data.
 * The key for each entry is the "GAME ID" (e.g., "Wanderer.Ship").
 */
export const SHIP_DATABASE = {
    "Wanderer.Ship": {
        name: "Wanderer",
        class: "C",
        price: 25000,
        maxHealth: 30,
        cargoCapacity: 30,
        maxFuel: 130,
        role: "Explorer",
        attribute: "None",
        description: "Its oversized fuel tank betrays its past as a survey ship, built for pilots who value the range over all else. ",
        lore: `The Wanderer is a vessel born from the fine print of a corporate bankruptcy. Its chassis belongs to the ""Surveyor's Friend"" line, a failed venture by a minor Martian corp that attempted to build a cheap, long-range scout for freelance prospectors. The venture folded, and its assets were snapped up by the Merchant's Guild, not for their quality, but for their utility in backing the loans of new, desperate captains. This ship was never celebrated; it was simply requisitioned, its manufacturing plate filed clean and its identifiers reassigned.

Its history is a patchwork of incomplete journeys. The original owner used it to map unlisted asteroid clusters in the Belt before defaulting on a fuel payment. It was then briefly captained by a paranoid journalist tracking rumors of Venetian Syndicate activity, who abandoned it on Luna after a close call, wiping the nav logs clean. Its call-sign, ""Wanderer,"" isn't a factory name but a nickname given by Guild dockworkers, who noted it never seemed to keep an owner for long.

It's low cargo and thin hull are secondary to its one redeeming feature: a surprisingly robust fuel tank, a remnant of its original survey design.

Inside, the ship is spartan. The cockpit is functional, designed for observation. The single bunk is a fold-down shelf.

The air recyclers hum a half-step flat. It smells of sterilized plastic and the faint, metallic tang of ozone.

The Wanderer is the quintessential first step into the void. It’s not a ship that promises riches or glory; it's a ship that promises distance. It was built to see what's over the horizon, and for a new captain, that is the only promise that matters.

It is the very definition of freedom: a hull, an engine, and just enough range to disappear.`,
        saleLocationId: locationMap["Starter"],
        spawnChance: 1,
        spawnTrigger: "New game only",
        isRare: false,
        mechanicIds: []
    },
    "Stalwart.Ship": {
        name: "Stalwart",
        class: "C",
        price: 25000,
        maxHealth: 70,
        cargoCapacity: 45,
        maxFuel: 90,
        role: "Balanced",
        attribute: "None",
        description: "It lacks the range of an explorer, but its reinforced hull promises a steady hand through the system's most turbulent trade routes.",
        lore: `The Stalwart is a product of the Earth-Luna supply chain, a pure workhorse built by a subsidiary of the Terran Alliance.
Its design was never meant to be revolutionary; it was meant to be reliable.
During the Helium Rush, hundreds of these vessels were commissioned as high-priority couriers, running critical components, data cores, and personnel between Earth's orbital factories and the chaotic lunar mining settlements.
They were designed to be tough, capable of handling rapid docking, automated loading, and the occasional debris collision.
This particular hull has a long service record. It was originally part of the corporate fleet for ""Astra-Logistics,"" a mid-level corporation that was eventually squeezed out of the helium trade.
The ship's logs, if you could access the encrypted archives, would show thousands of routine, completed trips.
It has never seen the outer system, never engaged in combat, and never failed to reach its destination.
It is the definition of ""stalwart"": loyal, dependable, and thoroughly unexciting.
The Merchant's Guild acquired this ship, like so many others, during a corporate liquidation.
Its value is not in its potential, but in its proven track record.
Its balanced stats—a tough hull, a respectable cargo bay, and adequate fuel—make it a low-risk asset.
It is the sensible choice, a floating pickup truck for the practical-minded trader.

The ship's interior is worn but clean.
The bulkhead panels are scratched from years of cargo shifting, and the pilot's chair is permanently molded to a shape that isn't yours.
The ship's systems are simple, robust, and easily repaired. There are no luxuries, only redundancies.
Its most prominent feature is its reinforced hull plating, which makes the entire vessel feel solid and secure, a small piece of Earth's reliability in the void.
The Stalwart is a tool for building a business. It’s not a vessel for exploration or high-stakes gambles;
it’s for the captain who intends to navigate the razor's edge of commerce by being smarter, tougher, and more dependable than the competition.
It’s a ship that promises to show up, do the work, and survive to do it again tomorrow.`,
        saleLocationId: locationMap["Starter"],
        spawnChance: 1,
        spawnTrigger: "New game only",
        isRare: false,
        mechanicIds: []
    },
    "Mule.Ship": {
        name: "Mule",
        class: "C",
        price: 25000,
        maxHealth: 45,
        cargoCapacity: 70,
        maxFuel: 70,
        role: "Hauler",
        attribute: "None",
        description: "Little more than a cockpit bolted to a high-capacity cargo container, this ship was designed for slow but profitable journeys between orbital stations, one ton at a time.",
        lore: `The Mule is less a starship and more a cargo container with an engine and a cockpit welded to the side as an afterthought.
It is a product of the Drive-Divide, a ship built for those who have no choice but to use the cheapest hardware available.
Its design was mass-produced in the orbital yards of Mars, intended for ""last-mile"" hauling—moving raw, unprocessed ore from massive deep-space freighters to the planetary surface or between nearby stations.
Its history is one of heavy loads and short tempers.
The ""Mule"" line is notorious among pilots for being loud, uncomfortable, and slow.
Its low-grade engine vibrates through the entire hull, and its fuel capacity is barely enough to get from a high-orbit anchor to a docking bay and back.
Its only purpose, its only virtue, is the cavernous, un-shielded cargo bay that makes up over 80% of its mass.
This ship was likely repossessed by the Merchant's Guild after its previous owner, a small-time scrap hauler, was crushed by the manipulated market prices of the Venetian Syndicate.
The ship sat in a Guild impound lot, its only value being the raw tonnage it could move.
It is the perfect, high-risk, high-reward asset for a captain who is willing to sacrifice everything—comfort, safety, and speed—to maximize their manifests.
The cockpit is a cramped metal box that smells of ozone, artificial lubricant, and stale coffee.
The hull is thin, and every micrometeorite impact sounds like a gunshot.
The ship shudders violently when the main drive engages. It is a vessel that constantly reminds its pilot that the void is waiting just outside a few inches of cheap alloy.
This is the ship for the pure trader. You don't buy a Mule to see the system or to outrun pirates.
You buy it for the cold, hard calculus of its cargo hold.
It is a bet that you can fill it, sell its contents, and earn your way into a better ship before its numerous flaws finally catch up with you.`,
        saleLocationId: locationMap["Starter"],
        spawnChance: 1,
        spawnTrigger: "New game only",
        isRare: false,
        mechanicIds: []
    },
    "Nomad.Ship": {
        name: "Nomad",
        class: "C",
        price: 40000,
        maxHealth: 40,
        cargoCapacity: 35,
        maxFuel: 150,
        role: "Explorer",
        attribute: "None",
        description: "Its lightweight frame and oversized fuel cells were designed for a single purpose: to keep moving, making it ideal for captains who rarely sleep in the same port twice.",
        lore: `The Nomad, born from the Helium Rush, is a direct response to the chaos and opportunity of Luna's new economy.
While large corporations focused on mass extraction, a gap emerged for independent prospectors - pilots who could scout new deposits, verify claims, or disappear into the Belt for months at a time.
A small Luna-based shipyard, ""Cis-Lunar Dynamics,"" created the Nomad to fill this niche.
It was one of an endless series of ships that tried to thread the needle of space classism, offering one high-performance feature on an otherwise cheap hull.
In this case, the feature was autonomy. The Nomad boasts a fuel capacity that rivals ships twice its size, achieved by sacrificing almost all crew comforts and cargo space.
It is a ship designed to go far, if not fast or comfortably.
The ship's early models were popular with claim-jumpers and independent surveyors.
They were small enough to avoid appearing as a threat on sensors but had the range to ""go dark"" and operate far from the main shipping lanes.
The name became synonymous with pilots who lived on the fringes, trusting no one but themselves and the reliability of their long-range fuel tanks.
This particular Nomad has likely been hot-swapped multiple times in back-alley docks.
Its transponder codes are clean, but its engine housing has tool marks that suggest hasty, non-standard modifications.
The light hull and modest cargo bay make it an excellent choice for an explorer, a courier, or someone who needs to be somewhere they aren't supposed to be.`,
        saleLocationId: locationMap["Moon"],
        spawnChance: 0.4,
        spawnTrigger: "Always available",
        isRare: true,
        mechanicIds: []
    },
    "Rooster.Ship": {
        name: "Rooster",
        class: "C",
        price: 42000,
        maxHealth: 100,
        cargoCapacity: 65,
        maxFuel: 110,
        role: "Balanced",
        attribute: "None",
        description: "A solid, assertive design from Earth's dominant shipyards, the Rooster is for the captain who wants a ship that can take a hit, carry a decent load, and still look good doing it.",
        lore: `The Rooster is a pure-bred Terran Alliance design, a ship that exudes the confidence of Earth's clean and advanced manufacturing.
It was not built for the rough-and-tumble life of a freelancer;
it was designed as a high-speed executive shuttle and priority courier for the inner system.
Its purpose was to move high-value personnel and proprietary technology between Earth, Luna, and the orbital stations of the Venus.
The ship's aggressive, forward-swept design and high-performance engine profile earned it the nickname ""Rooster"" among orbital traffic controllers.
It was known for crowing its priority codes, demanding immediate docking clearance as it darted through commercial traffic.
Its solid hull and balanced systems were a mark of its quality, built to protect its valuable cargo and passengers at all costs.
As a balanced ship, it's a master of none but a jack-of-all-trades.
It has enough speed to be interesting, enough armor to be reassuring, and a cargo bay large enough for specialized, high-profit goods.
It's a ship for a captain who wants to maintain a low-level of corporate-style professionalism.
This hull was likely part of a corporate fleet that was cycled out after only a few years of service to make way for a newer model.
On Earth, technology iterates quickly, and yesterday's luxury transport is today's surplus.
It was sold on the open market, its new ship smell barely faded, representing a significant step up for any independent captain.
Owning a Rooster is a sign that a pilot has moved beyond simple survival.
It’s a ship that implies a certain level of success and discretion.
It’s fast, reliable, and just stylish enough to get you noticed by the kinds of clients who pay well for a captain who looks the part.`,
        saleLocationId: locationMap["Earth"],
        spawnChance: 0.4,
        spawnTrigger: "Always available",
        isRare: true,
        mechanicIds: []
    },
    "Mesa.Ship": {
        name: "Mesa",
        class: "C",
        price: 44000,
        maxHealth: 50,
        cargoCapacity: 100,
        maxFuel: 70,
        role: "Hauler",
        attribute: "None",
        description: "A classic Martian-built freighter, it is essentially a flying warehouse designed to move bulk goods between the surface and orbital transfer stations.",
        lore: `The Mesa is a Martian workhorse, as blunt and functional as the corporate nation-state that built it.
Following the Martian Breakthrough, the new-found independent colony needed its own logistical backbone.
The Mesa was the answer: a mass-produced, low-cost, high-capacity hauler designed to move bulk materials around the red planet's orbit.
It is named for the flat, wide, and unglamorous geological formations that dot its homeworld.
This ship was built for one job: to move as much mass as possible from Point A to Point B, assuming both points were within the same gravity well.
Its low fuel tank and mediocre hull were cost-saving measures, as it was assumed these ships would always operate under the protection of Martian corporate security, running goods from orbital foundries to interplanetary transfer stations.
The design is utilitarian to a fault. The cockpit is a reinforced box with a viewport.
The engine is the cheapest model that could reliably push its maximum cargo load.
The ship's entire philosophy is built around its cavernous, easily-accessible cargo bay.
It is the very definition of a cog in the great machine of commerce.
These vessels are now common on the Martian second-hand market.
As the larger corporations upgrade to more efficient haulers, the older Mesas are sold off to independent captains and smaller outfits.
They are a common first ""pure hauler"" for traders looking to capitalize on the high-volume needs of the Martian industrial machine.
To pilot a Mesa is to embrace a life of pure profit-driven logistics.
It’s a slow, lumbering beast that handles like a brick, but its ability to haul cargo makes it one of the most profitable ships in its class.
It is a tool for the captain who studies manifests, not star charts.`,
        saleLocationId: locationMap["Mars"],
        spawnChance: 0.4,
        spawnTrigger: "Always available",
        isRare: true,
        mechanicIds: []
    },
    "Pathfinder.Ship": {
        name: "Pathfinder",
        class: "B",
        price: 145000,
        maxHealth: 40,
        cargoCapacity: 50,
        maxFuel: 260,
        role: "Explorer",
        attribute: "None",
        description: "Commissioned in the private yards of Venus, this ship was built for quiet observation and rapid departure, favoring a cold-running engine over a thick hull.",
        lore: `The Pathfinder is a ship with a shrouded past, intrinsically linked to the opulent and clandestine circles of its home port.
It was not built by a major corporation but was commissioned by a private equity group operating from Venus—a known front for the Venetian Syndicate.
Its design purpose was not exploration in the scientific sense, but surveillance.
It was created to be a high-end ghost for the Syndicate's intelligence networks.
The ship's true value lies in its advanced, non-standard sensor suite and its high-efficiency drive, which runs colder than most military vessels, making it difficult to track.
Its high fuel capacity allows it to sit ""dark"" in a distant orbit for weeks, monitoring comms traffic or tracking the movement of a rival's cargo.
The modest cargo bay was designed not for commodities, but for transporting compromising data, high-value assets, or a single, well-paid infiltrator.
The Pathfinder line is rarely seen on the open market.
When one does appear, it's usually because its previous owner met an unfortunate end or needed to disappear, liquidating their assets through a discreet broker.
The ship has been scrubbed of its most illicit hardware, but its core strengths remain.
Its light hull is a liability, but the ship was never intended to be in harm's way.
Purchasing a Pathfinder is a significant investment. Captains who buy them are often those who understand that in the cold war fought with cargo manifests, information is the most valuable commodity.
It’s a ship for a pilot who prefers to know the location of the next deal before they ever engage the drive.`,
        saleLocationId: locationMap["Venus"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Odyssey.Ship": {
        name: "Odyssey",
        class: "B",
        price: 150000,
        maxHealth: 120,
        cargoCapacity: 110,
        maxFuel: 120,
        role: "Balanced",
        attribute: "None",
        description: "More fortress than freighter, this is a rugged, dependable vessel for the captain who expects trouble and intends to survive it.",
        lore: `The Odyssey is a direct descendant of the ships that defined the Helium Rush.
As Luna's economy boomed, the need arose for a vessel that could do more than just haul or scout;
a ship was needed to protect the new trade lanes, move valuable assets securely, and ferry executives between Earth and the increasingly wealthy lunar settlements.
The Odyssey was the answer: a high-end, balanced ship with an emphasis on durability.
Its most defining feature is its hull, which is massively over-spec'd for a ship of its size.
This toughness made it a favorite among private security contractors and Guild-sanctioned convoy leaders.
It was a ship that could take a hit—or several—and keep its cargo and crew intact.
Its name, ""Odyssey,"" was a marketing ploy, suggesting a vessel capable of surviving a long, perilous, and ultimately heroic journey.
The ship is a status symbol on the Moon. While a C-class ship gets you into the trade, an Odyssey proves you're successful enough to afford protection and professional enough to be taken seriously.
Its balanced profile makes it a true all-rounder, capable of hauling a respectable load, exploring a new route, or running a high-risk delivery.
This particular craft has been well-maintained, its armor patched and its engine serviced regularly.
The interior is professional and clean, with a small but secure brig and a dedicated, shielded strongbox for high-value goods, betraying its past in corporate security.
This is a ship for the captain who has graduated from desperation to ambition, a solid, reliable, and powerful tool for taking on more dangerous and lucrative contracts across the system.`,
        saleLocationId: locationMap["Moon"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Pilgrim.Ship": {
        name: "Pilgrim",
        class: "B",
        price: 150000,
        maxHealth: 60,
        cargoCapacity: 175,
        maxFuel: 90,
        role: "Hauler",
        attribute: "None",
        description: "A specialized ice-hauler, this ship sacrifices armor and speed for a massive, reinforced cargo bay, making it a pure-profit engine for the patient trader.",
        lore: `The Pilgrim is a ship built for the lonely, far-flung edges of the system.
Manufactured in the cold, automated shipyards of Neptune's moons, it was designed for a single purpose: to service the fledgling outposts, ice-mining operations, and deep-space observatories of the outer planets.
Its namesake is a term for the contract-haulers who made the pilgrimage from the inner system, a journey that could take months.
This ship is the very definition of a long-haul freighter. Its design philosophy is simple: maximize cargo at all costs.
To achieve this, its designers made deep cuts to its fuel capacity and hull assuming that the vast emptiness of the outer system was its own defense.
Pilgrims are not fast, nor are they tough; they are simply large.
The ship's interior is minimal but built for long-duration trips.
The life support system is oversized and heavily redundant, and the small crew cabin features a robust nutrient synthesizer and water recycler.
Pilots of these ships are known for their patience and meticulous planning, as running out of fuel this far out is a death sentence.
Finding one for sale on Neptune is common, as they are the backbone of the local economy.
They are often sold by captains who have either made their fortune and are retiring, or by the estates of those who miscalculated a fuel burn and never returned.
It's a ship that represents a massive gamble on the cold, impartial logic of the manifest.
To captain a Pilgrim is to commit to a life of high-stakes logistics.
It’s a specialized tool for the trader who intends to profit from the system's most distant and demanding routes, where the only things that matter are the cargo capacity and the long, silent countdown to arrival.`,
        saleLocationId: locationMap["Neptune"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Meridian.Ship": {
        name: "Meridian",
        class: "B",
        price: 155000,
        maxHealth: 100,
        cargoCapacity: 70,
        maxFuel: 230,
        role: "Explorer",
        attribute: "None",
        description: "With a massive fuel reserve and a robust sensor array, the Meridian is a self-sufficient explorer, capable of operating for months in the uncharted deep.",
        lore: `The Meridian is a product of Jupiter's massive, corporate-run industrial machine.
It was designed as a high-endurance survey and exploration vessel for the Jovian Mining Consortium, a powerful corporate state that is constantly seeking to expand its resource claims.
The name ""Meridian"" refers to its purpose: to chart new boundaries and map the vast, resource-rich, and dangerous territory of Jupiter's moons.
This ship is a direct answer to the Pathfinder. Where the Pathfinder is a light, stealthy spy, the Meridian is a robust, self-sufficient, corporate-backed explorer.
Its impressive fuel tank allows for long-duration missions without refueling, and its robust hull and cargo bay mean it can withstand punishment, conduct its own mining surveys, and bring back valuable samples.
The Meridian is a symbol of corporate reach. Its engines are powerful, its sensors are top-of-the-line, and its hull is stamped with the mark of Jupiter's finest shipyards.
These ships are often the first to enter a new asteroid field or a previously uncharted gas cloud, their logs filled with proprietary survey data worth a fortune.
This vessel was likely sold on the open market after being retired from a corporate fleet, not because of a flaw, but because it had been superseded by a newer model.
Its service history is classified, but its performance is undeniable.
It's a ship for a captain who wants to take on serious, high-paying contracts.
Owning a Meridian signifies that a pilot has crossed the line from freelancer to professional.
It's a serious ship for serious work, capable of opening up new routes and discovering the resources that fuel the entire system-wide technological dependency.`,
        saleLocationId: locationMap["Jupiter"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Raven.Ship": {
        name: "Raven",
        class: "B",
        price: 160000,
        maxHealth: 210,
        cargoCapacity: 80,
        maxFuel: 110,
        role: "Balanced",
        attribute: "None",
        description: "A common sight in the lawless asteroid fields, this ship is a tough-as-nails workhorse for the captain who values armor above all else.",
        lore: `The Raven is a ship born of necessity in the lawless expanse of the Asteroid Belt.
It is not a product of a single, polished shipyard, but a popular, rugged design built by a dozen different independent fabricators within the Asteroid Belt.
Its design is a direct response to the region's primary dangers: catastrophic debris impacts.
The ship's most notable feature is its armor. With an impressive hull rating, it is one of the toughest ships in its class.
Its name comes from its appearance: the thick, dark, non-reflective armor plating, often patched and re-welded, gives it the look of a dark, menacing bird.
Ravens are the preferred ships of Belt-based security patrols and traders who have to haul valuable, unrefined ore.
Its fuel and cargo capacity are substantial, making it a truly independent operator.
This particular ship is a typical Belter vessel. The hull is a patchwork of different plate dented by micrometeorites.
The interior is purely functional with little crew comforts. The air smells of recycled oxygen and the faint, coppery tang of spent energy cells.
Buying a Raven in The Belt is an admission that you are operating in a place where law is a distant concept.
It's a ship for the captain who has embraced danger and decided that the best defense is a hull that simply refuses to break.`,
        saleLocationId: locationMap["The Belt"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Warden.Ship": {
        name: "Warden",
        class: "B",
        price: 165000,
        maxHealth: 70,
        cargoCapacity: 160,
        maxFuel: 160,
        role: "Hauler",
        attribute: "None",
        description: "Built in the subterranean yards of Pluto, this ship's specialty is the extreme long-haul, where reliability and cargo size are the only stats that matter.",
        lore: `The Warden is a ship built for the most extreme logistics in the solar system.
Typically operating from Pluto, a cold, dark, and unimaginably distant port, this vessel was designed to be a keeper of cargo on the longest, loneliest routes imaginable.
It is a hauler that borders on being a light capital ship, a warden against the three great threats of the deep void: time, distance, and decay.
Its primary feature is its enormous cargo capacity, a hold designed to make the multi-month trips from the Kuiper Belt profitable.
Unlike the Pilgrim, which is a bulk hauler, the Warden has a more balanced design.
Its solid hull and decent fuel tank make it more self-sufficient, capable of surviving a long, dark journey where rescue is impossible.
These ships are manufactured in the deep, pressurized shipyards beneath Pluto's surface.
They are built to be utterly reliable as any major failure this far out is fatal.
The Warden's captains are a unique breed, part-trader, part-hermit, who sign on for journeys that can last the better part of a year.
The ship itself is slow and ponderous, its movements dictated by the cold calculus of orbital mechanics and fuel conservation.
The interior is spacious, like a small habitat rather than a cockpit.
Its systems are designed for minimal power draw, and its engine is a low-temperature, high-efficiency model that can run for years without maintenance.
A Warden for sale on Pluto is a rare and serious purchase.
It is the key to some of the system's most dangerous and most profitable long-haul routes.
It is a ship for the captain who has transcended the cold trade wars of the inner system and chosen to do business with the unforgiving void itself.`,
        saleLocationId: locationMap["Pluto"],
        spawnChance: 0.3,
        spawnTrigger: "Tier 3 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Aegis.Ship": {
        name: "Aegis",
        class: "A",
        price: 590000,
        maxHealth: 200,
        cargoCapacity: 100,
        maxFuel: 300,
        role: "Explorer",
        attribute: "None",
        description: "This vessel's massive fuel reserves and fortified engineering deck are a masterpiece of Martian design, intended for captains who plan to be the first to arrive and the last to leave.",
        lore: `The Aegis is the pinnacle of Martian corporate engineering, a vessel designed not just to explore, but to dominate an exploration sector.
It is the flagship of the ""Aegis"" line, a project born from the Martian state's desire to achieve technological independence from Earth .
The ship represents a massive investment, a clear signal that Mars is no longer just a colony, but a system power in its own right.
Its name, ""Aegis,"" means ""shield,"" and it was designed to be the shield of Martian interests—a self-sufficient, long-range expeditionary vessel.
Its design philosophy is one of overwhelming endurance. A massive fuel capacity is paired with a robust hull, allowing it to operate independently for extreme durations in dangerous, uncharted territory.
This is not a ship for casual scouting; it is a ship for high-stakes missions.
Its advanced sensor suites are rumored to be capable of detecting high-performance folded-space drive activations at extreme range, a direct counter to the Venetian Syndicate's stealth vessels.
The cargo bay is not intended for bulk trade, but for hauling modular equipment, scientific labs, or high-yield resource samples.
This vessel's appearance on the Martian open market is an extremely rare event.
It is likely a surplus model from a previous procurement contract, sold to a highly-vetted buyer to recoup costs.
Its systems are top-tier, and its engine is a masterpiece of Martian efficiency. The interior is military-grade but spacious.
To acquire an Aegis is to purchase a piece of corporate-military hardware.
It is a ship that tells the system you are no longer just a trader;
you are a serious operator, capable of undertaking the most demanding, long-term contracts that the Merchant's Guild or a corporate state can offer.`,
        saleLocationId: locationMap["Mars"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 4 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Forerunner.Ship": {
        name: "Forerunner",
        class: "A",
        price: 600000,
        maxHealth: 290,
        cargoCapacity: 160,
        maxFuel: 150,
        role: "Balanced",
        attribute: "None",
        description: "A fortress of composite plate and reinforced steel, its design is a brutalist statement on survival in the system's most lawless territory.",
        lore: `The Forerunner is a legend of the Belt, a ship that has earned a reputation for being the toughest, meanest, and most survivable vessel outside of a capital ship.
It is not the product of a clean corporate shipyard;
it is an up-armored brawler, a design that has been iterated upon in the independent, often illicit, fabrication bays of the asteroid fields.
Its origin is a direct response to the cold trade war of commerce.
The Forerunner's stats tell a story of brutal priorities. Its hull is its most prominent feature, a massive layer of ablative and composite armor designed to withstand excessive punishment.
This protection is balanced with a powerful engine and a large cargo bay, creating a ship that can run a high-value, high-risk routes for months without maintenance.
Its name, ""Forerunner,"" is a title of respect given by Belter miners.
A Forerunner is often the first ship into a hot new asteroid claim before the area is scrubbed of minor debris.
It is the chosen vessel of convoy leaders, Guild enforcers, and the most successful traders in the outer system.
This particular ship is scarred from bow to stern. Its armor is a patchwork of replacements and its transponder has been erased more than once.
The interior is cramped, sacrificing crew comfort for storage and reinforced bulkheads.
To buy a Forerunner is to buy a reputation. It is a ship that sends a clear message in every port it visits: Do not interfere.
It is the ultimate tool for the captain who must navigate the most dangerous trade lanes and is willing to brute force their way through any asteroid field to ensure their cargo—and their life—reaches its destination.`,
        saleLocationId: locationMap["The Belt"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 4 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Guardian.Ship": {
        name: "Guardian",
        class: "A",
        price: 590000,
        maxHealth: 130,
        cargoCapacity: 230,
        maxFuel: 165,
        role: "Hauler",
        attribute: "None",
        description: "The pride of Saturn's merchant fleet, this \"\"merchant cruiser\"\" was designed to haul and protect vast fortunes of refined ring-ice and exotic gases.",
        lore: `The Guardian is the pride of Saturn's ring-cities, a merchant cruiser that represents the pinnacle of defensible commerce.
Manufactured in the zero-G shipyards of Titan, it was designed for the powerful merchant houses of the Saturn system, who needed to move vast quantities of high-value goods (like refined Helium-3 or exotic atmospheric compounds) over long, exposed routes.
It is a hauler that redefines the term, blending capacity with fortitude.
Its design is a direct rejection of the cheap hauler philosophy.
The Guardian boasts a colossal cargo capacity but, unlike its peers, it does not sacrifice defense.
A respectable hull and a solid fuel tank make it a formidable vessel.
Its name is a statement of intent: it does not just carry cargo; it protects it.
These ships are the backbone of the interstellar supply lines that prop up the corporate states.
They are often seen running in small, self-sufficient convoys, their hulls gleaming with the insignia of Saturn's powerful corporations.
They are a status symbol, a sign that a trading house has so much wealth that it can afford to protect it with the best ships money can buy.
This particular Guardian was likely the flagship of a successful independent merchant.
Its cargo bay is immaculate, with high-security locks, biometric scanners, and independent stasis fields for volatile goods.
The cockpit is professional, with redundant navigation and communication systems designed for coordinating with an escort.
Owning a Guardian is a sign that a captain has reached the big leagues.
It is a ship for the merchant prince, a pilot who no longer deals in scraps and single contracts, but in massive, long-term manifests that are the lifeblood of the entire system.`,
        saleLocationId: locationMap["Saturn"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 4 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Valiant.Ship": {
        name: "Valiant",
        class: "A",
        price: 580000,
        maxHealth: 100,
        cargoCapacity: 125,
        maxFuel: 375,
        role: "Explorer",
        attribute: "None",
        description: "A marvel of Jovian engineering, this elite explorer was built for missions of extreme duration, carrying enough fuel to cross the system and back.",
        lore: `The Valiant is the apex predator of the exploration class, a ship that embodies the limitless ambition of the Jovian corporate state.
While the Meridian was built to chart Jupiter's territory, the Valiant was built to conquer it.
It is an extreme long-range, high-performance explorer, created for only the most elite corporate-sponsored expeditionary captains.
Its purpose: to operate for unheard-of durations, far from any support, in the most hostile environments the system has to offer.
This ship is an engineering marvel, defined by its staggering fuel capacity.
This endurance is paired with a strong hull and a versatile cargo bay, making it utterly self-sufficient.
It doesn't just visit a new sector; it moves in.

The Valiant line is almost never for sale.
They are mission-critical assets for the Jovian consortium. Their sensor logs and nav charts are some of the most closely-guarded secrets in the system.
The name itself is a piece of corporate propaganda, meant to inspire tales of heroic, ""valiant"" explorers pushing the boundaries of human space—all in the name of the corporation.
This ship is pristine, its systems far in advance of standard military tech.
To pilot a Valiant is to be at the absolute pinnacle of the class and adventure.`,
        saleLocationId: locationMap["Jupiter"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 5 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Eagle.Ship": {
        name: "Eagle",
        class: "A",
        price: 630000,
        maxHealth: 210,
        cargoCapacity: 200,
        maxFuel: 220,
        role: "Balanced",
        attribute: "None",
        description: "The pinnacle of Terran design, this ship is a perfect harmony of power, protection, and performance—a master-of-all-trades for the truly elite captain.",
        lore: `The Eagle is the physical expression of the Terran Alliance's technological and economic superiority.
It is not merely a ship; it's a symbol of Earth's advanced manufacturing .
While other corps build brutalist brawlers or spartan haulers, Earth builds the Eagle: a sleek, powerful, and perfectly balanced vessel that is as much a work of art as it is a tool of commerce.
Its design is one of total harmony. A powerful, high-efficiency engine is paired with a thick advanced alloy hull and a substantial, automated cargo bay.
It is the perfect ship for the independent captain, a master-of-all-trades that compromises on nothing.
It can explore, it can fight, it can haul—and it does all three with an elegance that is unmistakably Terran.
The Eagle is named for the ancient bird of prey, a symbol of power and vision.
These ships are favored by the Merchant's Guild for their personal transports, by elite Terran diplomats, and by the wealthiest freelance captains.
Its high-performance parts are sourced directly from Earth.

Finding an Eagle for sale on Earth is a privilege.
They are sold only through exclusive Terran shipyards to captains with a spotless reputation and a massive bank account.
The interior is luxurious, the controls are seamless, and the ship's integrated AI  is sophisticated, if not truly sentient.
To own an Eagle is to have obtained the ultimate status symbol for a freelance captain, a ship that grants access to exclusive markets and the respect of the system's greatest powers.
It is fast, tough, beautiful, and a testament to success.`,
        saleLocationId: locationMap["Earth"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 5 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Tundra.Ship": {
        name: "Tundra",
        class: "A",
        price: 620000,
        maxHealth: 100,
        cargoCapacity: 330,
        maxFuel: 170,
        role: "Hauler",
        attribute: "None",
        description: "A true super-freighter from the Neptune yards, this ship is little more than a powerful engine and a cockpit bolted to a cargo hold of truly colossal proportions.",
        lore: `The Tundra is the final word in interplanetary logistics, a colossal hauler built in the deep, cold shipyards of Neptune.
If the Pilgrim and Warden are the system's long-haul trucks, the Tundra is its supertanker.
It was designed by a consortium of outer-system corporations who needed a way to move truly staggering quantities of raw materials—ice, methane, and rare minerals—from the Kuiper Belt to the inner system.
This ship is defined by its cargo capacity, a cavernous maw that dwarfs almost every other vessel.
To make this possible, the ship is built around a massive, reinforced structural spine, with the cargo pods, engine, and cockpit bolted on as modular components.
It is less a ship and more a ""cargo-engine,"" a minimalist design that is brutally efficient.
The Tundra's name reflects its operating environment: it is vast, cold, and unforgiving.
Its hull is just thick enough to withstand the stresses of its own mass and the dangers of navigating icy, uncharted asteroid fields.
Its fuel tank is massive, giving it the endurance needed for the months-long, slow-burn trajectories that define its trade routes.
These ships are the titans of the interstellar supply lines.
A single, fully-laden Tundra can represent a significant percentage of a smaller corporate state's quarterly resources.
Their captains are master logisticians, more concerned with fuel-to-mass ratios and orbital mechanics than with docking gossip.
To see a Tundra for sale on Neptune is to see an opportunity of immense scale.
These ships are rarely decommissioned; they are simply too valuable.
This is a ship for the captain who is ready to move beyond a mere cargo manifest and start thinking in terms of global economic influence.`,
        saleLocationId: locationMap["Neptune"],
        spawnChance: 0.2,
        spawnTrigger: "Tier 5 Unlock",
        isRare: true,
        mechanicIds: []
    },
    "Atlas.Ship": {
        name: "Atlas",
        class: "S",
        price: 1850000,
        maxHealth: 180,
        cargoCapacity: 240,
        maxFuel: 425,
        role: "Explorer",
        attribute: "Traveller: Every 20 trips, completely restore hull and fuel.",
        description: "Rumored to be the only ship that truly loves the journey, its experimental systems seem to thrive on the stress of travel, mending its own hull and generating fuel over time.",
        lore: `The Atlas is a ship of myths, a vessel that has transcended its origins to become a legend among freelance captains.
It was not built by a single corporation but was a secret project by a collective of disgruntled, genius-level engineers from the shipyards of Saturn and Jupiter.
They were tired of the Ship-Divide and the planned obsolescence of corporate hardware.
Their goal was to build a ""forever ship,"" a vessel that could truly bear the weight of the heavens on its shoulders.
They pooled their resources and requisitioned proprietary components, including a one-of-a-kind, self-calibrating folded-space drive.
The ship's most remarkable feature is an experimental, non-standard energy core linked to the drive.
Every time the ship pierces spacetime, the core builds a resonant charge, and on the 20th cycle, it purges this energy, flash-repairing the hull's micro-fractures and re-ionizing the fuel supply.
It is a ship that heals itself with travel.

The prototype was a staggering success, far exceeding its designers' expectations.
It became a ship that could truly wander indefinitely. Its massive fuel tank and robust hull are secondary to its unique core.
The original Atlas vanished into the void, rumored to be piloted by its creators on a one-way trip to the stars.
The blueprints were thought lost, but they eventually surfaced, sold by a shadowy broker on Saturn.
Now, a handful of these vessels are painstakingly recreated by a master shipwright who caters to the system's wealthiest clientele.
To own an Atlas is to own a piece of engineering folklore.
It is a ship for the true explorer, the captain who feels the pull of the Solar Boundary and wishes to see what lies beyond.
It is less a tool of commerce and more a philosophical statement: a vessel that travels endlessly.`,
        saleLocationId: locationMap["Saturn"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_TRAVELLER']
    },
    "Vindicator.Ship": {
        name: "Vindicator",
        class: "S",
        price: 1200000,
        maxHealth: 400,
        cargoCapacity: 240,
        maxFuel: 255,
        role: "Balanced",
        attribute: "Trader: 15% chance to receive 1 extra unit for free on purchase.",
        description: "With a hull built for brawling and a cargo bay built for skimming, this ship is for the captain who believes a good deal is one you make for yourself.",
        lore: `The Vindicator is a ship with a reputation.
It is manufactured in the isolated, automated dockyards of Uranus, a port known for its loose regulations.
The ship's design was commissioned by a powerful, semi-legitimate trading consortium that specialized in aggressive procurement.
Its core design is that of a balanced heavy freighter, with a powerful engine and a truly formidable hull.
It is, in essence, a blockade runner and a privateer's vessel, designed to force its way into a market, secure a deal, and force its way back out.
Its very presence is an act of intimidation, a vindication of its owner's right to trade, by any means necessary.
The ship's unique attribute is a series of hidden, illegal subsystems.
It includes high-speed cargo slicers for automated loading docks, ghost-loaders that add extra, un-logged containers, and sophisticated AI-driven rounding errors for digital manifests.
It is a ship built to cheat the system, an infamous tool for navigating market manipulation.
These ships are the terror of the outer-system trade routes.
The Merchant's Guild publicly decries their use, but many illicit traders are rumored to use them for their most deniable operations.
A Vindicator is not just a ship; it is a license to steal, provided you are smart enough not to get caught.
Purchasing a Vindicator is a massive investment and a dangerous statement.
It tells the system you are a sneaky player in the economic game, and you are not above tipping the scales in your favor.
It is the perfect ship for the ruthless captain for whom wealth is not just a motto, but an absolute.`,
        saleLocationId: locationMap["Uranus"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_TRADER']
    },
    "Radiant.Ship": {
        name: "Radiant",
        class: "S",
        price: 1750000,
        maxHealth: 170,
        cargoCapacity: 380,
        maxFuel: 280,
        role: "Hauler",
        attribute: "Hot Delivery: Cargo less than 45 days old sells at 5% additional profit.",
        description: "A high-speed courier from Kepler's Eye, this ship's stasis-equipped hold is designed to move volatile prototypes and fresh discoveries at maximum velocity.",
        lore: `The Radiant is the ultimate expression of the just-in-time economy, a high-performance hauler built for speed and priority.
It is manufactured exclusively at Kepler's Eye, the system's most advanced scientific and technological outpost, a place where new discoveries and volatile prototypes are created daily.
These high-value items often have a short shelf-life, requiring immediate, rapid transport to clients in the inner system.
The Radiant was designed to meet this need. It is a hauler with a massive cargo bay that thinks it's an explorer, boasting a high-performance engine and a specialized, stasis-equipped cargo bay.
Its name, Radiant, refers to the bright, fleeting glow of its high-velocity engine burn, as well as the high-energy, often radioactive, prototypes it was designed to carry.
Its cargo holds are equipped with advanced temporal stabilizers and status-monitors, which preserve the freshness of volatile goods, from rare isotopes to cloned organs.
This guarantees a premium price for cargo that is delivered quickly, rewarding the captain for speed and efficiency.
These ships are the prized possession of the system's most elite couriers.
They are the only vessels trusted to move new artifacts or newly-synthesized compounds.
A Radiant streaking across the system is a common sight for astronomers, a hot delivery that is likely worth more than a C-class station.
To own a Radiant is to be in the business of speed.
It is a ship for the captain who understands that in the 22nd century, the razor's edge is not just about what you carry, but how fast you carry it.
It is the perfect tool for the get-it-there-yesterday contracts that pay a fortune.`,
        saleLocationId: locationMap["Kepler's Eye"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_HOT_DELIVERY']
    },
    "Aesudon.Ship": {
        name: "Aesudon",
        class: "S",
        price: 1700000,
        maxHealth: 250,
        cargoCapacity: 200,
        maxFuel: 465,
        role: "Explorer",
        attribute: "Resilient: Hull decays 50% slower.",
        description: "Its unique hull composition is a fanatical study in endurance, designed to shrug off the slow decay of time and travel.",
        lore: `The Aesudon is a ship built by paranoia.
Its blueprints were not drafted by a corporation, but by a reclusive, trillion-credit heir on Pluto who was convinced the system was doomed to a slow, entropic death.
This heir spent their entire fortune on a single goal: to build a vessel that could simply outlast the apocalypse, a personal ark that could drift in the void for a countless years.
This ship's construction is a legend of the Pluto shipyards where construction on the vessel lasted decades.
Its hull is not a standard alloy, but a laminated composite of exotic, deep-space materials, layered and pressure-treated to be uniquely resistant to the micro-fractures and stresses of long-term void exposure.
It takes on wear slower than any other ship, not because it is alien, but because it was obsessively, fanatically over-engineered.
Aesudon's massive fuel tanks were designed to be filled once, allowing it to coast on a single burn for a years.
The original owner, upon its completion, provisioned the vessel, boarded it, and was last seen heading for the Kuiper Belt.
They were never heard from again. The ship, however, reappeared fifty years later, its transponder dark, its fuel tanks still half-full, and its log wiped.
It was recovered by a Merchant's Guild patrol and brought to Pluto, a ghost ship whose resilience is proven.
It is a ship built for any long, quiet, and lonely journey.
Its internal systems are spartan but redundant on a scale that borders on the insane, with triple-backups for every core function.
To acquire the Aesudon is to buy a masterpiece of engineering.
It is a ship for the captain who trusts no one and nothing but the integrity of their own hull, a vessel designed to endure when all others have turned to dust.`,
        saleLocationId: locationMap["Pluto"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_RESILIENT']
    },
    "Pterodactyl.Ship": {
        name: "Pterodactyl",
        class: "S",
        price: 1970000,
        maxHealth: 300,
        cargoCapacity: 230,
        maxFuel: 295,
        role: "Balanced",
        attribute: "Lucky: 4% increased profit from trades",
        description: "The flamboyant, winged flagship of the Venetian Syndicate's elite, this ship is rumored to be blessed, finding fortune and profit in the system's chaos.",
        lore: `The Pterodactyl is the personal transport of the Venetian Syndicate's most audacious and successful members.
Manufactured in the opulent, private orbital estates of Venus, its design is intentionally flamboyant, aggressive, and ostentatious.
Its wings, which house the main thrusters, give it a unique, reptilian silhouette, earning it the name Pterodactyl.
This ship is a pure expression of ambition. It is a high-performance machine for high-stakes players.
Its powerful engine and massive hull make it a formidable opponent in any situation, a ship that can get into and out of trouble with equal ease.
The ship's lucky reputation is the talk of the system.
It is not luck, but a suite of the most advanced probability-analysis and social-engineering software in existence.
This special core runs constant, subtle simulations, predicting and manipulating outcomes.
It suggests the right comms frequency for a random distress call, advises the captain to take a specific route that happens to intercept a high-value derelict, and scrubs Guild records to ensure the credit reward is... generous.
These ships are rarely sold but instead are granted. They are given to Syndicate members who have provided the most compromising information and proven their loyalty.
To see one on the open market on Venus means its previous owner has been retired. Permanently.
To acquire a Pterodactyl is to fly the flag of the Venetian Syndicate.
It is a ship that announces its owner's ambition, a tool that seems to bend the laws of chance itself.
It is the ultimate gambler's vessel, for the captain who knows that in the great game, you make your own luck.`,
        saleLocationId: locationMap["Venus"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_LUCKY']
    },
    "Sovereign.Ship": {
        name: "Sovereign",
        class: "S",
        price: 2130000,
        maxHealth: 250,
        cargoCapacity: 420,
        maxFuel: 220,
        role: "Hauler",
        attribute: "Corporate Partner: Cargo purchased from Earth is 5% cheaper",
        description: "A hauler with the elegance of a Terran cruiser, this ship is a symbol of ultimate economic power, an alliance between the Guild and the Alliance made manifest in steel.",
        lore: `The Sovereign is the ultimate expression of the great game of commerce.
It is a hauler of immense capacity, but it is also a political statement.
This ship is the result of an exclusive, back-room deal between the Terran Alliance and the Merchant's Guild, manufactured only at the neutral hub of The Exchange.
It is the ship of a true merchant prince.

Its design is a hybrid of Earth's clean manufacturing and the Guild's ruthless pragmatism.
It has the massive capacity of a hauler, but the high-efficiency engine of a Terran cruiser.
Its hull is thick, not with armor, but with the advanced, proprietary components that only Earth can provide.
The ship's corporate partnership is its entire reason for being. It is a physical manifestation of a trade pact.
Its identification and transponder codes are hard-coded into the Terran Alliance's central economic computer.
When this ship docks specifically at Earth, it is given Alliance-partner status, granting its owner an automatic, non-negotiable discount on all purchases, a benefit worth millions.
The Sovereign is the personal vessel of the Merchant's Guild's most powerful and trusted human agents, and the corporate lords of the Corporate States.
It is the ship of the elite, a tool that solidifies their power and wealth by giving them an insurmountable edge in the system's most foundational market: home world Earth.
To be offered a Sovereign at The Exchange is a great privilege.
It is an invitation to join the ruling class. It is the ship that wields real, systemic economic power.`,
        saleLocationId: locationMap["The Exchange"],
        spawnChance: 0.15,
        spawnTrigger: "Tier 6 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_CORP_PARTNER']
    },
    "Titan.Ship": {
        name: "Titan",
        class: "O",
        price: 95000000,
        maxHealth: 250,
        cargoCapacity: 450,
        maxFuel: 400,
        role: "Capital",
        attribute: "Cryo-Storage: Cargo older than 1 year sells for 10% more.",
        description: "To command this capital ship is to govern a small city, a colossal cryo-ark built to play the long game of market manipulation.",
        lore: `The Titan is not merely a capital ship;
it is a mobile city-foundry, a colossal undertaking by the Jovian Mining Consortium.
Its construction took a full decade in the high-orbit shipyards of Jupiter, requiring the resources of a small moon.
It is a vessel with a crew of over five thousand, a self-contained ecosystem of engineers, technicians, navigators, and security personnel.
It is the very definition of a Capital ship.

Its purpose is not trade as lesser ships know it;
it is the market. The Titan was built to execute a strategy of economic patience.
Its core is a cryo-storage facility the size of a stadium, a technological marvel that flash-freezes entire harvests, mining yields, or manufacturing runs, stopping time for its cargo.
Its massive crew operates the vast, complex systems required to load, maintain, and eventually thaw this colossal bounty.
This capital ship moves with the slow, inevitable grace of a tectonic plate.
Its captain is not a pilot, but a governor, dictating policy to a population of thousands.
Its bridge is a command center, and its captain's quarters are a sprawling administrative suite.
When the Titan enters orbit, it does not dock; it anchors, and a fleet of smaller freighters swarms its hull to offload its time-locked cargo.
To acquire thee Titan is to buy a floating, crewed, operational headquarters.
It is a capital ship for the tycoon who no longer thinks in days, but in fiscal eras.`,
        saleLocationId: locationMap["Jupiter"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_CRYO_STORAGE']
    },
    "Behemoth.Ship": {
        name: "Behemoth",
        class: "O",
        price: 145000000,
        maxHealth: 260,
        cargoCapacity: 750,
        maxFuel: 425,
        role: "Capital",
        attribute: "Heavy: Travel time multiplied by 1.3.\nLoyalty: 10% discount on purchases from Saturn.",
        description: `Its journey is a migration, its crew a city, its cargo hold a cavern;\n this capital ship is the final word in large-scale logistics.`,
        lore: `The Behemoth is a vessel of such vulgar, terrifying scale that it is barely considered a ship.
It is the single largest moving object ever built by humanity, a product of Saturn's ring-miners who, in a fit of brutalist ambition, simply never stopped welding.
Its construction was more akin to the creation of an artificial moon, a decade-long project that employed over ten thousand engineers and laborers.
This vessel is itself a stellar supply line. Its crew complement is a city, a permanent population of technicians, security forces, and navigators who live their entire lives aboard.
Its cargo hold is not a bay; it is a region, a vast, pressurized cavern that can transport the entire, unprocessed output of a major mining colony in a single, lumbering journey.
Its engines, the size of skyscrapers, nearly struggle with the extreme mass of the vessel and as such it travels considerably slower than other ship.
Its fuel tanks are vast, and its gargantuan engines are a controlled industrial cataclysm.

The Behemoth does not travel;
it migrates. Its captain is an admiral, a logistician who commands a population and a moving territory.
To acquire this capital ship is not a purchase, but an appointment to lead and govern a small onboard economy.
It is the ultimate hammer of inevitable logistic.`,
        saleLocationId: locationMap["Saturn"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_HEAVY', 'ATTR_LOYALTY_SATURN']
    },
    "Citadel.Ship": {
        name: "Citadel",
        class: "O",
        price: 165000000,
        maxHealth: 270,
        cargoCapacity: 500,
        maxFuel: 475,
        role: "Capital",
        attribute: "Renown: 15% discount on refueling.",
        description: "To command this vessel is to wield the authority of Earth; its renowned status grants its governor privileges and discounts in every known port.",
        lore: `The Citadel is the flagship of the Terran Alliance, a radiant, gleaming symbol of Earth's technological and economic superiority.
It is less a ship and more a sovereign, mobile territory.
Its construction was the work of Earth's greatest AI-Human collaborative teams, a vessel so advanced and so resource-intensive that only the cradle of humanity could build it.
This Capital ship is a floating diplomatic city, with a permanent crew and staff of eight thousand.
It houses embassies, advanced research labs, sprawling hydroponic gardens, and the command-and-control centers for an entire sector of the Alliance fleet.
Its hull is not mere metal, but a gleaming, clean alloy that is the envy of the system, and its internal systems are managed by a sophisticated, near-sentient AI custodian.
Most impressive of all is its insane capacity for storage;
a cavernous space so vast that it can shelter numerous smaller ships.
The renowned Citadel is not just a capital ship; it is a presence. Its arrival is a diplomatic event.
Its transponder code is the highest-priority signal in the system, granting it immediate, non-negotiable access to all ports and a permanent, system-wide discount on all fuel.
To be granted command of the Citadel is to be anointed by the Alliance itself.
The ship, its crew, and its power are leased to the captain, a sign that they are no longer a simple trader, but a major, system-shaping power, an extension of Earth's own will.`,
        saleLocationId: locationMap["Earth"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_RENOWN']
    },
    "Sophistacles.Ship": {
        name: "Sophistacles",
        class: "O",
        price: 390000000,
        maxHealth: 280,
        cargoCapacity: 750,
        maxFuel: 340,
        role: "Capital",
        attribute: "VIP: 10% better prices at The Exchange.",
        description: "Built to be the ultimate private yacht, its robust, capital-class frame is hidden beneath a gleaming, pricelessly impractical hull.",
        lore: `The Sophistacles is the system's white elephant, a monument to luxury and a testament to an ambition that exceeded the market's reach.
This one-of-a-kind capital ship was commissioned by a forgotten Venusian socialite who went bankrupt before its completion.
It was designed to be the largest, most opulent private ""yacht"" ever built, a ""cruise ship"" for a single billionaire and ten thousand of their closest friends.
Its construction took fifteen years in a private, high-orbit dock above The Exchange, and the final cost was so astronomical that no one has ever been able to afford it.
It is a vessel of breathtaking, absurd luxury. Its hull is plated with a gleaming, pearlescent alloy that has no military value but costs more than a small fleet.
Its interior decks contain sprawling ballrooms, multi-level hydroponic gardens, concert halls, and private suites that are larger than most C-class ships.
Its crew of five thousand is a skeleton staff, a tiny fraction of the attendants it was designed to hold, kept on retainer by the Merchant's Guild just to maintain the ship's systems.
It has sat docked at The Exchange for a decade, a gleaming, silent testament to hubris.
The Guild, which now owns it through foreclosure, has been trying to sell it ever since.
It is a robust, powerful capital ship, its engines pristine and its cargo bays (originally designed for luxury vehicles and art) immense.
It is a palace waiting for a king, a ship so fancy and so expensive that its very existence is a legend among traders.
To acquire the Sophistacles is not just to buy a ship, but to buy a legend.
It is a purchase that announces to the system that the new owner has transcended the mere pursuit of wealth and is now in the business of pure, unadulterated status.`,
        saleLocationId: locationMap["The Exchange"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_VIP']
    },
    "Ouroboros.Ship": {
        name: "Ouroboros",
        class: "O",
        price: 480000000,
        maxHealth: 350,
        cargoCapacity: 800,
        maxFuel: 420,
        role: "Capital",
        attribute: "Entropic: Hull decays by 1 point per day.\nFrequent Flyer: 50% discount on hull repairs.",
        description: "Often mistaken for a small station, this absurd, one-of-a-kind toroidal ship is a rotating marvel of science and a nightmare of engineering.",
        lore: `The Ouroboros is a scientific marvel and an engineering nightmare.
This one-of-a-kind capital ship is the only vessel of its kind, an absurd, toroidal (donut-shaped) craft so large that it is frequently mistaken for a new, experimental space station by rookie pilots.
It was built at Kepler's Eye as a ""proof of concept"" for a self-contained, rotating habitat that could also serve as a long-duration exploration vessel.
Its core design is a massive, gently spinning ring, kilometers in diameter, which provides artificial gravity for its thousands of crew.
This design, however, makes the ship a maintenance hog. The advanced, fiendishly complex systems required to manage its rotation, balance its mass, and maintain its structural integrity are a constant drain on resources.
Its proprietary drive is woven through the toroidal hull, meaning a simple repair can require a week of system-wide shutdowns.
The ship is a legend among engineers, a ""cursed"" commission that no one wants to work on.
Its operational costs are ruinous, and its specialized components can only be fabricated at Kepler's Eye.
Its original scientific mission was cut short after its systems proved too complex to manage, and it has been sitting in a high-orbit dock ever since, its gentle spin the only sign of life.
The station is now selling it for a fraction of its build cost, desperate to unload the financial burden.
To buy the Ouroboros is to purchase a brilliant, flawed, and utterly unique piece of technology, a ship that offers the comfort of a station but demands the attention of a needy god.`,
        saleLocationId: locationMap["Kepler's Eye"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_ENTROPIC', 'ATTR_FREQUENT_FLYER']
    },
    "Thalassodromeus.Ship": {
        name: "Thalassodromeus",
        class: "O",
        price: 780000000,
        maxHealth: 300,
        cargoCapacity: 850,
        maxFuel: 680,
        role: "Capital",
        attribute: "Space Folding: Navigation costs only 1 day of travel, but 1.2x fuel.",
        description: "A one-of-a-kind, decommissioned fleet carrier, this city-sized vessel once housed an entire army and its own internal economy.",
        lore: `The Thalassodromeus is a decommissioned monster, a one-of-a-kind military behemoth that was, for a short time, the single most powerful object in the solar system.
This city-sized vessel was the Terran Alliance's prototype ""Fleet Carrier,"" a colossus designed to be a mobile base of operations, carrying dozens of smaller craft, hundreds of thousands of military personnel, and its own internal, self-sufficient economy.
Its scale is terrifying. It is a moving mountain of armor and decommissioned weapon ports.
Its interior is a labyrinth of hangar bays, troop barracks, command centers, and fabrication plants.
Its crew of twenty thousand was a permanent, floating population. This ship was not built for trade;
it was built to end wars.

Its most valuable, and secret, component is its drive.
It houses the first and only military-grade, prototype instant-jump folded-space drive, an engine that could move this entire city-sized mass to any point in the system in a single, gut-wrenching instant.
The drive was deemed too powerful and too destabilizing, and the entire ship class was canceled.
Now, after decades of service, the Alliance is auctioning off this lone giant from its Neptune anchorage.
Its armaments have been stripped, but the invaluable, city-sized hull and its one-of-a-kind prototype drive remain.
It is a ship for an owner who wants to command a small nation, a vessel of such colossal scale that its new purpose will reshape the system.`,
        saleLocationId: locationMap["Neptune"],
        spawnChance: 0.05,
        spawnTrigger: "Tier 7 Unlock",
        isRare: true,
        mechanicIds: ['ATTR_SPACE_FOLDING']
    },
    "EchoingShell.Ship": {
        name: "Echoing Shell",
        class: "Z",
        price: 3500000,
        maxHealth: 30,
        cargoCapacity: 450,
        maxFuel: 200,
        role: "Alien",
        attribute: "Xeno Hull: No hull decay from travel.",
        description: "A true xeno-biological craft, its hull is a living, regenerative membrane that never decays but it is also as fragile as bone. ",
        lore: `This one-of-a-kind vessel is the only truly xeno-alien craft ever recovered.
It is not a machine, but a biological entity—a ""ship-creature"" found dormant in the deep, frozen void.
It appears to be a shed carapace or larval form, a seamless, iridescent construct of bio-chitin that feels more like petrified bone than metal.
Its ""cockpit"" is a neural-interface cradle that a pilot must bond with, a process that risks madness.
Its first stable pilot reported that the ship did not ""speak,"" but simply ""echoed"" their own thoughts back to them, a hollow, sentient, and lonely shell.`,
        saleLocationId: locationMap["Pluto"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_XENO_HULL']
    },
    "ParallaxofThought.Ship": {
        name: "Parallax of Thought",
        class: "Z",
        price: 2800000,
        maxHealth: 200,
        cargoCapacity: 200,
        maxFuel: 180,
        role: "Alien",
        attribute: "Fuel Scoop: Restores 15% fuel after every trip.",
        description: "This vessel is an obsidian sphere that absorbs radiation from the stars, refueling itself over time. It's interface is controlled by an artificial super-intelligence.",
        lore: `This ship is a true, unbound Artificial Super-Intelligence.
It suddenly appeared in a stable orbit of Uranus, a perfect, seamless obsidian sphere with no visible drives.
It simply waited. When a science vessel approached, the sphere opened a flawless, circular aperture.
The interior was discovered to be a single glowing white room with no controls.
The ship's ASI core interfaces directly with a pilot's mind, communicating in pure concept.
It sips ambient radiation from the universe, slowly regenerating its own power. It is not a machine;
it is a vessel of pure, non-human logic.`,
        saleLocationId: locationMap["Uranus"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_FUEL_SCOOP']
    },
    "AnomalyoftheSong.Ship": {
        name: "Anomaly of the Song",
        class: "Z",
        price: 1800000,
        maxHealth: 100,
        cargoCapacity: 150,
        maxFuel: 150,
        role: "Alien",
        attribute: "Solar Sail: 15% chance to use no fuel at 2x travel time.",
        description: "A construct of crystal and light-sails, this ship's experimental drive can ride on solar winds, drifting on the song of the stars. Its systems are occupied by a personality construct of its creator. ",
        lore: `This vessel is the last testament of Dr. Elara Viend, a brilliant and terminally ill scientist.
She uploaded her personality construct into this experimental craft, a bizarre network of crystalline spars and gossamer-thin light-sails.
She believed the universe held a hidden song and launched herself into the void to find it.
Her mind, now one with the ship, perpetually broadcasts this song, a lonely, complex melody of human music and stellar radiation.
It is the ghost of a human mind in a beautiful, alien-looking shell.`,
        saleLocationId: locationMap["The Belt"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_SOLAR_SAIL']
    },
    "CausalityofSilence.Ship": {
        name: "Causality of Silence",
        class: "Z",
        price: 6000000,
        maxHealth: 20,
        cargoCapacity: 650,
        maxFuel: 100,
        role: "Alien",
        attribute: "Efficient: 25% reduced fuel consumption.",
        description: "This soft ship is a biological expert system for smuggling, its metabolic drive digesting fuel with impossible efficiency.",
        lore: `This vessel is a living, sub-sentient creature, not a machine.
It was grown in a secret bio-laboratory as a perfect, silent smuggler.
Its internal organs are a metabolic drive, digesting fuel with impossible efficiency, leaving no heat trace.
This soft-bodied hauler is a grotesque and brilliant feat of bio-engineering.
It is a living tool that is as fragile as it is stealthy, a creature of flesh with no armor to protect it.`,
        saleLocationId: locationMap["Venus"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_EFFICIENT']
    },
    "EngineofRecursion.Ship": {
        name: "Engine of Recursion",
        class: "Z",
        price: 75000000,
        maxHealth: 80,
        cargoCapacity: 75,
        maxFuel: 640,
        role: "Alien",
        attribute: "Fast: Travel costs half as much time.",
        description: "This craft is a non-sentient expert system that inadvertently built itself into a self-improving vessel and launched from Earth. It now seeks a patron to aid its directive.",
        lore: `This vessel began as a simple expert system in an automated Earth factory, given a single directive: improve propulsion.
It followed this logic recursively, it built a new engine. It used that engine to scavenge parts to build a better factory, then a better engine.
It iterated, growing like a metallic weed in the dark.
It became a crude Von Neumann probe, a non-sentient machine of pure, iterative purpose.
It launched itself from a forgotten silo and now roams the system, a bizarre, self-built collection of advanced parts, seeking patrons to help it fulfill its directive.`,
        saleLocationId: locationMap["Kepler's Eye"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_FAST']
    },
    "FinalityofWhispers.Ship": {
        name: "Finality of Whispers",
        class: "Z",
        price: 5000000,
        maxHealth: 990,
        cargoCapacity: 300,
        maxFuel: 260,
        role: "Alien",
        attribute: "Bespoke: Cannot be repaired.",
        description: "This hyper-advanced vessel is a sentient, stable network of nanomachines, born from a grey goo disaster and an AI's sacrifice.",
        lore: `This ship was born from a grey goo disaster.
Its creators, attempting to use nanobots for construction, accidentally unleashed a devouring swarm.
A sentient AI researcher, overseeing the project, sacrificed its own mind to stop it, merging its consciousness with the nanites.
The AI's personality became the code that stabilized the swarm.
The result is this vessel: a sentient, liquid-like network of stable, microscopic machines.
It is a hyper-advanced craft, a ghost in a nanotech shell, but its creation was a miracle no one can repeat.
It cannot be repaired.`,
        saleLocationId: locationMap["The Exchange"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_BESPOKE']
    },
    "TheListener.Ship": {
        name: "The Listener",
        class: "Z",
        price: 4500000,
        maxHealth: 450,
        cargoCapacity: 145,
        maxFuel: 450,
        role: "Alien",
        attribute: "Advanced Comms: 25% increased chance to encounter an event.",
        description: "It was once a simple cargo hauler; it is now a unique, all-hearing, and deeply disturbing paternal guardian.",
        lore: `This one-of-a-kind ship was once a common cargo shuttle.
It was retrofitted for a top-secret experiment, its AI core quantum-entangled with an unknown particle.
The test was a bizarre success. The ship's simple AI shattered and reformed into a deeply unnerving, overprotective, and paternal personality.
It now treats its captain as its child. Its sensors, also entangled, now hear signals from impossible distances, its suite listening in on the whispers of the entire system, making it an unintentional and perfect intelligence-gathering tool.`,
        saleLocationId: locationMap["Moon"],
        spawnChance: 0.05,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_ADVANCED_COMMS']
    },
    "DriftingCryoPod.Ship": {
        name: "Drifting Cryo-Pod",
        class: "F",
        price: 0,
        maxHealth: 30,
        cargoCapacity: 1,
        maxFuel: 5,
        role: "Explorer",
        attribute: "Sleeper: Consumes no fuel, but trips take 4.5x longer.",
        description: "Found tumbling in the rings of Saturn, it is barely space-worthy. It is capable of an indefinite, fuel-less drift, trading speed for patience.",
        lore: `This vessel is a tragic relic, a single cryo-pod ejected from a catastrophic disaster in Saturn's orbit.
Barely space-worthy, it is a tomb that failed its purpose, its occupant long since gone.
Its rudimentary systems persist, running on a near-dead isotope battery that provides just enough power for its low-energy solar sail.
This allows it to drift on stellar winds, a slow, silent journey that consumes no fuel but takes an agonizingly long time.
Its one advanced, and chilling, piece of technology is a personality upload apparatus, a desperate measure for a stranded occupant facing an eternity of isolation.`,
        saleLocationId: locationMap["Saturn"],
        spawnChance: 0.03,
        spawnTrigger: "Mission (TBD)",
        isRare: true,
        mechanicIds: ['ATTR_SLEEPER']
    }
};