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
    <nav className="navbar">
      <div className="navbar-brand">Insurance AI</div>
      <div className="navbar-links">
        {user.role === 'admin' ? (
          <Link to="/admin">Admin Dashboard</Link>
        ) : (
          <Link to="/dashboard">Dashboard</Link>
        )}
        <span className="navbar-user">{user.full_name || user.email}</span>
        <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
