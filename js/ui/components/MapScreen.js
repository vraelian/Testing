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
    return `<div id="map-container" class="w-full h-full"></div>`;
}

/**
 * Initializes and renders the D3 map within the #map-container element.
 * @param {import('../../services/UIManager.js').UIManager} uiManager - The UIManager instance, passed for modal interactivity.
 */
export function initMap(uiManager) {
    const container = d3.select("#map-container");
    if (!container.node() || !container.select("svg").empty()) {
        return;
    }

    const svg = container.append("svg")
        .attr("id", "map-svg")
        .attr("width", "100%")
        .attr("height", "100%");

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

    svg.append("line")
        .attr("class", "central-axis")
        .attr("x1", "50%")
        .attr("y1", 0)
        .attr("x2", "50%")
        .attr("y2", "100%");

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
            const baseRadius = loc.parent ? 8 : 12;
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

    // Create a point scale for equidistant vertical spacing with padding
    const y = d3.scalePoint()
        .domain(allPoiData.map(d => d.id))
        .range([120, container.node().clientHeight - 80])
        .padding(0.1); // Adds 10% spacing between points

    const centerX = container.node().clientWidth / 2;

    const poiGroups = svg.selectAll(".poi-group")
        .data(allPoiData)
        .enter()
        .append("g")
        .attr("class", "poi-group")
        .attr("data-location-id", d => d.id)
        .on("click", (event, d) => {
            uiManager.showMapDetailModal(d.id);
        });

    poiGroups.filter(d => d.id !== LOCATION_IDS.BELT)
        .append("circle")
        .attr("cx", "50%")
        .attr("cy", d => y(d.id))
        .attr("r", d => d.finalRadius)
        .attr("fill", d => d.navTheme.borderColor);

    const beltGroup = poiGroups.filter(d => d.id === LOCATION_IDS.BELT);
    if (!beltGroup.empty()) {
        const beltRadius = beltGroup.datum().finalRadius;
        beltGroup.append("path")
            .attr("d", `M 0,${-beltRadius} L ${beltRadius},0 L 0,${beltRadius} L ${-beltRadius},0 Z`)
            .attr("transform", d => `translate(${centerX}, ${y(d.id)})`)
            .attr("fill", d => d.navTheme.borderColor);
    }
        
    poiGroups.append("line")
        .attr("class", "leader-line")
        .attr("x1", "50%")
        .attr("y1", d => y(d.id))
        .attr("x2", (d, i) => centerX + (i % 2 === 0 ? -46 : 46))
        .attr("y2", d => y(d.id));

    poiGroups.append("text")
        .attr("class", "poi-label")
        .attr("x", (d, i) => centerX + (i % 2 === 0 ? -52 : 52))
        .attr("y", d => y(d.id))
        .attr("text-anchor", (d, i) => i % 2 === 0 ? "end" : "start")
        .attr("dominant-baseline", "middle")
        .text(d => d.name);
}