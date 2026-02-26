import { useState, useEffect } from 'react';
import { getAdminStats, getAdminUsers, getReports, updateReportStatus } from '../api/index';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getAdminStats().then((r) => r.data),
            getAdminUsers().then((r) => r.data),
            getReports().then((r) => r.data).catch(() => []),
        ])
            .then(([s, u, rep]) => {
                setStats(s);
                setUsers(u);
                setReports(Array.isArray(rep) ? rep : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-wrapper">
                <div className="spinner-wrap" style={{ minHeight: '60vh' }}><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="dashboard">
                <div className="dashboard-header">
                    <h1 className="dashboard-title">🛡️ Admin Dashboard</h1>
                    <p className="dashboard-subtitle">Welcome, {user?.name}</p>
                </div>

                {stats && (
                    <div className="card card-body" style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Donors</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.users?.donor || 0}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>NGOs</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.users?.ngo || 0}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Delivery</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.users?.delivery || 0}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Available donations</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.donations?.available?.count ?? 0}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Claimed</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.donations?.claimed?.count ?? 0}</div></div>
                        <div><strong style={{ color: 'var(--text-muted)' }}>Pending reports</strong><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.pendingReports ?? 0}</div></div>
                    </div>
                )}

                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>Users</h2>
                <div className="card card-body" style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 12px' }}>{u.name}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                                    <td style={{ padding: '10px 12px' }}><span className={`navbar-user-role ${u.role === 'donor' ? 'role-donor' : u.role === 'ngo' ? 'role-ngo' : u.role === 'delivery' ? 'role-delivery' : ''}`} style={{ padding: '2px 8px', borderRadius: 6 }}>{u.role}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>Reports</h2>
                <div className="card card-body" style={{ overflowX: 'auto' }}>
                    {reports.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No reports</p> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Reason</th>
                                    <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                    <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r) => (
                                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '10px 12px' }}>{r.reason}</td>
                                        <td style={{ padding: '10px 12px' }}>{r.status}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {r.status === 'pending' && (
                                                <>
                                                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginRight: 6 }} onClick={() => updateReportStatus(r._id, 'reviewed').then(() => setReports((prev) => prev.map((x) => x._id === r._id ? { ...x, status: 'reviewed' } : x)))}>Reviewed</button>
                                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => updateReportStatus(r._id, 'resolved').then(() => setReports((prev) => prev.map((x) => x._id === r._id ? { ...x, status: 'resolved' } : x)))}>Resolved</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
