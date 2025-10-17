// js/ui/components/MapScreen.js
/**
 * @fileoverview This file contains the rendering logic for the new Map screen.
 * It uses D3.js to render a stylized, interactive map of the solar system.
 */
import { DB } from '../../data/database.js';
import { LOCATION_IDS } from '../../data/constants.js';

/**
 * Renders the container for the Map screen UI.
 * @returns {string} The HTML content for the Map screen container.
 */
export function renderMapScreen() {
    return `<div id="map-container" class="w-full h-full overflow-y-auto"></div>`;
}

/**
 * Initializes and renders the D3 map within the #map-container element.
 * @param {import('../../services/UIManager.js').UIManager} uiManager - The UIManager instance, passed for modal interactivity.
 */
export function initMap(uiManager) {
    const container = d3.select("#map-container");
    if (!container.node() || !container.select("svg").empty()) {
        console.warn("Map container not found or map already initialized.");
        return;
    }
    
    // Check if clientWidth is available, otherwise wait briefly
    let containerWidth = container.node().clientWidth;
    if (containerWidth <= 0) {
        console.warn("Map container width not available yet. Retrying initialization shortly.");
        // If width isn't ready (e.g., due to CSS loading or layout shifts),
        // try again after a short delay. Avoid infinite loops.
        setTimeout(() => initMap(uiManager), 100); 
        return;
    }


    const svg = container.append("svg")
        .attr("id", "map-svg")
        .attr("width", "100%"); 

    const defs = svg.append("defs");
    const radialGradient = defs.append("radialGradient")
        .attr("id", "sun-gradient");
    radialGradient.append("stop").attr("offset", "0%").attr("stop-color", "#fef08a");
    radialGradient.append("stop").attr("offset", "100%").attr("stop-color", "#fde047");

    svg.append("circle")
        .attr("class", "sun")
        .attr("cx", "50%")
        .attr("cy", -195)
        .attr("r", 225)
        .attr("fill", "url(#sun-gradient)");

    const sizeModifiers = {
        [LOCATION_IDS.VENUS]: 1.035,
        [LOCATION_IDS.EARTH]: 1.035,
        [LOCATION_IDS.LUNA]: 0.805,
        [LOCATION_IDS.MARS]: 0.9775,
        [LOCATION_IDS.BELT]: 0.805,
        [LOCATION_IDS.EXCHANGE]: 0.805,
        [LOCATION_IDS.JUPITER]: 1.564,   // 1.84 * 0.85
        [LOCATION_IDS.SATURN]: 1.46625, // 1.725 * 0.85
        [LOCATION_IDS.URANUS]: 1.27075, // 1.495 * 0.85
        [LOCATION_IDS.NEPTUNE]: 1.27075, // 1.495 * 0.85
        [LOCATION_IDS.KEPLER]: 0.8625,
        [LOCATION_IDS.PLUTO]: 0.92,
    };
    
    const allPoiData = DB.MARKETS
        .filter(loc => uiManager.lastKnownState.player.unlockedLocationIds.includes(loc.id))
        .map(loc => {
            const baseRadius = loc.parent ? 12 : 16; 
            const finalRadius = baseRadius * (sizeModifiers[loc.id] || 1);
            let effectiveDistance = loc.distance;

            if (loc.parent) {
                const parent = DB.MARKETS.find(p => p.id === loc.parent);
                if (parent) {
                    effectiveDistance = parent.distance + 0.1; // Ensure moon appears after parent
                }
            }
            return { ...loc, effectiveDistance, finalRadius };
        })
        .sort((a, b) => a.effectiveDistance - b.effectiveDistance);

    const verticalSpacing = 130; // pixels
    const topPadding = 110;
    const bottomPadding = 30;

    const totalHeight = topPadding + ((allPoiData.length - 1) * verticalSpacing) + bottomPadding;
    svg.attr("height", totalHeight);

    const yPositions = new Map();
    allPoiData.forEach((d, i) => {
        yPositions.set(d.id, topPadding + (i * verticalSpacing));
    });

    svg.append("line")
        .attr("class", "central-axis")
        .attr("x1", "50%")
        .attr("y1", 0)
        .attr("x2", "50%")
        .attr("y2", totalHeight);

    const centerX = containerWidth / 2;

    const poiGroups = svg.selectAll(".poi-group")
        .data(allPoiData)
        .enter()
        .append("g")
        .attr("class", "poi-group")
        .attr("data-location-id", d => d.id)
        .on("click", (event, d) => {
             // Check if the click was directly on the POI shape or its label
            const targetElement = event.target;
            const groupElement = targetElement.closest('.poi-group');
            if (groupElement && (targetElement.tagName === 'circle' || targetElement.tagName === 'path' || targetElement.tagName === 'text')) {
                uiManager.showMapDetailModal(d.id);
            }
        });

    // *** MODIFIED: Draw leader lines FIRST ***
    poiGroups.append("line")
        .attr("class", "leader-line")
        .attr("x1", "50%")
        .attr("y1", d => yPositions.get(d.id))
        .attr("x2", (d, i) => centerX + (i % 2 === 0 ? -50 : 50))
        .attr("y2", d => yPositions.get(d.id));

    // *** MODIFIED: Draw POI shapes SECOND ***
    poiGroups.filter(d => d.id !== LOCATION_IDS.BELT)
        .append("circle")
        .attr("cx", "50%")
        .attr("cy", d => yPositions.get(d.id))
        .attr("r", d => d.finalRadius)
        .attr("fill", d => d.navTheme.borderColor);

    // *** MODIFIED: Draw Belt shape SECOND ***
    const beltGroup = poiGroups.filter(d => d.id === LOCATION_IDS.BELT);
    if (!beltGroup.empty()) {
        const beltRadius = beltGroup.datum().finalRadius;
        beltGroup.append("path")
            .attr("d", `M 0,${-beltRadius} L ${beltRadius},0 L 0,${beltRadius} L ${-beltRadius},0 Z`)
            .attr("transform", d => `translate(${centerX}, ${yPositions.get(d.id)})`)
            .attr("fill", d => d.navTheme.borderColor);
    }
        
    // *** MODIFIED: Draw labels THIRD ***
    poiGroups.append("text")
        .attr("class", "poi-label")
        .attr("x", (d, i) => centerX + (i % 2 === 0 ? -56 : 56  ))
        .attr("y", d => yPositions.get(d.id))
        .attr("text-anchor", (d, i) => i % 2 === 0 ? "end" : "start")
        .attr("dominant-baseline", "middle")
        .text(d => d.name);
}