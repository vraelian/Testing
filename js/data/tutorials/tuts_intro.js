// js/data/tutorials/tuts_intro.js
/**
 * @fileoverview Tutorial Module: Introduction
 * Contains the specific steps and triggers for the "Onboarding" sequence.
 */
import { TUTORIAL_ACTION_TYPES, ACTION_IDS, NAV_IDS } from '../constants.js';

export const TUTS_INTRO = {
    'intro_hangar': {
        title: 'Your First Ship',
        trigger: { type: TUTORIAL_ACTION_TYPES.ACTION, action: 'INTRO_START_HANGAR' },
        navLock: true,
        steps: [
            {
                stepId: 'hangar_1',
                text: "Welcome to the <b>Shipyard</b> on <b>Mars!</b><br><br>Every station has a port from which you can trade ships and manage your <b>Hangar</b>.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 16,
                completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                nextStepId: 'hangar_2',
                isSkippable: true
            },
            {
                stepId: 'hangar_2',
                text: "Now that you've borrowed <b class='hl-yellow font-bold'>extra credits</b>, you can buy your first ship!<br><br>Select one of the options in the <b>Shipyard</b>. Choose carefully...",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 17,
                completion: { type: TUTORIAL_ACTION_TYPES.ACTION, action: ACTION_IDS.BUY_SHIP },
                nextStepId: 'hangar_3',
                isSkippable: true,
                unlockPurchase: true
            },
            {
                stepId: 'hangar_3',
                text: 'This is your <b>Hangar</b>. From here you can manage all the ships you own. Select your new ship and <b class="hl-yellow font-bold">Board</b> it to make it your active vessel.',
                size: { width: '400px', height: '110px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 12,
                completion: { type: TUTORIAL_ACTION_TYPES.ACTION, action: ACTION_IDS.SELECT_SHIP },
                nextStepId: null,
                isSkippable: false
            }
        ]
    },
    'intro_finance': {
        title: 'Managing Your Debt',
        trigger: { type: TUTORIAL_ACTION_TYPES.ACTION, action: 'INTRO_START_FINANCE' },
        navLock: true,
        steps: [
            {
                stepId: 'finance_1',
                text: "That was a big purchase, but don't worry - you've still got some <b class='hl-yellow font-bold'>credits</b> left over!<br><br>Your transaction history and debts can be viewed on the <b>Finance</b> tab within <b>Data</b>.",
                size: { width: '400px', height: '120px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 16,
                completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                nextStepId: 'finance_2',
                isSkippable: false
            },
            {
                stepId: 'finance_2',
                text: "Dont forget, your debt to the <b class='hl-yellow font-bold'>Merchant's Guild</b> is due in <b class='hl-red font-bold'>3 years</b>.<br><br>You will need to earn <b class='hl-yellow font-bold'>credits</b> to <b>pay off your debt</b>!",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 16,
                completion: { type: TUTORIAL_ACTION_TYPES.INFO },
                nextStepId: null,
                isSkippable: false
            }
        ]
    },
    'intro_missions': {
        id: "intro_missions",
        title: "First Steps",
        trigger: { "type": "ACTION", "action": "INTRO_START_MISSIONS" },
        navLock: true,
        steps: [
            {
                "stepId": "mission_1_1",
                "text": "This is the <b>Mission Terminal</b>.<br><br>Check the <b>Missions</b> tab often for opportunities to earn <b class='hl-yellow font-bold'>credits</b> and improve your reputation.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 84,
                "completion": { "type": "INFO" },
                "nextStepId": "mission_1_2",
                "isSkippable": false
            },
            {
                "stepId": "mission_1_2",
                "text": "A freelancer at the <b>Mars</b> station has put in a <b>Delivery</b> request. Select the mission '<b>Milk Run to Luna</b>' to view more details.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 84,
                "completion": { "type": "ACTION", "action": "show-mission-modal" },
                "nextStepId": "mission_1_3",
                "isSkippable": false
            },
            {
                "stepId": "mission_1_3",
                "text": "The freelancer can't pay, but he's giving you the <b>remaining cargo</b>. Accept the contract.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 84,
                "completion": { "type": "ACTION", "action": "accept-mission" },
                "nextStepId": "mission_1_4",
                "isSkippable": false
            },
            {
                "stepId": "mission_1_4",
                "text": "Mission accepted!<br><br>The contract is now <b>active</b> and the cargo as been loaded onto your ship, the <b>{shipName}</b>.<br><br>The freelancer has also loaded extra <b>Plasteel</b> which you can sell for <b class='hl-yellow font-bold'>credits</b>.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 77,
                "completion": { "type": "INFO" },
                "nextStepId": "mission_1_5",
                "isSkippable": false
            },
            {
                "stepId": "mission_1_5",
                "text": "This mission must be completed on the <b>Moon</b>, but you are presently docked at <b>Mars</b>! Therefore, it's time for the maiden voyage of your new ship, the <b>{shipName}</b>!<br><br>On the <b>nav bar</b> at the top, select the <b>Ship</b> tab, then the <b>Navigation</b> tab.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 27,
                "completion": { "type": "SCREEN_LOAD", "screenId": "navigation" },
                "nextStepId": "mission_1_6",
                "isSkippable": false,
                "navLock": { "navId": NAV_IDS.SHIP, "screenId": "navigation" }
            },
            {
                "stepId": "mission_1_6",
                "text": "From here you can travel to other stations in the system. This will cost you <b>time</b>, <b class='hl-blue'>fuel</b>, and wear on the <b class='hl-green'>hull</b> of your ship.<br><br>Select the <b>Moon</b> to lift off from <b>Mars</b>.",
                size: { width: '400px', height: '170px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 83,
                "completion": { "type": "ACTION", "action": "travel" },
                "nextStepId": "mission_1_7",
                "isSkippable": false,
                "navLock": { "navId": NAV_IDS.SHIP, "screenId": "navigation", "enabledElementQuery": "[data-location-id='loc_luna']" }
            },
            {
                "stepId": "mission_1_7",
                "text": "You've arrived and docked at the <b>Moon</b> station!<br><br>It's time to deliver the <b>Plasteel</b>. Select the active mission and <b>deliver the Plasteel</b>.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 82,
                "completion": { "type": "ACTION", "action": "complete-mission" },
                "nextStepId": "mission_1_8",
                "isSkippable": false,
                "navLock": { "navId": NAV_IDS.DATA, "screenId": "missions" }
            },
            {
                "stepId": "mission_1_8",
                "text": "Mission complete!<br><br>However, favors don't pay off <b class='hl-yellow font-bold'>Guild</b> loans. You're going to need more <b class='hl-yellow font-bold'>credits</b>.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 25,
                "completion": { "type": "INFO" },
                "nextStepId": "mission_2_1",
                "isSkippable": false
            },
            {
                "stepId": "mission_2_1",
                "text": "The <i>best way to make money</i> is to play the markets yourself by <b class='hl-green font-bold'>buying low and selling high</b>.<br><br>Select the <b>Starport</b> tab, then the <b>Market</b> tab.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 25,
                "completion": { "type": "SCREEN_LOAD", "screenId": "market" },
                "nextStepId": "mission_2_2",
                "isSkippable": false,
                "navLock": { "navId": NAV_IDS.STARPORT, "screenId": "market" }
            },
            {
                "stepId": "mission_2_2",
                "text": "This is the <b>Moon Market</b>.<br>On each commodity you will find a wealth of information to aid your trading.<br><br>The <b class='hl-green font-bold'>MKT</b> indicator will inform you of <b class='hl-green font-bold'>prices higher or lower than average.</b> Selecting the price will reveal past performance.<br><br>Select the <b class='hl-yellow font-bold'>Buy/Sell toggle</b> to transition to sale mode, and then sell your single unit of <b>Plasteel</b>.",
                size: { width: '400px', height: '150px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 67,
                "completion": { "type": "ACTION", "action": "sell-item", "goodId": "plasteel" },
                "nextStepId": "mission_2_3",
                "isSkippable": false
            },
            {
                "stepId": "mission_2_3",
                "text": "<b class='hl-green font-bold'>Pure profit</b>!<br><br>However, you still need more <b class='hl-yellow font-bold'>credits</b>! Return to the <b>Mission Terminal</b> by selecting the <b>Data</b> tab.",
                size: { width: '400px', height: '150px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 67,
                "completion": { "type": "SCREEN_LOAD", "screenId": "missions" },
                "nextStepId": "mission_2_4",
                "isSkippable": false,
                "navLock": { "navId": NAV_IDS.DATA, "screenId": "missions" }
            },
            {
                "stepId": "mission_2_4",
                "text": "This mission offers a <b class='hl-yellow font-bold'>credit</b> reward.<br><br>Accept the mission, <b>Martian Resupply</b>.",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 77,
                "completion": { "type": "ACTION", "action": "accept-mission", "missionId": "mission_tutorial_02" },
                "nextStepId": "mission_3_1",
                "isSkippable": false
            },
            {
                "stepId": "mission_3_1",
                "text": "To complete this mission you will need to <b>travel to Mars</b> after you have purchased <b>two Plasteel</b> from any <b>Market</b>.<br><br>After you have acquired the <b>Plasteel</b>, visit the <b>Mission</b> tab on <b>Mars</b> to submit the cargo and complete the mission. ",
                size: { width: '400px', height: '160px' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 83,
                "completion": { "type": "ACTION", "action": "complete-mission", "missionId": "mission_tutorial_02" },
                "nextStepId": "mission_final",
                "isSkippable": false,
                "navLock": null
            },
            {
                "stepId": "mission_final",
                "text": "Well done Captain {playerName}, you have successfully completed trades across the <b>Moon</b> and <b>Mars</b>.<br><br>Continue to trade commodities for <b class='hl-green font-bold'>favorable margins</b> and complete missions to unlock additional opportunities.<br><br><b>The Solar System awaits</b>!",
                size: { width: '400px', height: 'auto' },
                anchorElement: 'body',
                positionX: 50,
                positionY: 29,
                "completion": { "type": "INFO" },
                "nextStepId": null,
                "isSkippable": false,
                "buttonText": "Complete Tutorial",
                "navLock": null
            }
        ]
    }
};