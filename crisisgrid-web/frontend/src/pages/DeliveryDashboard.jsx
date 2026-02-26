import { useState, useEffect, useCallback } from 'react';
import { getAvailableMissions, acceptMission, updateMissionStatus, getDeliveryHistory, getActiveMission } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const DeliveryDashboard = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('available'); // 'available', 'active', 'history'
    const [missions, setMissions] = useState([]);
    const [activeMission, setActiveMission] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [availRes, historyRes] = await Promise.all([
                getAvailableMissions(),
                getDeliveryHistory()
            ]);

            setMissions(availRes.data);
            setHistory(historyRes.data);

            const activeRes = await getActiveMission();
            if (activeRes.data) {
                setActiveMission(activeRes.data);
                setTab('active');
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch active mission specifically
    const fetchActive = useCallback(async () => {
        try {
            const res = await getAvailableMissions(); // This needs to be smarter
            // For this MVP, we'll just check if the user is assigned to any non-delivered claimed donation
            // We'll update the backend or just handle it here if we had more info.
            // Let's assume the user knows if they have an active mission from state.
        } catch (err) { }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAccept = async (id) => {
        try {
            const res = await acceptMission(id);
            setActiveMission(res.data);
            setMissions(prev => prev.filter(m => m._id !== id));
            setTab('active');
            showToast('🚚 Mission accepted! Head to pickup location.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to accept mission', 'error');
        }
    };

    const handleStatusUpdate = async (status) => {
        if (!activeMission) return;
        try {
            const res = await updateMissionStatus(activeMission._id, status);
            setActiveMission(status === 'delivered' ? null : res.data);
            if (status === 'delivered') {
                setTab('history');
                fetchData();
                showToast('✅ Mission completed! Great job.');
            } else {
                showToast(`📦 Status updated: ${status.replace('_', ' ')}`);
            }
        } catch (err) {
            showToast('Failed to update status', 'error');
        }
    };

    const MissionCard = ({ mission, onAccept }) => (
        <div className="donation-card fade-in">
            <div className="donation-card-top">
                <div className="donation-card-content">
                    <div className="donation-card-title">{mission.foodName}</div>
                    <div className="donation-card-meta">
                        👥 {mission.servings} servings • 📍 {mission.donorId?.name}
                    </div>
                </div>
                <div className="donation-card-badges">
                    <span className="badge badge-veg">{mission.foodType?.toUpperCase()}</span>
                    <span className="badge badge-claimed">WAITING DELIVERY</span>
                </div>
            </div>
            <div className="donation-card-footer">
                <div className="donation-card-details">
                    <div className="donation-detail">
                        🚩 <strong>Pickup:</strong> {mission.address}
                    </div>
                    <div className="donation-detail">
                        🏁 <strong>Drop:</strong> {mission.claimedBy?.organizationName}
                    </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => onAccept(mission._id)}>
                    Accept Mission
                </button>
            </div>
        </div>
    );

    return (
        <div className="page-wrapper">
            <div className="dashboard">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">🚴 Logistics Portal</h1>
                        <p className="dashboard-subtitle">Active Support for {user?.name}</p>
                    </div>
                    <div className="vehicle-badge">
                        {user?.vehicleType === 'bike' ? '🏍️' : user?.vehicleType === 'car' ? '🚗' : '🚐'}
                        <span>{user?.vehicleType?.toUpperCase()} ({user?.vehicleCapacity} servings)</span>
                    </div>
                </div>

                <div className="auth-tabs" style={{ marginBottom: '24px' }}>
                    <button className={`auth-tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
                        Available ({missions.length})
                    </button>
                    <button className={`auth-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
                        Active Mission {activeMission ? '🔴' : ''}
                    </button>
                    <button className={`auth-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
                        History
                    </button>
                </div>

                {loading ? (
                    <div className="spinner-wrap"><div className="spinner" /></div>
                ) : (
                    <div className="dashboard-content">
                        {tab === 'available' && (
                            <div className="fade-in">
                                {missions.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">🏁</div>
                                        <div className="empty-state-title">No available missions</div>
                                        <p>Check back later for new delivery requests near you.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {missions.map(m => (
                                            <MissionCard key={m._id} mission={m} onAccept={handleAccept} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'active' && (
                            <div className="fade-in">
                                {!activeMission ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📍</div>
                                        <div className="empty-state-title">No active mission</div>
                                        <p>Accept a mission from the "Available" tab to start.</p>
                                    </div>
                                ) : (
                                    <div className="active-mission-grid">
                                        <div className="card card-body">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                <h3 style={{ fontWeight: 800 }}>📦 Active Mission</h3>
                                                <span className="badge badge-claimed">{activeMission.deliveryStatus.replace('_', ' ').toUpperCase()}</span>
                                            </div>

                                            <div className="mission-steps">
                                                <div className={`mission-step ${['accepted_by_delivery', 'picked_up', 'delivered'].includes(activeMission.deliveryStatus) ? 'done' : ''}`}>
                                                    <div className="step-point">1</div>
                                                    <div className="step-info">
                                                        <strong>Pickup from Donor</strong>
                                                        <p>{activeMission.donorId?.name} • {activeMission.address}</p>
                                                        <p style={{ color: 'var(--orange)', fontWeight: 600 }}>📞 {activeMission.donorId?.phone}</p>
                                                    </div>
                                                </div>
                                                <div className={`mission-step ${['picked_up', 'delivered'].includes(activeMission.deliveryStatus) ? 'done' : ''}`}>
                                                    <div className="step-point">2</div>
                                                    <div className="step-info">
                                                        <strong>Drop at NGO</strong>
                                                        <p>{activeMission.claimedBy?.organizationName} • {activeMission.claimedBy?.address || 'NGO Office'}</p>
                                                        <p style={{ color: 'var(--blue)', fontWeight: 600 }}>📞 {activeMission.claimedBy?.phone}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mission-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                                                {activeMission.deliveryStatus === 'accepted_by_delivery' && (
                                                    <button className="btn btn-primary btn-full" onClick={() => handleStatusUpdate('picked_up')}>
                                                        Mark as Picked Up
                                                    </button>
                                                )}
                                                {activeMission.deliveryStatus === 'picked_up' && (
                                                    <button className="btn btn-primary btn-full" style={{ background: 'var(--green)' }} onClick={() => handleStatusUpdate('delivered')}>
                                                        Mark as Delivered
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="card" style={{ height: '400px', overflow: 'hidden', borderRadius: '20px' }}>
                                            <MapContainer
                                                center={[activeMission.pickupLocation?.coordinates[1] || 13.0827, activeMission.pickupLocation?.coordinates[0] || 80.2707]}
                                                zoom={13}
                                                style={{ height: '100%', width: '100%' }}
                                            >
                                                <TileLayer
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                                <Marker position={[activeMission.pickupLocation?.coordinates[1], activeMission.pickupLocation?.coordinates[0]]} icon={blueIcon}>
                                                    <Popup>Pickup: {activeMission.donorId?.name}</Popup>
                                                </Marker>
                                                {/* If NGO has coords, show them */}
                                                {activeMission.claimedBy?.location?.coordinates && (
                                                    <Marker position={[activeMission.claimedBy.location.coordinates[1], activeMission.claimedBy.location.coordinates[0]]} icon={redIcon}>
                                                        <Popup>Drop: {activeMission.claimedBy.organizationName}</Popup>
                                                    </Marker>
                                                )}
                                            </MapContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'history' && (
                            <div className="fade-in">
                                {history.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📋</div>
                                        <div className="empty-state-title">No history found</div>
                                        <p>Your completed deliveries will appear here.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {history.map(h => (
                                            <div key={h._id} className="history-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>{h.foodName}</strong>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                            {new Date(h.updatedAt).toLocaleDateString()} • {h.servings} servings
                                                        </p>
                                                    </div>
                                                    <span className="badge badge-veg">✅ DELIVERED</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {toast && <div className={`toast toast-${toast.type} fade-in`}>{toast.msg}</div>}

            <style>{`
                .vehicle-badge {
                    background: var(--card-bg);
                    padding: 8px 16px;
                    border-radius: 99px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    border: 1px solid var(--border-color);
                    box-shadow: var(--shadow-sm);
                }
                .active-mission-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                @media (max-width: 900px) {
                    .active-mission-grid { grid-template-columns: 1fr; }
                }
                .mission-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    position: relative;
                    padding-left: 20px;
                }
                .mission-steps::before {
                    content: '';
                    position: absolute;
                    left: 29px;
                    top: 10px;
                    bottom: 10px;
                    width: 2px;
                    background: var(--border-color);
                    z-index: 0;
                }
                .mission-step {
                    display: flex;
                    gap: 24px;
                    position: relative;
                    z-index: 1;
                }
                .step-point {
                    width: 20px;
                    height: 20px;
                    background: var(--card-bg);
                    border: 2px solid var(--border-color);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .mission-step.done .step-point {
                    border-color: var(--orange);
                    background: var(--orange);
                    color: white;
                }
                .step-info p {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin: 4px 0;
                }
                .history-card {
                    background: var(--card-bg);
                    padding: 16px 20px;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                }
            `}</style>
        </div>
    );
};

export default DeliveryDashboard;
