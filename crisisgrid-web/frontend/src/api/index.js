import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5000/api',
});

// Auto-attach JWT token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('ff_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auth
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const googleLogin = (idToken, role) => API.post('/auth/google', { idToken, role });
export const getMe = () => API.get('/auth/me');

// Donations
export const createDonation = (data) => API.post('/donations', data);
export const updateDonation = (id, data) => API.patch(`/donations/${id}`, data);
export const deleteDonation = (id) => API.delete(`/donations/${id}`);
export const getMyDonations = () => API.get('/donations/my');
export const getMyClaims = () => API.get('/donations/claims');
export const searchDonations = (params) => API.get('/donations/search', { params });
export const claimDonation = (id) => API.patch(`/donations/${id}/claim`);
export const releaseClaim = (id) => API.patch(`/donations/${id}/release`);
export const extendExpiry = (id) => API.patch(`/donations/${id}/extend`);
export const getStats = () => API.get('/donations/stats');
export const getMapData = () => API.get('/donations/map-data');
export const getMyAnalytics = () => API.get('/donations/analytics/me');
export const updateMissionLocation = (missionId, lat, lng) => API.patch(`/donations/missions/${missionId}/location`, { lat, lng });

// Missions / Logistics
export const getAvailableMissions = () => API.get('/donations/missions/available');
export const acceptMission = (id) => API.patch(`/donations/missions/${id}/accept`);
export const updateMissionStatus = (id, status) => API.patch(`/donations/missions/${id}/status`, { status });
export const getDeliveryHistory = () => API.get('/donations/missions/history');
export const getActiveMission = () => API.get('/donations/missions/active');

// AI
export const parseQuery = (query) => API.post('/ai/parse', { query });
export const geocodeHint = (q) => API.get('/ai/geocode', { params: { q } });

// Notifications
export const getNotifications = () => API.get('/notifications');
export const markNotificationRead = (id) => API.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.patch('/notifications/read-all');

// Ratings
export const submitRating = (data) => API.post('/ratings', data);
export const getRatingsForUser = (userId) => API.get(`/ratings/user/${userId}`);

// Reports
export const createReport = (data) => API.post('/reports', data);
export const getReports = () => API.get('/reports');
export const updateReportStatus = (id, status) => API.patch(`/reports/${id}`, { status });

// Saved searches (NGO)
export const getSavedSearches = () => API.get('/saved-searches');
export const createSavedSearch = (data) => API.post('/saved-searches', data);
export const deleteSavedSearch = (id) => API.delete(`/saved-searches/${id}`);

// Admin
export const getAdminStats = () => API.get('/admin/stats');
export const getAdminUsers = () => API.get('/admin/users');

export default API;
