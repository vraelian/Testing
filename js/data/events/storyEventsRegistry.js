// js/data/events/storyEventsRegistry.js
/**
 * @fileoverview
 * Registry for deterministic, narrative-driven Story Events.
 * These events bypass the probabilistic random event pool and are 
 * manually queued via game state triggers.
 */

import { EVENT_CONSTANTS, COMMODITY_IDS, PERK_IDS } from '../constants.js';

export const STORY_EVENTS = {
    // Example Payload
    'evt_story_example': {
        id: 'evt_story_example',
        theme: 'license-t2',
        portraitId: 'Kintsugi_3',
        repeatable: false,
        title: 'Incoming Transmission',
        text: 'TEST TEST TEST',
        confirmText: 'Log Transmission',
        choices: [] 
    },
    'evt_story_1': {
        id: 'evt_story_1',
        theme: 'anomaly',
        portraitId: 'Kintsugi_3',
        repeatable: false,
        title: 'Anomalous Telemetry Intercept',
        text: `<span style="font-family: 'Orbitron', sans-serif;">
TRANSMISSION RECIEVED: // ERR_CODE: 0x0GLDJNRY_UNRECOGNIZED_HANDSHAKE<br><br>
[query.origin == null]<br><br>
> 01100001_01101000... <br>
> { ! ? * — } <br>
> %%%///&&&---*** <br>
> 0... 0... 0... <br>
> //.._ ..//_ <br>
> { . . . }<br><br>
</span>`,
        confirmText: 'Archive Message',
        choices: [] 
    },
    'evt_kiern_intercept': {
        id: 'evt_kiern_intercept',
        theme: 'host-syndicate',
        portraitId: 'Venusian_Syndicate_4',
        repeatable: false,
        title: 'Syndicate Intercept',
        text: "Captain. I see the Guild has you chasing ghosts on your own dime. The Syndicate is highly interested in whatever that Uranus scrap was aiming at. Do not give the telemetry to the Guild. Transmit it to me instead, and I will personally reimburse your recent bribe with 50% interest, plus a new level of Syndicate clearance. It's your choice, Captain. Order, or opportunity.",
        confirmText: 'Close Channel',
        choices: [] 
    }
};