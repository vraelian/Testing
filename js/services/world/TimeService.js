// js/services/world/TimeService.js
import { DB } from '../../data/database.js';
import { GAME_RULES, WEALTH_MILESTONES, ATTRIBUTE_TYPES } from '../../data/constants.js';
import { formatCredits } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js';

// --- ERA 2: TRANSHUMANIST EVENT DATA (Age 100-195) ---
const CYBORG_EVENTS = {
    100: { title: "Ocular Replacement", bonus: "commoditySupply", val: 0.02, desc: "The failing retinas are gone, replaced by Kiroshi-grade optical sensors. You don't just see crates anymore; you see wireframes, volume density, and spoilage rates overlaying reality in real-time. The world is brighter, sharper, and filled with data that organic eyes could never process. You can spot a supply surplus from orbit." },
    105: { title: "Vocal Synthesizer", bonus: "shipPrice", val: 0.01, desc: "Your vocal cords had weathered from decades of shouting over thrusters, so you swapped them for a harmonic synthesizer. It analyzes the buyer's micro-expressions and adjusts your pitch to the exact frequency of 'trust' and 'compliance.' Negotiations feel less like arguments and more like conducting an orchestra. They never hear the manipulation, only the deal." },
    110: { title: "Neural Spine Shunt", bonus: "travelSpeed", val: 0.01, desc: "The arthritis in your hands made the helm sluggish, so you excised the nerves and installed a direct neural-shunt in your spine. Now, you don't steer the ship with your hands; you *become* the ship, feeling the thruster burn as your own muscle tension. Reaction times are measured in microseconds. You move through the void as a single, steel entity." },
    115: { title: "Subspace Cranial Receiver", bonus: "shipSpawnRate", val: 0.02, desc: "Your hearing was the next to go, replaced by broad-spectrum subspace receivers anchored in your skull. You can hear the 'thrum' of fusion drives entering the system hours before traffic control pings them. The static of the universe is now a symphony of arrival vectors. You know they are coming before they even drop out of warp." },
    120: { title: "Haptic Diagnostic Tips", bonus: "upgradeSpawnRate", val: 0.02, desc: "You replaced your fingertips with haptic diagnostic probes, capable of sensing microscopic etchings in circuit boards. When you touch a piece of tech, you feel its efficiency rating and heat tolerance instantly, bypassing the need for spec sheets. The junk falls away, leaving only the rare gems humming against your skin. Finding the best gear is no longer luck; it’s a sense of touch." },
    125: { title: "Mnemo-Core Implant", bonus: "intelDuration", val: 0.02, desc: "The organic brain forgets, but your new temporal-lobe memory bank does not. Every rumor, every price sheet, and every whisper in the bar is etched onto a crystalline drive with perfect clarity. You can recall a conversation from three weeks ago with the fidelity of a recording. Information no longer decays; it accumulates." },
    130: { title: "Olfactory Chem-Analyzers", bonus: "commoditySupply", val: 0.02, desc: "Your respiratory system was inefficient, requiring oxygen tanks in the hold; the new filtration lungs scrub the air of toxins and analyze atmospheric particulate. You can smell the ozone of a fresh shipment of electronics or the metallic tang of refined ore from three docks away. The air itself tells you what the station is hiding. Nothing stays hidden from a nose that smells profit." },
    135: { title: "Polymer-Mesh Facial Weave", bonus: "shipPrice", val: 0.01, desc: "You swapped your facial muscles for a polymer-mesh weave that allows for total micro-expression control. When you haggle, your face is a perfect mask of disinterest, giving away nothing while your sensors read their desperation. They drop their prices just to get a reaction out of you. It is the ultimate poker face, sculpted from synthetic flesh." },
    140: { title: "Mag-Lev Circulatory Pump", bonus: "travelSpeed", val: 0.01, desc: "The frailty of the human heart limited your G-force tolerance, so you replaced it with a mag-lev pump. It circulates synthetic hemoglobin that carries double the oxygen, allowing you to pull burns that would blackout a normal pilot. You push the engines past the red line because your body no longer has a red line. The void shrinks beneath your unyielding endurance." },
    145: { title: "Circadian Regulator Chip", bonus: "shipSpawnRate", val: 0.02, desc: "You replaced your biological sleep center with a circadian regulator chip. You no longer feel fatigue. While others sleep, you are watching the docking manifests, waiting for that unique signature. You are the ghost that haunts the market, always awake, always watching." },
    150: { title: "Spectral Eye Analyzer", bonus: "upgradeSpawnRate", val: 0.02, desc: "Your right eye has been replaced with a spectral analyzer that sees radiation leaks and energy signatures. You can look at a pile of scrap and see the glowing aura of a military-grade capacitor hidden within. The mundane world is grey, but power shines like a beacon to your upgraded vision. You pick the diamonds from the dust." },
    155: { title: "Sub-Cortex Coprocessor", bonus: "intelDuration", val: 0.02, desc: "You installed a secondary co-processor at the base of your skull to handle background data crunching. While you negotiate, this sub-mind analyzes market trends and cross-references rumors, validating intel in real-time. It holds onto data streams long after the source has disconnected, keeping the signal alive. You are a walking server farm." },
    160: { title: "Nutrient-Brick Reactor", bonus: "commoditySupply", val: 0.02, desc: "The digestive system was a waste of space/energy, replaced by a dense nutrient-brick reactor. You no longer feel hunger, only a 'fuel low' warning, freeing your mind to obsess over logistical volume. You calculate cargo space with the precision of a machine that essentially is cargo itself. You understand 'capacity' on a spiritual level." },
    165: { title: "Pheromone Emitter Glands", bonus: "shipPrice", val: 0.01, desc: "You’ve replaced your pheromone glands with synthetic emitters that subtly flood the room with 'calm' and 'familiarity' agents. Sellers feel an inexplicable kinship with you, a chemical compulsion to give you the 'friend price.' It’s not mind control, but it’s frighteningly close. You simply smell like their best deal." },
    170: { title: "Carbon-Nanotube Skeleton", bonus: "travelSpeed", val: 0.01, desc: "Your bone marrow has been swapped for a carbon-nanotube lattice, making your skeleton virtually unbreakable. You can slam the ship into maneuvers that would shatter a human frame, ignoring the inertial dampeners for raw speed. You are the structure that holds the ship together. Physics is just a suggestion to a body built of steel." },
    175: { title: "Deep-Void Radar Cortex", bonus: "shipSpawnRate", val: 0.02, desc: "You’ve integrated a deep-range void-radar directly into your visual cortex. You don't look at a screen; you close your eyes and see the system's traffic as floating motes of light in the darkness. You spot the faint glimmer of a rare hull signature drifting in from the belt before the station sensors do. You are the radar." },
    180: { title: "Magnetic Resonance Palms", bonus: "upgradeSpawnRate", val: 0.02, desc: "Your hands are now fully mechanical, fitted with magnetic resonance scanners. You can wave your hand over a crate of parts and feel the magnetic pull of high-end alloys. The cheap plasteel feels dead, but the mil-spec components sing to your servos. You sort the wheat from the chaff without opening the box." },
    185: { title: "Quantum-Entangled Storage", bonus: "intelDuration", val: 0.02, desc: "You’ve undergone a total neocortex rewrite, replacing grey matter with quantum-entangled storage. Your memories are no longer stored locally; they are backed up to a secure cloud, accessible instantly and corrupted by nothing. Time does not erode your knowledge. What you learn stays learned, forever perfect." },
    190: { title: "Solar-Mesh Epidermis", bonus: "commoditySupply", val: 0.02, desc: "Your skin has been replaced by photosensitive solar-mesh. You feel the light of the local star as data, gauging the system's energy output and production cycles through your pores. You are in tune with the station's very power grid, sensing when production spikes. You are the station's pulse." },
    195: { title: "Logic-Gate Processor", bonus: "shipPrice", val: 0.01, desc: "The last vestiges of your empathy centers have been excised for a logic-gate processor. You no longer feel guilt or pity during a negotiation; you calculate optimal outcomes with cold, binary precision. The seller's sob story is just noise; the numbers are the only truth. You are the ultimate dealmaker, for you have no soul to bargain with." }
};

