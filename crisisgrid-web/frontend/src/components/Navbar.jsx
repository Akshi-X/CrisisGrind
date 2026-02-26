import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/index';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotif, setShowNotif] = useState(false);
    const notifRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        getNotifications()
            .then((res) => {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        const close = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const handleMarkRead = (id) => {
        markNotificationRead(id).then(() => {
            setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
            setUnreadCount((c) => Math.max(0, c - 1));
        }).catch(() => {});
    };
    const handleMarkAllRead = () => {
        markAllNotificationsRead().then(() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        }).catch(() => {});
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link to="/" className="navbar-logo">
                    <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/logo.webp`} alt="" className="navbar-logo-img" />
                    <span className="navbar-logo-text"><span>Crisis</span><span>Grid</span></span>
                </Link>
                <div className="navbar-actions">
                    {user ? (
                        <>
                            <div ref={notifRef} style={{ position: 'relative' }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNotif((s) => !s)} style={{ position: 'relative' }}>
                                    🔔 {unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--orange)', color: '#fff', borderRadius: 10, fontSize: 10, minWidth: 16, textAlign: 'center' }}>{unreadCount}</span>}
                                </button>
                                {showNotif && (
                                    <div className="navbar-notif-dropdown">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <strong>Notifications</strong>
                                            {unreadCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>Mark all read</button>}
                                        </div>
                                        {notifications.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notifications</div> : (
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' }}>
                                                {notifications.slice(0, 20).map((n) => (
                                                    <li key={n._id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: n.read ? 0.85 : 1 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{n.title}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{n.message}</div>
                                                        {!n.read && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, padding: '2px 8px' }} onClick={() => handleMarkRead(n._id)}>Mark read</button>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="navbar-user">
                                <span className="navbar-user-name">{user.name?.split(' ')[0]}</span>
                                <span className={`navbar-user-role ${user.role === 'donor' ? 'role-donor' : user.role === 'ngo' ? 'role-ngo' : user.role === 'delivery' ? 'role-delivery' : ''}`}>
                                    {user.role}
                                </span>
                            </div>
                            {user.role === 'admin' && <Link to="/admin" className="btn btn-ghost btn-sm">Admin</Link>}
                            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/" className="btn btn-ghost btn-sm">Home</Link>
                            <Link to="/role" className="btn btn-primary btn-sm">Get Started</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
