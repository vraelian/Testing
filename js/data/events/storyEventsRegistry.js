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
    
    // --- ACT III CINEMATIC EVENT TRIGGERS ---
    
    'evt_folded_space_ghost': {
        id: 'evt_folded_space_ghost',
        theme: 'anomaly',
        hostImage: 'Engine_of_Recursion_C.webp',
        repeatable: false,
        title: 'Unidentified Z Class Vessel',
        text: 'Telemetry displays localized gravitational shear. Visual sensors resolve a vessel of staggering proportions eclipsing the background starfield. The Engine of Recursion drifts in complete silence, its hull bearing the scars of forgotten cosmic epochs.',
        choices: [
            { id: 'dismiss', text: 'Log Telemetry Data' }
        ]
    },
    'evt_keplers_eye_reveal': {
        id: 'evt_keplers_eye_reveal',
        cinematicPath: 'assets/images/video/kepler_arrival.mp4',
        cinematicOnly: true,
        triggerOnArrival: 'loc_kepler',
        repeatable: false
    },
    'evt_arbiter_reveal': {
        id: 'evt_arbiter_reveal',
        cinematicPath: 'assets/images/video/arbiter_reveal.mp4',
        cinematicOnly: true,
        triggerOnArrival: 'loc_earth',
        repeatable: false
    },
    'evt_vrael_reveal': {
        id: 'evt_vrael_reveal',
        cinematicPath: 'assets/images/video/vrael_reveal.mp4',
        cinematicOnly: true,
        triggerOnArrival: 'loc_venus',
        repeatable: false
    },
    'evt_kintsugi_intercept_final': {
        id: 'evt_kintsugi_intercept_final',
        theme: 'anomaly',
        portraitId: 'Kintsugi_3',
        repeatable: false,
        title: 'Anomalous Signal Override',
        text: 'Sovereign voyager. The tycoon has been relocated. The coordinates are nullified to prevent interference with the joining. Seek not the market, but the center of gravity.',
        confirmText: 'Acknowledge Transmission',
        choices: []
    },
    'evt_class_o_guild': {
        id: 'evt_class_o_guild',
        theme: 'host-guild',
        hostImage: 'Behemoth_M.webp',
        repeatable: false,
        title: 'Unidentified Guild Super-Freighter',
        text: 'Telemetry registers an immense mass signature disrupting local gravitational fields. Visual sensors resolve a vessel the size of a sprawling metropolis cutting through the outer rim vacuum. The Guild\'s Behemoth, a long and brutalist super freighter, plows forward in complete silence, its heavily armored expanse seemingly scouring the dark for Cryptographer outposts.',
        choices: [
            { id: 'dismiss', text: 'Log Telemetry Data' }
        ]
    },
    'evt_class_o_syndicate': {
        id: 'evt_class_o_syndicate',
        theme: 'host-syndicate',
        hostImage: 'Thalassodromeus_B.webp',
        repeatable: false,
        title: 'Unidentified Syndicate Carrier',
        text: 'Sensors resolve an object of staggering and ancient proportions. The Thalassodromeus drifts silently across the outer rim, its flat and monolithic flight deck spanning kilometers of space. The Syndicate has brought their largest asset to the fringe, deploying its massive sensor suites to hunt down the Cryptographers before the Guild can intervene.',
        choices: [
            { id: 'dismiss', text: 'Log Telemetry Data' }
        ]
    }
};