export class TimeService {
    /**
     * @param {import('../GameState.js').GameState} gameState
     * @param {import('../simulation/MarketService.js').MarketService} marketService
     * @param {import('../UIManager.js').UIManager} uiManager
     * @param {import('../../services/LoggingService.js').Logger} logger
     */
    constructor(gameState, marketService, uiManager, logger, newsTickerService) { // Received newsTickerService from SimService
        this.gameState = gameState;
        this.marketService = marketService;
        this.uiManager = uiManager;
        this.logger = logger;
        this.newsTickerService = newsTickerService;
        this.simulationService = null; // Injected by SimulationService
        this.intelService = null;      // Injected by SimulationService
        this.solStationService = null; // Injected by SimulationService
    }

    /**
     * Advances the game world by a specified number of days.
     * detailed mechanics like passive repairs, interest, and random events are handled here.
     * @param {number} days - The number of days to advance.
     */
    advanceDays(days) {
        this.logger.group(`[System] Advancing time by ${days} day(s) from Day ${this.gameState.day}`);
        
        // Update visual seed for procedural rotations
        this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;

        // Pre-fetch active ship data for the loop
        const activeShipId = this.gameState.player.activeShipId;
        const activeShipState = this.gameState.player.shipStates[activeShipId];
        const activeUpgrades = activeShipState ? (activeShipState.upgrades || []) : [];
        const activeShipAttributes = GameAttributes.getShipAttributes(activeShipId);

        for (let i = 0; i < days; i++) {
            if (this.gameState.isGameOver) {
                this.logger.groupEnd();
                return;
            }
            this.gameState.day++;

            // Pulse News Ticker
            if (this.simulationService) {
                this.simulationService.pulseNewsTicker();
            }

            // --- SOL STATION: PROCESS TICK ---
            if (this.solStationService) {
                this.solStationService.processTick();
            }
            // ---------------------------------

            // --- PASSIVE REPAIR (UPGRADES & Z-CLASS) ---
            // Base upgrade modifier
            let passiveRepairRate = GameAttributes.getPassiveRepairRate(activeUpgrades);
            
            // ATTR_SELF_ASSEMBLY (Engine of Recursion): +5% Daily Repair
            if (activeShipAttributes.includes('ATTR_SELF_ASSEMBLY')) {
                passiveRepairRate += 0.05;
            }

            if (passiveRepairRate > 0 && this.simulationService) {
                const effectiveStats = this.simulationService.getEffectiveShipStats(activeShipId);
                if (activeShipState.health < effectiveStats.maxHealth) {
                    const healAmount = effectiveStats.maxHealth * passiveRepairRate;
                    activeShipState.health = Math.min(
                        effectiveStats.maxHealth, 
                        activeShipState.health + healAmount
                    );
                }
            }

            // --- Legacy Attribute Support (Flat Decay) ---
            activeShipAttributes.forEach(attrId => {
                const def = GameAttributes.getDefinition(attrId);
                if (def && def.type === ATTRIBUTE_TYPES.MOD_HULL_DECAY && def.mode === 'flat_daily') {
                    if (activeShipState.health > 1) {
                        activeShipState.health = Math.max(1, activeShipState.health - def.value);
                    }
                }
            });

            // Age & Birthday Check (Replaces legacy hardcoded logic)
            const dayOfYear = (this.gameState.day - 1) % 365;
            const currentYear = DB.DATE_CONFIG.START_YEAR + Math.floor((this.gameState.day - 1) / 365);
            
            // Cryo-Stasis: Check if age should advance
            const canAge = !activeShipAttributes.includes('ATTR_CRYO_STASIS');

            if (canAge && dayOfYear === 11 && currentYear > this.gameState.player.lastBirthdayYear) {
                this.gameState.player.lastBirthdayYear = currentYear;
                this.gameState.player.playerAge++;
                this._handleBirthday(this.gameState.player.playerAge);
            }

            this._checkAgeEvents();
            this.marketService.evolveMarketPrices();

            // Weekly Market Updates
            if ((this.gameState.day - this.gameState.lastMarketUpdateDay) >= 7) {
                this.marketService.checkForSystemStateChange();
                this.marketService.replenishMarketInventory();
                this.marketService._updateShipyardStock(); 
                this.gameState.lastMarketUpdateDay = this.gameState.day;
            }

            // Intel Expiration
            const activeDeal = this.gameState.activeIntelDeal; 
            if (activeDeal && this.gameState.day > activeDeal.expiryDay) {
                const expiredDeal = activeDeal;
                this.gameState.activeIntelDeal = null;
                // Remove the expired packet from the source market to prevent re-buying immediately
                if (expiredDeal.sourceSaleLocationId && expiredDeal.sourcePacketId) {
                    const saleLocationMarket = this.gameState.intelMarket[expiredDeal.sourceSaleLocationId];
                    if (saleLocationMarket) {
                        this.gameState.intelMarket[expiredDeal.sourceSaleLocationId] = saleLocationMarket.filter(
                            packet => packet.id !== expiredDeal.sourcePacketId
                        );
                    }
                }
                this.simulationService.pushNewsMessage(`Intel on ${DB.COMMODITIES.find(c => c.id === expiredDeal.commodityId).name} at ${DB.MARKETS.find(m => m.id === expiredDeal.targetMarketId).name} has expired.`, 'INTEL');
            }

            // Periodic Intel Generation
            if (this.intelService) {
                const totalIntel = Object.values(this.gameState.intelMarket).flat().length;
                if ((this.gameState.day % 120 === 1) || (this.gameState.day < 120 && totalIntel === 0)) {
                    this.intelService.generateIntelRefresh();
                }
            }
            
            // Passive Repair for INACTIVE ships (Hangar)
            this.gameState.player.ownedShipIds.forEach(shipId => {
                if (shipId !== this.gameState.player.activeShipId) {
                    const ship = DB.SHIPS[shipId]; 
                    const repairAmount = ship.maxHealth * GAME_RULES.PASSIVE_REPAIR_RATE;
                    this.gameState.player.shipStates[shipId].health = Math.min(ship.maxHealth, this.gameState.player.shipStates[shipId].health + repairAmount);
                }
            });

            // --- UPGRADE SYSTEM: Debt Interest (Syndicate Badge) ---
            if (this.gameState.player.debt > 0 && (this.gameState.day - this.gameState.lastInterestChargeDay) >= GAME_RULES.INTEREST_INTERVAL) {
                const rawInterest = this.gameState.player.monthlyInterestAmount;
                
                // Apply Multiplicative Modifier (e.g. 0.80 for 20% off)
                const interestMod = GameAttributes.getInterestModifier(activeUpgrades);
                const finalInterest = Math.floor(rawInterest * interestMod);

                this.gameState.player.debt += finalInterest;
                
                // Log the transaction
                if (this.simulationService) {
                    this.simulationService._logTransaction('loan', finalInterest, 'Monthly interest charge');
                }
                
                this.logger.info.system('Finance', this.gameState.day, 'INTEREST', `Charged ${formatCredits(finalInterest)} interest on debt (Base: ${rawInterest}, Mod: ${interestMod}).`);
                this.gameState.lastInterestChargeDay = this.gameState.day;
            }
            // --- END UPGRADE SYSTEM ---

            this._applyGarnishment();
        }
        
        this.logger.groupEnd();
        this.gameState.setState({});
    }

