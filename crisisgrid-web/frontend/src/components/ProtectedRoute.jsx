import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="spinner-wrap" style={{ minHeight: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!user) return <Navigate to="/auth/donor" replace />;
    if (role && user.role !== role) {
        const to = user.role === 'donor' ? '/donor' : user.role === 'ngo' ? '/ngo' : user.role === 'delivery' ? '/delivery' : user.role === 'admin' ? '/admin' : '/';
        return <Navigate to={to} replace />;
    }

    return children;
};

export default ProtectedRoute;
