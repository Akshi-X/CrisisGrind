import { useNavigate } from 'react-router-dom';

const RolePage = () => {
    const navigate = useNavigate();

    return (
        <div className="role-page page-wrapper">
            <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="hero-eyebrow">Choose Your Role</div>
                <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '12px' }}>
                    Who are you?
                </h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                    Join the CrisisGrid network — whether you have surplus food or need it.
                </p>
                <div className="role-cards">
                    <div className="role-card" onClick={() => navigate('/auth/donor')}>
                        <div className="role-icon">🍱</div>
                        <div className="role-name">Donor</div>
                        <p className="role-desc">
                            Restaurant, caterer, or individual with surplus food to share
                        </p>
                        <span className="role-card-badge role-card-badge-donor">Start Saving Food</span>
                    </div>
                    <div className="role-card" onClick={() => navigate('/auth/ngo')}>
                        <div className="role-icon">🏥</div>
                        <div className="role-name">NGO</div>
                        <p className="role-desc">
                            Organization that distributes food to people in need
                        </p>
                        <span className="role-card-badge role-card-badge-ngo">Find Food Now</span>
                    </div>
                    <div className="role-card" onClick={() => navigate('/auth/delivery')}>
                        <div className="role-icon">🚚</div>
                        <div className="role-name">Delivery Partner</div>
                        <p className="role-desc">
                            Help transport food from donors to NGOs
                        </p>
                        <span className="role-card-badge role-card-badge-delivery">Deliver & Serve</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RolePage;
