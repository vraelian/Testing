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
        text: "Hello, Captain. The Syndicate's market analysts noted a sudden, massive capital injection at Uranus, followed by the Guild scrambling local recon assets.<b><b>This is related to the anomalous AI event at Uranus, isn't it? Did you find out where that scrap was being thrown to? I'm assuming the guild needs you to look into it or else they'd do it themselves.<br><br>Whatever is sitting out by Mercury is clearly valuable. If you relay to the Syndicate what you find I will personally reimburse your recent credit expense... with interest.",
        confirmText: 'Close Channel',
        choices: [] 
    },
    'evt_encounter_recursion': {
        id: 'evt_encounter_recursion',
        theme: 'anomaly',
        hostImage: 'Engine_of_Recursion_C.webp',
        repeatable: false,
        title: 'Unidentified Z Class Vessel',
        text: 'Telemetry displays localized gravitational shear. Visual sensors resolve a vessel of staggering proportions eclipsing the background starfield. The Engine of Recursion drifts in complete silence, its hull bearing the scars of forgotten cosmic epochs.',
        choices: [
            { id: 'dismiss', text: 'Log Telemetry Data' }
        ]
    }
};