// js/ui/components/MapScreen.js
/**
 * @fileoverview This file contains the rendering logic for the new Map screen.
 * It uses D3.js to render a stylized, interactive map of the solar system.
 */
import { DB } from '../../data/database.js';

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
    // Exit if the container doesn't exist or if the SVG is already there.
    if (!container.node() || !container.select("svg").empty()) {
        return;
    }

    const svg = container.append("svg")
        .attr("id", "map-svg")
        .attr("width", "100%")
        .attr("height", "100%");

    // Add sun and glow
    const defs = svg.append("defs");
    const radialGradient = defs.append("radialGradient")
        .attr("id", "sun-gradient");
    radialGradient.append("stop").attr("offset", "0%").attr("stop-color", "#fef08a");
    radialGradient.append("stop").attr("offset", "100%").attr("stop-color", "#fde047");

    svg.append("circle")
        .attr("class", "sun")
        .attr("cx", "50%")
        .attr("cy", 50)
        .attr("r", 30)
        .attr("fill", "url(#sun-gradient)");

    // Add central axis
    svg.append("line")
        .attr("class", "central-axis")
        .attr("x1", "50%")
        .attr("y1", 50)
        .attr("x2", "50%")
        .attr("y2", "100%");

    const y = d3.scaleLog()
      .domain([1, 1200])
      .range([120, container.node().clientHeight - 50]);

    const poiData = DB.MARKETS.filter(loc => uiManager.lastKnownState.player.unlockedLocationIds.includes(loc.id));

    const poiGroups = svg.selectAll(".poi-group")
        .data(poiData)
        .enter()
        .append("g")
        .attr("class", "poi-group")
        .attr("data-action", "show-map-modal")
        .attr("data-location-id", d => d.id)
        .on("click", (event, d) => {
             uiManager.showMapDetailModal(d.id);
         });

    poiGroups.append("circle")
        .attr("cx", (d, i) => i % 2 === 0 ? "35%" : "65%")
        .attr("cy", d => y(d.distance))
        .attr("r", d => d.parent ? 10 : 15)
        .attr("fill", d => d.navTheme.borderColor);

    poiGroups.append("text")
        .attr("class", "poi-label")
        .attr("x", (d, i) => i % 2 === 0 ? "35%" : "65%")
        .attr("y", d => y(d.distance) + (d.parent ? 22 : 28))
        .text(d => d.name);
}