/**
 * NavigationMap.jsx
 * Full-screen live navigation map for delivery missions.
 *
 * Two-leg route:
 *   Leg 1 (orange): agent current position → donor pickup
 *   Leg 2 (green):  donor pickup → NGO drop
 *
 * Features:
 *  - Animated rotating marker (requestAnimationFrame)
 *  - Flood/roadblock avoidance via OSRM + Turf.js
 *  - Route recomputation on environment changes
 *  - ETA + expiry countdown
 *  - "Rerouted" flash banner
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    computeMissionRoute,
    vehicleSpeedFactor,
    bearing,
    lerpPoint,
    fmtDuration,
    fmtDistance,
} from '../utils/routing';

// ─── Constants ───────────────────────────────────────────────────────────────
const ANIM_STEP_MS = 50;    // ~20 fps
const SIG_MOVE_M = 30;      // metres of GPS change before rerouting

// ─── Helper: haversine distance in metres ─────────────────────────────────────
function distM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Vehicle icon (rotatable div icon) ───────────────────────────────────────
function createVehicleIcon(vehicleType, rotation = 0) {
    const emoji = vehicleType === 'bike' ? '🏍️' : vehicleType === 'truck' ? '🚛' : '🚗';
    return L.divIcon({
        className: '',
        html: `<div style="
            font-size: 22px;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            transition: transform 0.1s linear;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        ">${emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}

// ─── Map inner component (has access to map instance) ────────────────────────
const NavMapInner = ({
    mission,
    envLayers,
    agentPos,        // [lat, lng] live GPS or fallback to base location
    onRouteComputed, // callback(routeData)
}) => {
    const map = useMap();

    // Refs for animation (avoid re-renders)
    const leg1Ref = useRef([]);
    const leg2Ref = useRef([]);
    const leg1PxRef = useRef(null); // L.Polyline
    const leg2PxRef = useRef(null);
    const markerRef = useRef(null);
    const rafRef = useRef(null);
    const animStateRef = useRef({ leg: 1, pointIdx: 0, fraction: 0, startTime: null });
    const speedRef = useRef(vehicleSpeedFactor(mission.deliveryAssistant?.vehicleType || mission.vehicleType || 'car'));
    const leg1DurRef = useRef(0);
    const leg2DurRef = useRef(0);
    const currentPosRef = useRef(agentPos);

    // ── Build/update polylines ──
    const drawPolylines = useCallback((leg1Coords, leg2Coords) => {
        if (leg1PxRef.current) map.removeLayer(leg1PxRef.current);
        if (leg2PxRef.current) map.removeLayer(leg2PxRef.current);

        leg1PxRef.current = L.polyline(leg1Coords, {
            color: '#f97316', weight: 5, opacity: 0.85, lineJoin: 'round',
        }).addTo(map);
        leg2PxRef.current = L.polyline(leg2Coords, {
            color: '#22c55e', weight: 5, opacity: 0.85, lineJoin: 'round',
        }).addTo(map);

        // Fit map to full route
        const all = [...leg1Coords, ...leg2Coords];
        if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [50, 50] });
    }, [map]);

    // ── Create animated marker ──
    const initMarker = useCallback((pos) => {
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker(pos, {
            icon: createVehicleIcon(mission.vehicleType || 'car', 0),
            zIndexOffset: 1000,
        }).addTo(map);
    }, [map, mission.vehicleType]);

    // ── Animation loop ──
    const startAnimation = useCallback((fromLeg = 1) => {
        if (rafRef.current) clearInterval(rafRef.current);
        animStateRef.current = { leg: fromLeg, pointIdx: 0, fraction: 0 };

        rafRef.current = setInterval(() => {
            const state = animStateRef.current;
            const coords = state.leg === 1 ? leg1Ref.current : leg2Ref.current;
            if (!coords || coords.length < 2) return;

            const durTotal = state.leg === 1 ? leg1DurRef.current : leg2DurRef.current;
            const speedFactor = speedRef.current;
            // How many ms per metre of route at ~14 km/h base
            const baseMs = durTotal > 0 ? (durTotal * 1000) / (coords.length - 1) : 800;
            const stepMs = baseMs * speedFactor;

            state.fraction += ANIM_STEP_MS / Math.max(stepMs, 50);
            if (state.fraction >= 1) {
                state.fraction = 0;
                state.pointIdx += 1;
                if (state.pointIdx >= coords.length - 1) {
                    // Leg complete
                    if (state.leg === 1) {
                        state.leg = 2;
                        state.pointIdx = 0;
                    } else {
                        clearInterval(rafRef.current);
                        return;
                    }
                }
            }

            const currCoords = state.leg === 1 ? leg1Ref.current : leg2Ref.current;
            const p1 = currCoords[state.pointIdx];
            const p2 = currCoords[state.pointIdx + 1];
            if (!p1 || !p2) return;

            const pos = lerpPoint(p1, p2, state.fraction);
            const brg = bearing(p1[0], p1[1], p2[0], p2[1]);

            if (markerRef.current) {
                markerRef.current.setLatLng(pos);
                markerRef.current.setIcon(createVehicleIcon(mission.vehicleType || 'car', brg));
            }
        }, ANIM_STEP_MS);
    }, [mission.vehicleType]);

    // ── Donor / NGO pins ──
    useEffect(() => {
        const donorLat = mission.pickupLocation?.coordinates?.[1];
        const donorLng = mission.pickupLocation?.coordinates?.[0];
        const ngoLat = mission.claimedBy?.location?.coordinates?.[1];
        const ngoLng = mission.claimedBy?.location?.coordinates?.[0];

        const pins = [];
        if (donorLat) {
            pins.push(L.marker([donorLat, donorLng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41],
                }),
            }).bindPopup(`<strong>🔴 Pickup</strong><br/>${mission.donorId?.name}<br/>${mission.address}`).addTo(map));
        }
        if (ngoLat) {
            pins.push(L.marker([ngoLat, ngoLng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41],
                }),
            }).bindPopup(`<strong>🟢 Drop: ${mission.claimedBy?.organizationName}</strong>`).addTo(map));
        }
        return () => pins.forEach(p => map.removeLayer(p));
    }, [map, mission]);

    // ── Route computation ──
    const computeRoute = useCallback(async (agentPosition) => {
        const donorLat = mission.pickupLocation?.coordinates?.[1];
        const donorLng = mission.pickupLocation?.coordinates?.[0];
        const ngoLat = mission.claimedBy?.location?.coordinates?.[1];
        const ngoLng = mission.claimedBy?.location?.coordinates?.[0];

        if (!donorLat || !ngoLat) return;

        const routeData = await computeMissionRoute(
            agentPosition,
            [donorLat, donorLng],
            [ngoLat, ngoLng],
            mission.vehicleType || 'car',
            envLayers
        );

        leg1Ref.current = routeData.leg1.coords;
        leg2Ref.current = routeData.leg2.coords;
        leg1DurRef.current = routeData.leg1.duration_s;
        leg2DurRef.current = routeData.leg2.duration_s;

        drawPolylines(routeData.leg1.coords, routeData.leg2.coords);
        initMarker(agentPosition);

        const activeLeg = animStateRef.current.leg;
        startAnimation(activeLeg);

        onRouteComputed(routeData);
    }, [mission, envLayers, drawPolylines, initMarker, startAnimation, onRouteComputed]);

    // ── Initial route ──
    useEffect(() => {
        computeRoute(agentPos);
        return () => {
            if (rafRef.current) clearInterval(rafRef.current);
            if (leg1PxRef.current) map.removeLayer(leg1PxRef.current);
            if (leg2PxRef.current) map.removeLayer(leg2PxRef.current);
            if (markerRef.current) map.removeLayer(markerRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Re-route when environment layers change ──
    useEffect(() => {
        const currentAnimPos = (() => {
            const state = animStateRef.current;
            const coords = state.leg === 1 ? leg1Ref.current : leg2Ref.current;
            if (!coords?.[state.pointIdx]) return agentPos;
            return lerpPoint(coords[state.pointIdx], coords[state.pointIdx + 1] || coords[state.pointIdx], state.fraction);
        })();
        computeRoute(currentAnimPos);
    }, [envLayers]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Live GPS update ──
    useEffect(() => {
        if (!agentPos) return;
        const prev = currentPosRef.current;
        const moved = distM(prev[0], prev[1], agentPos[0], agentPos[1]);
        if (moved > SIG_MOVE_M && animStateRef.current.leg === 1) {
            currentPosRef.current = agentPos;
            computeRoute(agentPos);
        }
    }, [agentPos, computeRoute]);

    return null;
};

// ─── ETA Panel ───────────────────────────────────────────────────────────────
const ETAPanel = ({ routeData, expiryTime, rerouteMsg }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    if (!routeData) return null;

    const expiryMs = expiryTime ? new Date(expiryTime) - now : null;
    const expiryLabel = expiryMs !== null
        ? expiryMs <= 0 ? { text: 'EXPIRED!', color: '#ef4444' }
            : expiryMs < 3 * 3600000 ? { text: `${Math.floor(expiryMs / 60000)}m left`, color: '#ef4444' }
                : expiryMs < 12 * 3600000 ? { text: `${Math.floor(expiryMs / 3600000)}h ${Math.floor((expiryMs % 3600000) / 60000)}m left`, color: '#f97316' }
                    : { text: `${Math.floor(expiryMs / 3600000)}h left`, color: '#22c55e' }
        : null;

    return (
        <div style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
            background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(10px)',
            borderRadius: '16px', padding: '16px 18px', width: '230px',
            border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: '#fff', fontSize: '0.82rem',
        }}>
            {/* Leg 1 */}
            <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: 10, height: 3, background: '#f97316', display: 'inline-block', borderRadius: 2 }}></span>
                    <span style={{ fontWeight: 700, color: '#f97316' }}>Base → Pickup</span>
                </div>
                <div style={{ paddingLeft: '16px', color: '#aaa' }}>
                    ⏱ {fmtDuration(routeData.leg1.duration_s)} &nbsp; 📏 {fmtDistance(routeData.leg1.distance_m)}
                </div>
            </div>
            {/* Leg 2 */}
            <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: 10, height: 3, background: '#22c55e', display: 'inline-block', borderRadius: 2 }}></span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>Pickup → NGO</span>
                </div>
                <div style={{ paddingLeft: '16px', color: '#aaa' }}>
                    ⏱ {fmtDuration(routeData.leg2.duration_s)} &nbsp; 📏 {fmtDistance(routeData.leg2.distance_m)}
                </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Total</span>
                <span style={{ fontWeight: 700 }}>
                    {fmtDuration(routeData.leg1.duration_s + routeData.leg2.duration_s)} &nbsp;
                    {fmtDistance(routeData.leg1.distance_m + routeData.leg2.distance_m)}
                </span>
            </div>

            {/* Expiry */}
            {expiryLabel && (
                <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '8px', background: expiryLabel.color + '18', color: expiryLabel.color, fontWeight: 700, textAlign: 'center' }}>
                    ⏰ {expiryLabel.text}
                </div>
            )}

            {/* Warning */}
            {routeData.warning && (
                <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>
                    {routeData.warning}
                </div>
            )}

            {/* Reroute flash */}
            {rerouteMsg && (
                <div style={{
                    marginTop: '8px', padding: '6px 10px', borderRadius: '8px',
                    background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                    fontSize: '0.75rem', fontWeight: 700, textAlign: 'center',
                    animation: 'fadeOut 3s forwards',
                }}>
                    🔄 {rerouteMsg}
                </div>
            )}
        </div>
    );
};