    /**
     * Handles the new 3-Era Birthday System logic.
     * @param {number} age - The player's new age.
     * @private
     */
    _handleBirthday(age) {
        const stats = this.gameState.player.statModifiers;
        let title = `Happy Birthday!`;
        let desc = `You turned ${age}.`;
        let bonusText = "";

        // --- ERA 1: THE PRIME YEARS (25 - 99) ---
        // Cycle: Profit -> Intel -> Purchase -> IntelDur -> Fuel -> Intel -> Repair
        if (age < 100) {
            const cycleIndex = (age - 25) % 7;
            
            switch (cycleIndex) {
                case 0: // Profit (+0.10%)
                    stats.profitBonus += 0.001;
                    bonusText = "Your experience grants you a permanent +0.10% profit bonus on all trades.";
                    break;
                case 1: // Intel Cost (-2%)
                    stats.intelCost += 0.02;
                    bonusText = "Your network grants you a permanent 2% discount on Intel Packets.";
                    break;
                case 2: // Purchase Cost (-0.10%)
                    stats.purchaseCost += 0.001;
                    bonusText = "Your reputation grants you a permanent 0.10% discount on commodity purchases.";
                    break;
                case 3: // Intel Duration (+2%)
                    stats.intelDuration += 0.02;
                    bonusText = "Your memory techniques allow Intel to last 2% longer.";
                    break;
                case 4: // Fuel Cost (-0.25%)
                    stats.fuelCost += 0.0025;
                    bonusText = "Refueling efficiency improved. Permanent 0.25% discount on fuel.";
                    break;
                case 5: // Intel Cost (-2%) - Repeated Slot
                    stats.intelCost += 0.02;
                    bonusText = "Your network grants you an additional 2% discount on Intel Packets.";
                    break;
                case 6: // Repair Cost (-0.25%)
                    stats.repairCost += 0.0025;
                    bonusText = "Maintenance efficiency improved. Permanent 0.25% discount on hull repairs.";
                    break;
            }
            
            // Era 1 uses the standard modal format
            this.uiManager.queueModal('event-modal', title, `${desc} ${bonusText}`);
        }

        // --- ERA 2: THE TRANSHUMANIST ERA (100 - 199) ---
        // Triggers every 5 years with unique narrative events
        else if (age >= 100 && age < 200) {
            if (age % 5 === 0 && CYBORG_EVENTS[age]) {
                const event = CYBORG_EVENTS[age];
                
                // Apply Bonus
                stats[event.bonus] += event.val;

                // Format Bonus Text for Display (e.g., "0.02" -> "2%")
                const valPct = (event.val * 100).toFixed(0) + "%";
                let bonusDisplay = "";
                
                if (event.bonus === 'commoditySupply') bonusDisplay = `Increased commodity supply available at all markets by ${valPct}.`;
                else if (event.bonus === 'shipPrice') bonusDisplay = `Reduced ship purchase prices by ${valPct}.`;
                else if (event.bonus === 'travelSpeed') bonusDisplay = `Increased travel speed by ${valPct}.`;
                else if (event.bonus === 'shipSpawnRate') bonusDisplay = `Increased rare ship spawn rate by ${valPct}.`;
                else if (event.bonus === 'upgradeSpawnRate') bonusDisplay = `Increased ship upgrade spawn rate by ${valPct}.`;
                else if (event.bonus === 'intelDuration') bonusDisplay = `Intel lasts ${valPct} longer.`;

                // Era 2 uses specific narrative text
                title = `Augmentation Installed: ${event.title}`;
                // --- CHANGED: Now prepends "You are now [Age]." per user request ---
                this.uiManager.queueModal('event-modal', title, `You are now ${age}. ${event.desc}\n\n<span class='text-green-400'>EFFECT: ${bonusDisplay}</span>`);
            }
        }

        // --- ERA 3: THE ANCIENT ERA (200+) ---
        // Alternating Vouchers every 5 years (Instant Fill Implementation)
        else if (age >= 200) {
            if (age % 5 === 0) {
                const activeShipId = this.gameState.player.activeShipId;
                const activeShipState = this.gameState.player.shipStates[activeShipId];
                // Access Effective Stats for accurate max values
                const effectiveStats = this.simulationService ? this.simulationService.getEffectiveShipStats(activeShipId) : DB.SHIPS[activeShipId]; 

                const isFuel = (age % 10 === 0); // 200, 210, 220...
                
                if (isFuel) {
                    // Instant Fuel Fill
                    activeShipState.fuel = effectiveStats.maxFuel;
                    title = "Guild Tribute: Fuel Grant";
                    desc = `In honor of your ${age}th year, the Merchant's Guild has issued a writ of passage. Your ship's fuel reserves have been instantly restored to maximum capacity.`;
                    bonusText = "Fuel reserves fully restored.";
                } else { // 205, 215, 225...
                    // Instant Hull Repair
                    activeShipState.health = effectiveStats.maxHealth;
                    title = "Guild Tribute: Drydock Grant";
                    desc = `In honor of your ${age}th year, the Shipwright's Union has issued a total restoration grant. Your ship's hull has been instantly repaired to maximum integrity.`;
                    bonusText = "Hull integrity fully restored.";
                }

                this.uiManager.queueModal('event-modal', title, `${desc}\n\n<span class='text-yellow-400'>${bonusText}</span>`);
            }
        }
    }

