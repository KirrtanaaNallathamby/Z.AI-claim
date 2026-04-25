import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <nav className="navbar" style={{ height: '70px', padding: '0 40px' }}>
      <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ letterSpacing: '-0.5px', fontSize: '18px', textTransform: 'uppercase' }}>
          Insurance <strong>AI</strong>
        </span>
      </div>
      
      <div className="navbar-links" style={{ gap: '24px' }}>
        {user.role === 'admin' ? (
          <Link to="/admin" style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em' }}>ADMIN PORTAL</Link>
        ) : (
          <Link to="/dashboard" style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em' }}>MY CLAIMS</Link>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '1px solid var(--gray-200)', paddingLeft: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase' }}>User Session</div>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>{user.full_name || user.email}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{ borderRadius: '4px', fontWeight: '600' }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}