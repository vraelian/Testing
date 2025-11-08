// js/ui/components/MapScreen.js
/**
 * @fileoverview This file contains the rendering logic for the new Map screen.
 * It uses D3.js to render a stylized, interactive map of the solar system.
 *
 * ARCHITECTURE: "Hybrid Layering"
 * This component renders two layers:
 * 1. Substrate (SVG): A D3-drawn SVG background (#map-svg-substrate) for static
 * visuals like the central axis and leader lines.
 * 2. Interface (HTML): D3-generated, absolutely-positioned HTML <div>s
 * (#map-html-interface) for all interactive POIs (including the Sun) and labels.
 *
 * This hybrid approach avoids WKWebView rendering bugs related to SVG filters
 * by moving all interactive elements to standard HTML, which can be reliably
 * styled with pseudo-elements and CSS animations. Both layers are driven by a
 * single, unified data source to ensure perfect alignment.
 */
import { DB } from '../../data/database.js';
import { LOCATION_IDS } from '../../data/constants.js';

/**
 * Renders the two-layer container for the Map screen UI.
 * @returns {string} The HTML content for the Map screen container.
 */
export function renderMapScreen() {
    // #map-container is the scrolling parent
    // #map-svg-substrate holds the D3-drawn static background (z-index 1)
    // #map-html-interface holds the D3-bound HTML POIs (z-index 10)
    return `
        <div id="map-container" class="w-full h-full overflow-y-auto">
            <svg id="map-svg-substrate"></svg>
            <div id="map-html-interface"></div>
        </div>
    `;
}

/**
 * Initializes the D3 map, calculating data and drawing both layers.
 * @param {import('../../services/UIManager.js').UIManager} uiManager
 */
export function initMap(uiManager) {
    const container = d3.select("#map-container");
    const svgLayer = d3.select("#map-svg-substrate");
    const htmlLayer = d3.select("#map-html-interface");

    if (container.node().clientWidth === 0) {
        console.warn("Map container width is 0. Using ResizeObserver.");
        const observer = new ResizeObserver(entries => {
            if (entries[0].contentRect.width > 0) {
                _drawMap(container, svgLayer, htmlLayer, uiManager);
                observer.disconnect();
            }
        });
        observer.observe(container.node());
    } else {
        _drawMap(container, svgLayer, htmlLayer, uiManager);
    }
}

/**
 * Master drawing function. Calculates data and delegates to layer-specific
 * drawing functions.
 * @param {d3.Selection} container
 * @param {d3.Selection} svgLayer
 * @param {d3.Selection} htmlLayer
 * @param {import('../../services/UIManager.js').UIManager} uiManager
 * @private
 */
function _drawMap(container, svgLayer, htmlLayer, uiManager) {
    // Clear any previous map elements (for live-reload dev)
    svgLayer.selectAll("*").remove();
    htmlLayer.selectAll("*").remove();

    const containerWidth = container.node().clientWidth;
    const centerX = containerWidth / 2;

    // 1. Calculate the unified POI data array
    const { poiData, totalHeight } = _calculatePOIData(containerWidth, uiManager, centerX);

    // 2. Set the total height on the containers to enable scrolling
    container.style("height", "100%"); // Ensure container has a defined height
    svgLayer.attr("height", totalHeight);
    htmlLayer.style("height", `${totalHeight}px`);

    // 3. Draw the static SVG background
    _drawSubstrate(svgLayer, poiData, centerX, totalHeight);

    // 4. Draw the interactive HTML POIs
    _drawInterface(htmlLayer, poiData, uiManager, centerX);

    // 5. Apply the "you are here" highlight
    _updateCurrentLocationHighlight(uiManager);
}

/**
 * The "Brain" of the map. Calculates the unified data array used by both layers.
 * @param {number} containerWidth
 * @param {import('../../services/UIManager.js').UIManager} uiManager
 * @param {number} centerX
 * @returns {{poiData: Array<object>, totalHeight: number}}
 * @private
 */
function _calculatePOIData(containerWidth, uiManager, centerX) {
    const sizeModifiers = {
        [LOCATION_IDS.VENUS]: 1.035,
        [LOCATION_IDS.EARTH]: 1.035,
        [LOCATION_IDS.LUNA]: 0.805,
        [LOCATION_IDS.MARS]: 0.9775,
        [LOCATION_IDS.BELT]: 0.805,
        [LOCATION_IDS.EXCHANGE]: 0.805,
        [LOCATION_IDS.JUPITER]: 1.564,
        [LOCATION_IDS.SATURN]: 1.46625,
        [LOCATION_IDS.URANUS]: 1.27075,
        [LOCATION_IDS.NEPTUNE]: 1.27075,
        [LOCATION_IDS.KEPLER]: 0.8625,
        [LOCATION_IDS.PLUTO]: 0.92,
    };

    const allPoiData = DB.MARKETS
        .filter(loc => uiManager.lastKnownState.player.unlockedLocationIds.includes(loc.id))
        .map(loc => {
            let effectiveDistance = loc.distance;
            if (loc.parent) {
                const parent = DB.MARKETS.find(p => p.id === loc.parent);
                if (parent) effectiveDistance = parent.distance + 0.1;
            }
            return { ...loc, effectiveDistance };
        })
        .sort((a, b) => a.effectiveDistance - b.effectiveDistance);

    const verticalSpacing = 130;
    const topPadding = 110;
    const bottomPadding = 30;
    const totalHeight = topPadding + ((allPoiData.length - 1) * verticalSpacing) + bottomPadding;

    // Create the final data array with all calculated pixel coordinates
    const poiData = allPoiData.map((d, i) => {
        const y = topPadding + (i * verticalSpacing);
        const x = centerX + (i % 2 === 0 ? -50 : 50); // POI x-position
        const labelX = centerX + (i % 2 === 0 ? -56 : 56); // Label x-position
        const labelAnchor = (i % 2 === 0 ? "end" : "start");
        const radius = (d.parent ? 12 : 16) * (sizeModifiers[d.id] || 1);

        return {
            ...d,
            y,
            poiX: centerX, // X coord of the icon on the central axis
            labelX,
            labelAnchor,
            leaderLineX: x, // X coord for the end of the leader line
            radius
        };
    });

    return { poiData, totalHeight };
}