    _checkAgeEvents() {
        DB.AGE_EVENTS.forEach(event => {
            if (this.gameState.player.seenEvents.includes(event.id)) return;

            // Trigger conditions
            if ((event.trigger.day && this.gameState.day >= event.trigger.day) || 
                (event.trigger.credits && this.gameState.player.credits >= event.trigger.credits)) {
                
                this.gameState.player.seenEvents.push(event.id);
                this.uiManager.showAgeEventModal(event, (choice) => {
                    if (this.simulationService) {
                        this.simulationService._applyPerk(choice);
                    }
                });
            }
        });
    }

    _checkMilestones() {
        const { credits, revealedTier } = this.gameState.player;
        let currentTier = revealedTier;
        
        // Find the next milestone
        let nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);
        
        // Check if we passed it (and potentially subsequent ones)
        while (nextMilestone && credits >= nextMilestone.threshold) {
            this.gameState.player.revealedTier = nextMilestone.revealsTier;
            
            // Notify
            this.logger.info.player(this.gameState.day, 'MILESTONE', `Wealth milestone reached! Tier ${nextMilestone.revealsTier} commodities unlocked.`);
            this.uiManager.queueModal('event-modal', 'Market Update', `Your increasing wealth has granted you access to Tier ${nextMilestone.revealsTier} commodities.`);
            
            currentTier = nextMilestone.revealsTier;
            nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === currentTier + 1);
        }
        
        if (this.gameState.player.revealedTier !== revealedTier) {
            this.gameState.setState({});
        }
    }

    _applyGarnishment() {
        const { player, day } = this.gameState;
        if (player.debt > 0 && player.loanStartDate && (day - player.loanStartDate) >= GAME_RULES.LOAN_GARNISHMENT_DAYS) {
            // Apply garnishment on the same cycle as interest
            if ((day - this.gameState.lastInterestChargeDay) % GAME_RULES.INTEREST_INTERVAL !== 0) return;

            const garnishedAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
            if (garnishedAmount > 0) {
                player.credits -= garnishedAmount;
                if (this.simulationService) {
                    this.simulationService._logTransaction('debt', -garnishedAmount, 'Monthly credit garnishment');
                    this.simulationService._checkGameOverConditions(); 
                }
            }

            if (!player.seenGarnishmentWarning) {
                const msg = "Your loan is delinquent. Your lender is now garnishing 14% of your credits monthly until the debt is paid.";
                this.uiManager.queueModal('event-modal', "Credit Garnishment Notice", msg, null, { buttonClass: 'bg-red-800/80' });
                player.seenGarnishmentWarning = true;
            }
        }
    }
    
    getCurrentDay() {
        return this.gameState.day;
    }
}