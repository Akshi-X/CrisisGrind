import { useState, useEffect } from 'react';
import { parseQuery, geocodeHint, searchDonations, claimDonation, getMyClaims, releaseClaim, getMyAnalytics, createReport, getSavedSearches, createSavedSearch, deleteSavedSearch } from '../api/index';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';

const NgoDashboard = () => {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState(null);
    const [filters, setFilters] = useState(null);
    const [view, setView] = useState('list');
    const [claiming, setClaiming] = useState(null);
    const [toast, setToast] = useState(null);
    const [error, setError] = useState('');
    const [myClaims, setMyClaims] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [savedSearches, setSavedSearches] = useState([]);
    const [reportModal, setReportModal] = useState(null); // { donationId, foodName }
    const [reportReason, setReportReason] = useState('');
    const [releasing, setReleasing] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        setResults(null);
        setError('');
        setFilters(null);

        try {
            // Step 1: AI parse
            const aiRes = await parseQuery(query);
            const parsed = aiRes.data.filters;
            setFilters(parsed);

            // Step 2: Geocode locationHint
            let lat = 13.0827;
            let lng = 80.2707; // Default: Chennai
            if (parsed.locationHint) {
                try {
                    // Append region context to improve geocoding accuracy
                    const geoRes = await geocodeHint(`${parsed.locationHint}, Chennai`);
                    lat = geoRes.data.lat;
                    lng = geoRes.data.lng;
                } catch {
                    // geocoding failed; use defaults
                }
            }

            // Step 3: Search MongoDB via $geoNear
            const params = {
                lat, lng,
                ...(parsed.foodType && { foodType: parsed.foodType }),
                ...(parsed.quantityPeople && { minServings: parsed.quantityPeople }),
            };
            const searchRes = await searchDonations(params);
            setResults(searchRes.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Search failed. Please try again.');
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        getMyClaims().then((res) => setMyClaims(res.data)).catch(() => {});
        getMyAnalytics().then((res) => setAnalytics(res.data)).catch(() => {});
        getSavedSearches().then((res) => setSavedSearches(res.data)).catch(() => {});
    }, []);

    const handleClaim = async (id, foodName) => {
        setClaiming(id);
        try {
            await claimDonation(id);
            setResults((prev) => prev && prev.filter((d) => d._id !== id));
            const claimsRes = await getMyClaims();
            setMyClaims(claimsRes.data);
            getMyAnalytics().then((r) => setAnalytics(r.data)).catch(() => {});
            showToast(`✅ Successfully claimed: ${foodName}`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to claim donation', 'error');
        } finally {
            setClaiming(null);
        }
    };

    const handleRelease = async (id, foodName) => {
        setReleasing(id);
        try {
            await releaseClaim(id);
            setMyClaims((prev) => prev.filter((c) => c._id !== id));
            getMyAnalytics().then((r) => setAnalytics(r.data)).catch(() => {});
            showToast(`Claim released: ${foodName} is available again`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Release failed', 'error');
        } finally {
            setReleasing(null);
        }
    };

    const runSavedSearch = async (saved) => {
        setQuery(saved.name || '');
        setSearching(true);
        setResults(null);
        setError('');
        try {
            const searchRes = await searchDonations({
                lat: saved.lat,
                lng: saved.lng,
                ...(saved.foodType && { foodType: saved.foodType }),
                ...(saved.minServings && { minServings: saved.minServings }),
                maxDistance: saved.maxDistance || 50000,
            });
            setResults(searchRes.data);
            setFilters({ foodType: saved.foodType || null, quantityPeople: saved.minServings || null, locationHint: saved.name || null });
        } catch (err) {
            setError(err.response?.data?.message || 'Search failed');
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleSaveSearch = async () => {
        if (!filters || results == null) return;
        let lat = 13.0827, lng = 80.2707;
        if (filters.locationHint) {
            try {
                const geoRes = await geocodeHint(`${filters.locationHint}, Chennai`);
                lat = geoRes.data.lat;
                lng = geoRes.data.lng;
            } catch (_) {}
        }
        try {
            await createSavedSearch({
                name: query.slice(0, 50) || 'My search',
                lat,
                lng,
                foodType: filters.foodType || '',
                minServings: filters.quantityPeople || null,
            });
            const list = await getSavedSearches();
            setSavedSearches(list.data);
            showToast('Search saved');
        } catch (err) {
            showToast(err.response?.data?.message || 'Save failed', 'error');
        }
    };

    const handleReportSubmit = async () => {
        if (!reportModal || !reportReason.trim()) return;
        try {
            await createReport({ reportedDonationId: reportModal.donationId, reason: reportReason.trim() });
            setReportModal(null);
            setReportReason('');
            showToast('Report submitted');
        } catch (err) {
            showToast(err.response?.data?.message || 'Report failed', 'error');
        }
    };

    return (
        <div className="page-wrapper">
            <div className="dashboard">
                <div className="dashboard-header">
                    <h1 className="dashboard-title">🔍 NGO Smart Search</h1>
                    <p className="dashboard-subtitle">Welcome, {user?.organizationName || user?.name}</p>
                    {analytics && (
                        <div style={{ display: 'flex', gap: '20px', marginTop: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text-primary)' }}>{analytics.claimed}</strong> claimed</span>
                            <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text-primary)' }}>{analytics.mealsRescued || 0}</strong> meals rescued</span>
                        </div>
                    )}
                </div>

                {/* Saved searches */}
                {savedSearches.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: 8 }}>Saved:</span>
                        {savedSearches.slice(0, 5).map((s) => (
                            <button key={s._id} type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => runSavedSearch(s)}>{s.name || 'Search'}</button>
                        ))}
                    </div>
                )}

                {/* AI Search Bar */}
                <div className="ai-searchbar-wrap">
                    <div className="ai-searchbar-label">
                        🤖 AI-Powered Natural Language Search
                    </div>
                    <div className="ai-searchbar-input-row">
                        <textarea
                            className="ai-searchbar-input"
                            rows={2}
                            placeholder='e.g., "Need veg food for 50 people near Anna Nagar urgently"'
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSearch())}
                        />
                        <button
                            className={`btn btn-primary ${searching ? 'btn-loading' : ''}`}
                            onClick={handleSearch}
                            disabled={searching || !query.trim()}
                            style={{ alignSelf: 'stretch', minWidth: '120px' }}
                        >
                            {!searching && '🔍 Search'}
                        </button>
                    </div>

                    {/* Filter chips from AI response */}
                    {filters && (
                        <div className="filter-chips">
                            <span className="filter-chip">🤖 AI Extracted:</span>
                            {results !== null && <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={handleSaveSearch}>💾 Save search</button>}
                            {filters.foodType && (
                                <span className={`filter-chip ${filters.foodType === 'veg' ? 'chip-green' : 'chip-red'}`}>
                                    {filters.foodType === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}
                                </span>
                            )}
                            {filters.quantityPeople && (
                                <span className="filter-chip chip-blue">👥 {filters.quantityPeople} people</span>
                            )}
                            {filters.locationHint && (
                                <span className="filter-chip chip-orange">📍 {filters.locationHint}</span>
                            )}
                            {filters.urgency === 'urgent' && (
                                <span className="badge badge-urgent">⚡ Urgent</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Results header */}
                {results !== null && (
                    <div className="results-header">
                        <div className="results-count">
                            Found <strong>{results.length}</strong> donation{results.length !== 1 ? 's' : ''}, sorted by distance
                        </div>
                        <div className="view-toggle">
                            <button
                                className={`view-btn ${view === 'list' ? 'active' : ''}`}
                                onClick={() => setView('list')}
                            >☰ List</button>
                            <button
                                className={`view-btn ${view === 'map' ? 'active' : ''}`}
                                onClick={() => setView('map')}
                            >🗺 Map</button>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {searching && <div className="spinner-wrap"><div className="spinner" /></div>}

                {/* Error */}
                {error && (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚠️</div>
                        <div className="empty-state-title">Search Error</div>
                        <p>{error}</p>
                    </div>
                )}

                {/* No results yet */}
                {results === null && !searching && !error && (
                    <div className="empty-state">
                        <div className="empty-state-icon">🤖</div>
                        <div className="empty-state-title">Describe what you need</div>
                        <p>AI will extract food type, quantity, and location — then find the nearest matches.</p>
                    </div>
                )}

                {/* Empty results */}
                {results !== null && results.length === 0 && !searching && (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-title">No matching donations found</div>
                        <p>Try adjusting your search — different area, fewer quantity, or different food type.</p>
                    </div>
                )}

                {/* Results */}
                {results !== null && results.length > 0 && !searching && (
                    <>
                        {/* Map View */}
                        {view === 'map' && (
                            <div style={{ marginBottom: '24px' }}>
                                <MapView donations={results} onClaim={handleClaim} />
                            </div>
                        )}

                        {/* List View */}
                        {view === 'list' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {results.map((d, i) => (
                                    <div key={d._id} className="donation-card fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                        <div className="donation-card-top">
                                            {d.imageUrl && (
                                                <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${d.imageUrl}`} alt={d.foodName} className="donation-card-img" />
                                            )}
                                            <div className="donation-card-content">
                                                <div className="donation-card-title">{d.foodName}</div>
                                                <div className="donation-card-meta">{d.description}</div>
                                                {d.donor?.name && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        By: {d.donor.name}
                                                        {d.donor.phone ? ` · 📞 ${d.donor.phone}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="donation-card-badges">
                                                <span className="badge badge-available">🟢 Available</span>
                                                <span className={`badge ${d.foodType === 'veg' ? 'badge-veg' : 'badge-nonveg'}`}>
                                                    {d.foodType === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="donation-card-footer">
                                            <div className="donation-card-details">
                                                <div className="donation-detail">👥 <strong>{d.servings}</strong> servings</div>
                                                <div className="donation-detail">📍 {d.address?.slice(0, 35)}{d.address?.length > 35 ? '...' : ''}</div>
                                                <div className="donation-detail">🕐 ~{d.etaMinutes} min ETA</div>
                                                {d.pickupTimeWindow && <div className="donation-detail">🕐 {d.pickupTimeWindow}</div>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <div className="donation-distance">📡 {d.distanceKm} km</div>
                                                <button className={`btn btn-primary btn-sm ${claiming === d._id ? 'btn-loading' : ''}`} onClick={() => handleClaim(d._id, d.foodName)} disabled={claiming !== null}>{claiming !== d._id && '✅ Claim'}</button>
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReportModal({ donationId: d._id, foodName: d.foodName })}>Report</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* My claims */}
                {myClaims.length > 0 && (
                    <div style={{ marginTop: 32 }}>
                        <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>My Claims</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {myClaims.map((c) => (
                                <div key={c._id} className="donation-card">
                                    <div className="donation-card-top">
                                        <div className="donation-card-content">
                                            <div className="donation-card-title">{c.foodName}</div>
                                            <div className="donation-card-meta">{c.servings} servings · {c.address?.slice(0, 40)}...</div>
                                        </div>
                                        <span className="badge badge-claimed">{c.deliveryStatus === 'waiting_for_delivery' ? '⏳ Waiting delivery' : c.deliveryStatus === 'delivered' ? '✅ Delivered' : '🚚 In transit'}</span>
                                    </div>
                                    {c.deliveryStatus === 'waiting_for_delivery' && (
                                        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => handleRelease(c._id, c.foodName)} disabled={releasing !== null}>{releasing === c._id ? '...' : 'Release claim'}</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {reportModal && (
                <div className="modal-overlay" onClick={() => setReportModal(null)}>
                    <div className="card card-body" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: 8 }}>Report donation</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>{reportModal.foodName}</p>
                        <textarea className="form-input" rows={3} placeholder="Reason for report" value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleReportSubmit} disabled={!reportReason.trim()}>Submit</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setReportModal(null); setReportReason(''); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    );
};

export default NgoDashboard;