// ─── Map Legend ───────────────────────────────────────────────────────────────
const MapLegend = () => (
    <div style={{
        position: 'absolute', bottom: '24px', left: '16px', zIndex: 1000,
        background: 'rgba(10,14,23,0.88)', backdropFilter: 'blur(6px)',
        borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.75rem', color: '#ccc',
    }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ width: 16, height: 3, background: '#f97316', display: 'inline-block', borderRadius: 2 }}></span>
            Leg 1: Base → Pickup
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ width: 16, height: 3, background: '#22c55e', display: 'inline-block', borderRadius: 2 }}></span>
            Leg 2: Pickup → NGO
        </div>
    </div>
);

// ─── Main Export ──────────────────────────────────────────────────────────────
const NavigationMap = ({ mission, envLayers, agentPos }) => {
    const [routeData, setRouteData] = useState(null);
    const [rerouteMsg, setRerouteMsg] = useState(null);
    const prevRerouteRef = useRef(false);

    const handleRouteComputed = useCallback((data) => {
        setRouteData(data);
        if (data.rerouted && !prevRerouteRef.current) {
            const msg = data.warning?.includes('flood') ? 'Rerouted to avoid flood zone' : 'Rerouted to avoid road block';
            setRerouteMsg(msg);
            setTimeout(() => setRerouteMsg(null), 4000);
        }
        prevRerouteRef.current = data.rerouted;
    }, []);

    const defaultCenter = agentPos || [13.0827, 80.2707];

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <MapContainer
                center={defaultCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                />
                <NavMapInner
                    mission={mission}
                    envLayers={envLayers}
                    agentPos={agentPos || defaultCenter}
                    onRouteComputed={handleRouteComputed}
                />
            </MapContainer>

            <ETAPanel
                routeData={routeData}
                expiryTime={mission?.expiryTime}
                rerouteMsg={rerouteMsg}
            />
            <MapLegend />

            <style>{`
                @keyframes fadeOut {
                    0% { opacity: 1; }
                    70% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default NavigationMap;
