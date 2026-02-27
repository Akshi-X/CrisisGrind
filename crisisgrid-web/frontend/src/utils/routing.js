/**
 * routing.js — OSRM-based routing with Turf.js flood/roadblock avoidance
 *
 * Rules:
 *  - Flood polygon severity > 3 → NON-ROUTABLE
 *  - Any blocked road polyline → NON-ROUTABLE
 *  - Rerouting: generate bypass waypoints around obstacle bounding box
 *  - Max 3 bypass attempts per leg; pick lowest-duration valid route
 */

import * as turf from '@turf/turf';

const OSRM = 'https://router.project-osrm.org/route/v1';
const MAX_BYPASS_ATTEMPTS = 3;

// Vehicle → OSRM profile
export const vehicleProfile = (vehicleType) => {
    if (vehicleType === 'bike') return 'cycling';
    if (vehicleType === 'truck') return 'driving';
    return 'driving';
};

// Speed multiplier for animation (relative to routing speed)
export const vehicleSpeedFactor = (vehicleType) => {
    if (vehicleType === 'bike') return 0.85;
    if (vehicleType === 'truck') return 0.65;
    return 1.0;
};

/**
 * Fetch a single OSRM route.
 * waypoints: [[lat,lng], ...]
 * Returns { coords: [[lat,lng]...], distance_m, duration_s } or null
 */
async function fetchOSRM(profile, waypoints) {
    try {
        const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
        const url = `${OSRM}/${profile}/${coordStr}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) return null;
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        return { coords, distance_m: route.distance, duration_s: route.duration };
    } catch {
        return null;
    }
}

/**
 * Build a Turf LineString from [[lat,lng]...] coords.
 */
function turfLine(coordsLatLng) {
    return turf.lineString(coordsLatLng.map(([lat, lng]) => [lng, lat]));
}

/**
 * Check if a route (OSRM coord array [[lat,lng]...]) intersects any obstacle.
 * Returns the first intersecting obstacle or null.
 */
function checkRouteObstacles(routeCoords, envLayers) {
    const line = turfLine(routeCoords);

    for (const layer of envLayers) {
        if (!layer.isActive) continue;

        if (layer.type === 'flood' && layer.geometry?.type === 'Polygon') {
            if (layer.severity > 3) {
                const poly = turf.polygon(layer.geometry.coordinates);
                if (turf.booleanIntersects(line, poly)) {
                    return { layer, kind: 'flood' };
                }
            }
        }

        if (layer.type === 'roadblock' && layer.geometry?.type === 'LineString') {
            const blocked = turf.lineString(layer.geometry.coordinates);
            if (turf.booleanIntersects(line, blocked)) {
                return { layer, kind: 'roadblock' };
            }
        }
    }

    return null;
}

/**
 * Generate bypass waypoints around an obstacle's bounding box.
 * Returns up to 3 sets of waypoints to try (inserting a different corner).
 */
function bypassWaypoints(origin, destination, obstacle) {
    let geom;
    if (obstacle.layer.type === 'flood') {
        geom = turf.polygon(obstacle.layer.geometry.coordinates);
    } else {
        geom = turf.lineString(obstacle.layer.geometry.coordinates);
    }

    const bbox = turf.bbox(geom); // [minLng, minLat, maxLng, maxLat]
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const pad = 0.003; // ~300m padding

    // 4 corners of bounding box (with padding)
    const corners = [
        [minLat - pad, minLng - pad], // SW
        [maxLat + pad, minLng - pad], // NW
        [minLat - pad, maxLng + pad], // SE
        [maxLat + pad, maxLng + pad], // NE
    ];

    // Return 3 bypass options: try each quadrant corner as intermediate waypoint
    return corners.slice(0, MAX_BYPASS_ATTEMPTS).map(corner => [origin, corner, destination]);
}

/**
 * Compute an optimal, valid single-leg route.
 * Returns { coords, distance_m, duration_s, rerouted: boolean, warning: string|null }
 */
async function computeValidLeg(profile, origin, destination, envLayers) {
    // 1. Try direct route first
    let result = await fetchOSRM(profile, [origin, destination]);

    if (result) {
        const obstacle = checkRouteObstacles(result.coords, envLayers);
        if (!obstacle) {
            return { ...result, rerouted: false, warning: null };
        }

        // 2. Route is invalid — try bypass waypoints
        const bypasses = bypassWaypoints(origin, destination, obstacle);
        const candidates = [];

        for (const waypoints of bypasses) {
            const candidate = await fetchOSRM(profile, waypoints);
            if (!candidate) continue;
            const obstacleAfter = checkRouteObstacles(candidate.coords, envLayers);
            if (!obstacleAfter) {
                candidates.push(candidate);
            }
        }

        if (candidates.length > 0) {
            // Pick the fastest valid candidate
            const best = candidates.sort((a, b) => a.duration_s - b.duration_s)[0];
            const warningType = obstacle.kind === 'flood' ? 'flood zone' : 'road block';
            return { ...best, rerouted: true, warning: `Rerouted to avoid ${warningType}` };
        }

        // 3. No valid route found — return with warning
        const warningType = obstacle.kind === 'flood' ? 'flood zone (Severity ' + obstacle.layer.severity + ')' : 'blocked road';
        return {
            ...result,
            rerouted: false,
            warning: `⚠️ No safe route found — route passes through ${warningType}`,
        };
    }

    return null; // OSRM failed completely
}

/**
 * Compute the full two-leg route for a delivery mission.
 *
 * @param {[lat,lng]} agentPos  Current delivery assistant position
 * @param {[lat,lng]} donorPos  Pickup location
 * @param {[lat,lng]} ngoPos    Drop-off location
 * @param {string}    vehicleType
 * @param {object[]}  envLayers Active environment layers from backend
 * @returns {{ leg1, leg2, totalDistance_m, totalDuration_s, warning }}
 */
export async function computeMissionRoute(agentPos, donorPos, ngoPos, vehicleType, envLayers) {
    const profile = vehicleProfile(vehicleType);
    const activeObstacles = envLayers.filter(l => l.isActive);

    const [leg1, leg2] = await Promise.all([
        computeValidLeg(profile, agentPos, donorPos, activeObstacles),
        computeValidLeg(profile, donorPos, ngoPos, activeObstacles),
    ]);

    const warning = leg1?.warning || leg2?.warning || null;

    return {
        leg1: leg1 || { coords: [agentPos, donorPos], distance_m: 0, duration_s: 0, rerouted: false },
        leg2: leg2 || { coords: [donorPos, ngoPos], distance_m: 0, duration_s: 0, rerouted: false },
        totalDistance_m: (leg1?.distance_m || 0) + (leg2?.distance_m || 0),
        totalDuration_s: (leg1?.duration_s || 0) + (leg2?.duration_s || 0),
        rerouted: leg1?.rerouted || leg2?.rerouted || false,
        warning,
    };
}

/**
 * Calculate bearing (degrees) from point A to point B.
 * Used for rotating the moving marker.
 */
export function bearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/**
 * Linearly interpolate between two [lat,lng] points.
 */
export function lerpPoint([lat1, lng1], [lat2, lng2], t) {
    return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
}

/**
 * Format seconds into "Xm Ys" string.
 */
export function fmtDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
}

/**
 * Format distance in meters to km string.
 */
export function fmtDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}
