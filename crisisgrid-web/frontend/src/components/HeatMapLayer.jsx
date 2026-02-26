import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
if (typeof window !== 'undefined') window.L = L;
import 'leaflet.heat';

export default function HeatMapLayer({ donors = [], requests = [] }) {
    const map = useMap();

    useEffect(() => {
        if (!map || typeof L.heatLayer === 'undefined') return;
        const layers = [];
        if (donors.length > 0) {
            const layer = L.heatLayer(donors, { radius: 25, blur: 20, maxZoom: 15, gradient: { 0.2: '#22c55e', 0.5: '#facc15', 1: '#ef4444' } });
            layer.addTo(map);
            layers.push(layer);
        }
        if (requests.length > 0) {
            const layer = L.heatLayer(requests, { radius: 25, blur: 20, maxZoom: 15, gradient: { 0.2: '#3b82f6', 0.5: '#8b5cf6', 1: '#ec4899' } });
            layer.addTo(map);
            layers.push(layer);
        }
        return () => layers.forEach((l) => l.remove());
    }, [map, donors, requests]);

    return null;
}
