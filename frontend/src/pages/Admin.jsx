import { useState, useEffect } from 'react';
import { getAdminStats, getFlaggedClaims, getApprovedClaims, adminAction } from '../api/claims';
import Navbar from '../components/Navbar';

const STATUS_COLORS = {
  approved: '#16a34a',
  rejected: '#dc2626',
  flagged: '#d97706',
  flagged_for_interrogation: '#9333ea',
  pending: '#6b7280',
};

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ClaimRow({ claim, onAction, actionLoading }) {
  const isFlagged = claim.status === 'flagged' || claim.status === 'flagged_for_interrogation';
  const isApproved = claim.status === 'approved';
  const displayStatus = claim.status === 'flagged_for_interrogation' ? 'AWAITING INTERROGATION' : claim.status.toUpperCase();

  return (
    <tr>
      <td>{claim.claim_id?.slice(0, 8)}</td>
      <td><strong>{claim.customer_name || 'Unknown'}</strong></td>
      <td>${claim.estimated_amount?.toLocaleString() || '—'}</td>
      <td>
        <span className="table-status" style={{ backgroundColor: STATUS_COLORS[claim.status] || STATUS_COLORS.pending }}>
          {displayStatus}
        </span>
      </td>
      <td className="table-reasoning" title={claim.reasoning || ''}>{claim.reasoning || '—'}</td>
      <td>
        {(isFlagged || isApproved) && (
          <div className="table-actions">
            <button
              className="btn btn-sm btn-approve"
              onClick={() => onAction(claim.claim_id, 'approve')}
              disabled={actionLoading[claim.claim_id]}
            >
              Approve
            </button>
            <button
              className="btn btn-sm btn-reject"
              onClick={() => onAction(claim.claim_id, 'reject')}
              disabled={actionLoading[claim.claim_id]}
            >
              Reject
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [flaggedClaims, setFlaggedClaims] = useState([]);
  const [approvedClaims, setApprovedClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState('flagged');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, flaggedData, approvedData] = await Promise.all([
        getAdminStats().catch(e => { console.error('Stats failed:', e); return null; }),
        getFlaggedClaims().catch(e => { console.error('Flagged failed:', e); return []; }),
        getApprovedClaims().catch(e => { console.error('Approved failed:', e); return []; }),
      ]);
      setStats(statsData);
      setFlaggedClaims(flaggedData);
      setApprovedClaims(approvedData);
    } catch (err) {
      setError('Failed to load admin data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (claimId, action) => {
    setActionLoading(prev => ({ ...prev, [claimId]: true }));
    try {
      await adminAction({ claim_id: claimId, action });
      await fetchAll();
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [claimId]: false }));
    }
  };

  const activeClaims = activeTab === 'flagged' ? flaggedClaims : approvedClaims;

  return (
    <div className="page-container">
      <Navbar />
      <div className="dashboard">
        <h2>Admin Dashboard</h2>
        <p className="subtitle">Overview of all claims and AI decisions. Override AI decisions when needed.</p>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {stats && (
              <div className="stats-grid">
                <StatCard label="Total Claims" value={stats.total_claims} color="#2563eb" />
                <StatCard label="AI Approved" value={stats.approved} color="#16a34a" />
                <StatCard label="Rejected" value={stats.rejected} color="#dc2626" />
                <StatCard label="Flagged" value={stats.flagged} color="#d97706" />
                <StatCard label="Awaiting Interrogation" value={stats.flagged_for_interrogation} color="#9333ea" />
                <StatCard label="Pending" value={stats.pending} color="#6b7280" />
              </div>
            )}

            <div className="admin-tabs">
              <button
                className={`tab-btn ${activeTab === 'flagged' ? 'active' : ''}`}
                onClick={() => setActiveTab('flagged')}
              >
                Flagged Claims ({flaggedClaims.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveTab('approved')}
              >
                AI Approved Claims ({approvedClaims.length})
              </button>
            </div>

            {activeClaims.length === 0 ? (
              <div className="empty-state">
                <h3>No {activeTab} claims</h3>
                <p>Nothing to review right now.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="claims-table">
                  <thead>
                    <tr>
                      <th>Claim ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>AI Reasoning</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClaims.map(c => (
                      <ClaimRow
                        key={c.claim_id}
                        claim={c}
                        onAction={handleAction}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
