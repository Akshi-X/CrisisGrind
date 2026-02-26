import { useState, useEffect } from 'react';
import { createDonation, getMyDonations } from '../api/index';
import { useAuth } from '../context/AuthContext';

const DonorDashboard = () => {
    const { user } = useAuth();
    const [donations, setDonations] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [form, setForm] = useState({
        foodName: '', description: '', foodType: 'veg', servings: '', address: '',
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
    }, []);

    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
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
            setForm({ foodName: '', description: '', foodType: 'veg', servings: '', address: '' });
            setImage(null);
            setImagePreview(null);
            setShowForm(false);
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
                                    <div className="donation-card-top">
                                        {d.imageUrl && (
                                            <img
                                                src={`http://localhost:5000${d.imageUrl}`}
                                                alt={d.foodName}
                                                className="donation-card-img"
                                            />
                                        )}
                                        <div className="donation-card-content">
                                            <div className="donation-card-title">{d.foodName}</div>
                                            <div className="donation-card-meta">{d.description}</div>
                                        </div>
                                        <div className="donation-card-badges">
                                            <span className={`badge ${d.status === 'available' ? 'badge-available' : 'badge-claimed'}`}>
                                                {d.status === 'available' ? '🟢 Available' : '🟠 Claimed'}
                                            </span>
                                            <span className={`badge ${d.foodType === 'veg' ? 'badge-veg' : 'badge-nonveg'}`}>
                                                {d.foodType === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="donation-card-footer">
                                        <div className="donation-card-details">
                                            <div className="donation-detail">
                                                👥 <strong>{d.servings}</strong> servings
                                            </div>
                                            <div className="donation-detail">
                                                📍 {d.address?.slice(0, 40)}{d.address?.length > 40 ? '...' : ''}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {new Date(d.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
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
