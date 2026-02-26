import { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapData } from '../api/index';
import HeatMapLayer from '../components/HeatMapLayer';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const defaultCenter = [13.0827, 80.2707]; // Chennai

const HeatMapPage = () => {
    const [data, setData] = useState({ donors: [], requests: [] });
    const [loading, setLoading] = useState(true);
    const [layer, setLayer] = useState('both'); // 'donors' | 'requests' | 'both'

    useEffect(() => {
        getMapData()
            .then((res) => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const donors = layer === 'requests' ? [] : data.donors || [];
    const requests = layer === 'donors' ? [] : data.requests || [];

    return (
        <div className="page-wrapper">
            <div className="dashboard">
                <div className="dashboard-header">
                    <h1 className="dashboard-title">🗺️ Heat Map</h1>
                    <p className="dashboard-subtitle">Donor locations (green/orange) and request/claim activity (blue/purple)</p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                        <button type="button" className={`btn btn-sm ${layer === 'both' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLayer('both')}>Both</button>
                        <button type="button" className={`btn btn-sm ${layer === 'donors' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLayer('donors')}>Donors only</button>
                        <button type="button" className={`btn btn-sm ${layer === 'requests' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLayer('requests')}>Requests only</button>
                    </div>
                </div>
                <div style={{ height: '60vh', minHeight: 400, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {loading ? (
                        <div className="spinner-wrap" style={{ height: '100%' }}><div className="spinner" /></div>
                    ) : (
                        <MapContainer center={defaultCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
                            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <HeatMapLayer donors={donors} requests={requests} />
                        </MapContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeatMapPage;
