import { useState, useEffect } from 'react';
import { createDonation, updateDonation, deleteDonation, getMyDonations, extendExpiry, getMyAnalytics } from '../api/index';
import { useAuth } from '../context/AuthContext';

const DonorDashboard = () => {
    const { user } = useAuth();
    const [donations, setDonations] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ foodName: '', description: '', foodType: 'veg', servings: '', address: '', pickupTimeWindow: '', expiryHours: '24' });

    const [form, setForm] = useState({
        foodName: '', description: '', foodType: 'veg', servings: '', address: '', pickupTimeWindow: '', expiryHours: '24',
    });
    const [formError, setFormError] = useState('');

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        getMyDonations()
            .then((res) => setDonations(res.data))
            .catch(() => { })
            .finally(() => setLoadingList(false));
        getMyAnalytics().then((res) => setAnalytics(res.data)).catch(() => {});
    }, []);

    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const startEdit = (d) => {
        setEditingId(d._id);
        const expiryMs = d.expiryTime ? new Date(d.expiryTime).getTime() - Date.now() : 24 * 60 * 60 * 1000;
        const hours = Math.round(expiryMs / (60 * 60 * 1000)) || 24;
        const expiryHours = [1, 3, 6, 12, 24, 48].includes(hours) ? String(hours) : '24';
        setEditForm({ foodName: d.foodName, description: d.description, foodType: d.foodType, servings: String(d.servings), address: d.address, pickupTimeWindow: d.pickupTimeWindow || '', expiryHours });
    };
    const handleEditChange = (e) => setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingId) return;
        setSubmitting(true);
        try {
            const formData = new FormData();
            Object.keys(editForm).forEach((k) => formData.append(k, editForm[k]));
            const res = await updateDonation(editingId, formData);
            setDonations((prev) => prev.map((x) => (x._id === editingId ? res.data : x)));
            setEditingId(null);
            showToast('Donation updated');
        } catch (err) {
            showToast(err.response?.data?.message || 'Update failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };
    const handleDelete = async (id) => {
        if (!window.confirm('Remove this donation?')) return;
        try {
            await deleteDonation(id);
            setDonations((prev) => prev.filter((x) => x._id !== id));
            getMyAnalytics().then((r) => setAnalytics(r.data)).catch(() => {});
            showToast('Donation removed');
        } catch (err) {
            showToast(err.response?.data?.message || 'Delete failed', 'error');
        }
    };
    const handleExtend = async (id) => {
        try {
            const res = await extendExpiry(id);
            setDonations((prev) => prev.map((x) => (x._id === id ? res.data : x)));
            showToast('Expiry extended by 1 hour');
        } catch (err) {
            showToast(err.response?.data?.message || 'Extend failed', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.foodName || !form.description || !form.servings || !form.address) {
            setFormError('Please fill all required fields');
            return;
        }
        setSubmitting(true);
        setFormError('');
        try {
            const formData = new FormData();
            Object.keys(form).forEach(key => formData.append(key, form[key]));
            if (image) formData.append('image', image);

            const res = await createDonation(formData);
            setDonations((prev) => [res.data, ...prev]);
            setForm({ foodName: '', description: '', foodType: 'veg', servings: '', address: '', pickupTimeWindow: '', expiryHours: '24' });
            setImage(null);
            setImagePreview(null);
            setShowForm(false);
            getMyAnalytics().then((r) => setAnalytics(r.data)).catch(() => {});
            showToast('🎉 Donation listed successfully!');
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to submit. Check your address.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="dashboard">
                {/* Header */}
                <div className="dashboard-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h1 className="dashboard-title">👋 Hello, {user?.name?.split(' ')[0]}!</h1>
                            <p className="dashboard-subtitle">Manage your food donations here</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
                            {showForm ? '✕ Cancel' : '+ Add Donation'}
                        </button>
                    </div>
                </div>

                {/* Add Donation Form */}
                {showForm && (
                    <div className="card card-body fade-in" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>🍱 New Food Donation</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="dashboard-grid">
                                <div className="form-group">
                                    <label className="form-label">Food Name *</label>
                                    <input className="form-input" name="foodName" placeholder="e.g., Biryani, Sambar Rice"
                                        value={form.foodName} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Number of Servings *</label>
                                    <input className="form-input" name="servings" type="number" min="1" placeholder="e.g., 50"
                                        value={form.servings} onChange={handleChange} required />
                                </div>
                                <div className="form-group dashboard-full">
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-input" name="description" rows="2"
                                        placeholder="Describe the food, ingredients, packaging..."
                                        value={form.description} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Food Type *</label>
                                    <div className="form-radio-group">
                                        <div
                                            className={`form-radio-card ${form.foodType === 'veg' ? 'active-veg' : ''}`}
                                            onClick={() => setForm((p) => ({ ...p, foodType: 'veg' }))}
                                        >
                                            🥗 Vegetarian
                                        </div>
                                        <div
                                            className={`form-radio-card ${form.foodType === 'non-veg' ? 'active-nonveg' : ''}`}
                                            onClick={() => setForm((p) => ({ ...p, foodType: 'non-veg' }))}
                                        >
                                            🍗 Non-Veg
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pickup Address *</label>
                                    <textarea className="form-input" name="address" rows="2"
                                        placeholder="Full address including area, city, state"
                                        value={form.address} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pickup time window</label>
                                    <input className="form-input" name="pickupTimeWindow"
                                        placeholder="e.g. 2:00 PM - 4:00 PM"
                                        value={form.pickupTimeWindow} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Expires in</label>
                                    <select className="form-input" name="expiryHours" value={form.expiryHours} onChange={handleChange}>
                                        <option value="1">1 hour</option>
                                        <option value="3">3 hours</option>
                                        <option value="6">6 hours</option>
                                        <option value="12">12 hours</option>
                                        <option value="24">24 hours</option>
                                        <option value="48">48 hours</option>
                                    </select>
                                </div>
                                <div className="form-group dashboard-full">
                                    <label className="form-label">Food Photo</label>
                                    <div className="image-upload-wrap">
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="food-image" />
                                        <label htmlFor="food-image" className="image-upload-btn">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Preview" className="image-preview" />
                                            ) : (
                                                <div className="image-upload-placeholder">
                                                    📸 Click to upload photo
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {formError && <div className="form-error" style={{ marginBottom: '16px' }}>⚠️ {formError}</div>}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                                    {!submitting && '🚀 Submit Donation'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Impact analytics */}
                {analytics && (
                    <div className="card card-body" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '24px' }}>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Listed</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{analytics.listed}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Claimed</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{analytics.claimed}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Meals rescued</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{analytics.mealsRescued || 0}</div></div>
                    </div>
                )}

                {/* Donations list */}
                <div>
                    <div className="results-header">
                        <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>My Donations</h2>
                        <span className="results-count"><strong>{donations.length}</strong> total</span>
                    </div>

                    {loadingList ? (
                        <div className="spinner-wrap"><div className="spinner" /></div>
                    ) : donations.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🍽️</div>
                            <div className="empty-state-title">No donations yet</div>
                            <p>Click "Add Donation" to list your first food donation!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {donations.map((d) => (
                                <div key={d._id} className="donation-card fade-in">
                                    {editingId === d._id ? (
                                        <form onSubmit={handleEditSubmit} style={{ padding: '12px 0' }}>
                                            <div className="dashboard-grid" style={{ marginBottom: 12 }}>
                                                <div className="form-group"><label className="form-label">Food Name</label><input className="form-input" name="foodName" value={editForm.foodName} onChange={handleEditChange} /></div>
                                                <div className="form-group"><label className="form-label">Servings</label><input className="form-input" name="servings" type="number" min="1" value={editForm.servings} onChange={handleEditChange} /></div>
                                                <div className="form-group dashboard-full"><label className="form-label">Description</label><textarea className="form-input" name="description" rows="2" value={editForm.description} onChange={handleEditChange} /></div>
                                                <div className="form-group dashboard-full"><label className="form-label">Address</label><textarea className="form-input" name="address" rows="2" value={editForm.address} onChange={handleEditChange} /></div>
                                                <div className="form-group"><label className="form-label">Pickup time</label><input className="form-input" name="pickupTimeWindow" value={editForm.pickupTimeWindow} onChange={handleEditChange} placeholder="e.g. 2-4 PM" /></div>
                                                <div className="form-group"><label className="form-label">Expires in</label><select className="form-input" name="expiryHours" value={editForm.expiryHours} onChange={handleEditChange}><option value="1">1h</option><option value="3">3h</option><option value="6">6h</option><option value="12">12h</option><option value="24">24h</option><option value="48">48h</option></select></div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>Save</button>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="donation-card-top">
                                                {d.imageUrl && (
                                                    <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${d.imageUrl}`} alt={d.foodName} className="donation-card-img" />
                                                )}
                                                <div className="donation-card-content">
                                                    <div className="donation-card-title">{d.foodName}</div>
                                                    <div className="donation-card-meta">{d.description}</div>
                                                </div>
                                                <div className="donation-card-badges">
                                                    <span className={`badge ${d.status === 'available' ? 'badge-available' : 'badge-claimed'}`}>{d.status === 'available' ? '🟢 Available' : '🟠 Claimed'}</span>
                                                    <span className={`badge ${d.foodType === 'veg' ? 'badge-veg' : 'badge-nonveg'}`}>{d.foodType === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}</span>
                                                </div>
                                            </div>
                                            <div className="donation-card-footer">
                                                <div className="donation-card-details">
                                                    <div className="donation-detail">👥 <strong>{d.servings}</strong> servings</div>
                                                    <div className="donation-detail">📍 {d.address?.slice(0, 40)}{d.address?.length > 40 ? '...' : ''}</div>
                                                    {d.pickupTimeWindow && <div className="donation-detail">🕐 {d.pickupTimeWindow}</div>}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString()} · Expires {new Date(d.expiryTime).toLocaleDateString()}</div>
                                            </div>
                                            {d.status === 'available' && (
                                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(d)}>Edit</button>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(d._id)}>Remove</button>
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleExtend(d._id)}>Extend 1h</button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
            )}
        </div>
    );
};

export default DonorDashboard;
