// js/data/tutorials.js
/**
 * @fileoverview Tutorial Registry (Facade)
 * Aggregates all tutorial modules into the single TUTORIAL_DATA export.
 * New tutorial modules should be imported and spread here.
 */
import { TUTS_INTRO } from './tutorials/tuts_intro.js';

export const TUTORIAL_DATA = {
    ...TUTS_INTRO
    // Future modules (e.g., TUTS_COMBAT, TUTS_ECONOMY) will be added here.
};