/**
 * Draws the static, non-interactive SVG background layer.
 * @param {d3.Selection} svgLayer
 * @param {Array<object>} poiData
 * @param {number} centerX
 * @param {number} totalHeight
 * @private
 */
function _drawSubstrate(svgLayer, poiData, centerX, totalHeight) {
    // --- VIRTUAL WORKBENCH: Removed Sun and Gradient definitions ---

    svgLayer.append("line")
        .attr("class", "central-axis")
        .attr("x1", centerX)
        .attr("y1", 0)
        .attr("x2", centerX)
        .attr("y2", totalHeight);

    // Bind data to draw the leader lines
    svgLayer.selectAll(".leader-line")
        .data(poiData)
        .enter()
        .append("line")
        .attr("class", "leader-line")
        .attr("x1", centerX)
        .attr("y1", d => d.y)
        .attr("x2", d => d.leaderLineX)
        .attr("y2", d => d.y);
}

/**
 * Draws the interactive HTML interface layer.
 * @param {d3.Selection} htmlLayer
 * @param {Array<object>} poiData
 * @param {import('../../services/UIManager.js').UIManager} uiManager
 * @param {number} centerX
 * @private
 */
function _drawInterface(htmlLayer, poiData, uiManager, centerX) {
    // --- VIRTUAL WORKBENCH: Add the Sun as an HTML element ---
    const sunRadius = 225;
    htmlLayer.append("div")
        .attr("id", "map-sun-poi")
        .style("position", "absolute")
        .style("top", "-195px") // Original cy
        .style("left", `${centerX}px`) // Original cx
        .style("width", `${sunRadius * 2}px`)
        .style("height", `${sunRadius * 2}px`);
    // --- END VIRTUAL WORKBENCH ---

    // Bind data to create HTML <div>s
    const groups = htmlLayer.selectAll(".poi-marker-group")
        .data(poiData)
        .enter()
        .append("div")
        .attr("class", "poi-marker-group")
        .attr("data-location-id", d => d.id)
        .style("position", "absolute")
        .style("top", d => `${d.y}px`)
        .on("click", (event, d) => {
            uiManager.showMapDetailModal(d.id);
        });

    // POI Icons (on the central axis)
    groups.append("div")
        .attr("class", d => d.id === LOCATION_IDS.BELT ? "poi-icon belt" : "poi-icon planet")
        .style("position", "absolute")
        .style("left", d => `${d.poiX}px`) // Centered on axis
        .style("width", d => `${d.radius * 2}px`)
        .style("height", d => `${d.radius * 2}px`)
        .style("background-color", d => d.navTheme.borderColor);

    // POI Labels (alternating sides)
    groups.append("div")
        .attr("class", "poi-label")
        .style("position", "absolute")
        .style("left", d => `${d.labelX}px`)
        .style("text-anchor", d => d.labelAnchor)
        .text(d => d.name);
}

/**
 * Updates the HTML interface to apply the .current-location class
 * AND auto-scrolls the container to center the POI.
 * This is called every time the map is viewed.
 * @param {import('../../services/UIManager.js').UIManager} uiManager
 * @private
 */
function _updateCurrentLocationHighlight(uiManager) {
    const container = d3.select("#map-container");
    if (container.empty()) return;

    const currentLocationId = uiManager.lastKnownState.currentLocationId;
    const locationData = DB.MARKETS.find(loc => loc.id === currentLocationId);
    if (!locationData) return;

    // 1. Set the global theme color on the root container
    container.style("--theme-glow-color", locationData.navTheme.borderColor);

    // 2. Remove the class from the old POI (if any)
    container.select(".poi-marker-group.current-location")
        .classed("current-location", false);

    // 3. Add the class to the new, current POI
    const currentPOIGroup = container.select(`.poi-marker-group[data-location-id="${currentLocationId}"]`);
    currentPOIGroup.classed("current-location", true);

    // Auto-scroll logic
    const containerNode = container.node();
    const poiNode = currentPOIGroup.node();

    if (containerNode && poiNode) {
        // Handle Pluto edge case: scroll to bottom
        if (currentLocationId === LOCATION_IDS.PLUTO) {
            containerNode.scrollTop = containerNode.scrollHeight;
        } else {
            // Main case: center the POI
            const containerHeight = containerNode.clientHeight;
            const poiTop = poiNode.offsetTop; // POI's Y position
            
            // Calculate the scroll position to center the POI
            const newScrollTop = poiTop - (containerHeight / 2);
            
            // Set the scroll position
            containerNode.scrollTop = newScrollTop;
        }
    }
}