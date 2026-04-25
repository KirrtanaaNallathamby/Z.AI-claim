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

export default function Admin() {
  const [stats, setStats] = useState({ total_claims: 0, approved: 0, rejected: 0, flagged: 0, flagged_for_interrogation: 0, pending: 0 });
  const [allClaims, setAllClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [activeTab, setActiveTab] = useState('flagged');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsData, flaggedRes, approvedRes] = await Promise.all([
        getAdminStats().catch(() => null),
        getFlaggedClaims().catch(() => []),
        getApprovedClaims().catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      const flaggedArray = Array.isArray(flaggedRes) ? flaggedRes : (flaggedRes.data || []);
      const approvedArray = Array.isArray(approvedRes) ? approvedRes : (approvedRes.data || []);
      setAllClaims([...flaggedArray, ...approvedArray]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (claimId, action) => {
    setActionLoading(prev => ({ ...prev, [claimId]: true }));
    try {
      await adminAction({ claim_id: claimId, action });
      setSelectedClaim(null);
      await fetchAll();
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [claimId]: false }));
    }
  };

  const handleDownload = (claim) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(claim, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `claim_${claim.claim_id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const totalRmsaved = stats.approved * 30; // RM15/hr * 2 hrs

  const filteredClaims = allClaims.filter(c => {
    if (activeTab === 'flagged') return c.status === 'flagged';
    if (activeTab === 'approved') return c.status === 'approved';
    if (activeTab === 'rejected') return c.status === 'rejected';
    if (activeTab === 'interrogation') return c.status === 'flagged_for_interrogation';
    if (activeTab === 'pending') return c.status === 'pending';
    return true;
  });

  return (
    <div className="page-container">
      <Navbar />
      <div className="dashboard" style={{ maxWidth: '1250px' }}>
        <header style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Admin Command Center</h2>
          <p className="subtitle">Overview of AI underwriting and management portal.</p>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '40px' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #2563eb', background: '#f8fafc' }}>
            <div className="stat-value" style={{ color: '#2563eb' }}>RM {totalRmsaved}</div>
            <div className="stat-label">TOTAL COST SAVED</div>
          </div>

          {[
            { id: 'flagged', label: 'FLAGGED', val: stats.flagged, color: STATUS_COLORS.flagged },
            { id: 'approved', label: 'AI APPROVED', val: stats.approved, color: STATUS_COLORS.approved },
            { id: 'rejected', label: 'REJECTED', val: stats.rejected, color: STATUS_COLORS.rejected },
            { id: 'interrogation', label: 'IN INTERROGATION', val: stats.flagged_for_interrogation, color: STATUS_COLORS.flagged_for_interrogation },
            { id: 'pending', label: 'PENDING', val: stats.pending, color: STATUS_COLORS.pending }
          ].map((box) => (
            <div 
              key={box.id}
              className={`stat-card ${activeTab === box.id ? 'active-card' : ''}`}
              onClick={() => setActiveTab(box.id)}
              style={{ cursor: 'pointer', borderLeft: `4px solid ${box.color}` }}
            >
              <div className="stat-value" style={{ color: box.color }}>{box.val}</div>
              <div className="stat-label">{box.label}</div>
            </div>
          ))}
        </div>

        <div className="table-container">
          <table className="claims-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Estimate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map(c => (
                <tr key={c.claim_id} onClick={() => setSelectedClaim(c)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>#{c.claim_id?.slice(0, 8)}</td>
                  <td>{c.customer_name}</td>
                  <td>${c.estimated_amount?.toLocaleString()}</td>
                  <td>
                    <span className="table-status" style={{ background: STATUS_COLORS[c.status] }}>
                      {c.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td><button className="btn btn-outline btn-sm">Review Now →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Detailed Side Panel --- */}
      {selectedClaim && (
        <>
          <div onClick={() => setSelectedClaim(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: '580px', height: '100vh',
            background: 'white', zIndex: 1000, padding: '40px', overflowY: 'auto',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>CASE ID: {selectedClaim.claim_id}</span>
              <button onClick={() => setSelectedClaim(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '5px' }}>Reference #{selectedClaim.claim_id?.slice(0, 8)}</h2>
            <p style={{ color: '#64748b', marginBottom: '25px' }}>Claimant: {selectedClaim.customer_name} ({selectedClaim.user_id})</p>

            {/* Evidence & Details Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <section>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Incident Description</label>
                <div style={{ marginTop: '5px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
                  {selectedClaim.accident_description || "No description provided."}
                </div>
              </section>

              {selectedClaim.police_report_url && (
                <section>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Police Documentation (PDF)</label>
                  <a href={selectedClaim.police_report_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: 'block', marginTop: '5px', textAlign: 'center', textDecoration: 'none' }}>
                    View Official Police Report
                  </a>
                </section>
              )}

              {selectedClaim.image_url && (
                <section>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Visual Evidence (Image)</label>
                  <img src={selectedClaim.image_url} alt="Evidence" style={{ width: '100%', borderRadius: '8px', marginTop: '8px', border: '1px solid #e2e8f0' }} />
                </section>
              )}

              <section>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>AI Reasoning Log</label>
                <div style={{ marginTop: '5px', padding: '15px', background: '#0f172a', color: '#f1f5f9', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                  "{selectedClaim.reasoning || "AI decision log is currently unavailable."}"
                </div>
              </section>
            </div>

            {/* Action Bar */}
            <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-approve" style={{ flex: 1, padding: '14px' }} onClick={() => handleAction(selectedClaim.claim_id, 'approve')}>Final Approve</button>
                <button className="btn btn-reject" style={{ flex: 1, padding: '14px' }} onClick={() => handleAction(selectedClaim.claim_id, 'reject')}>Final Reject</button>
              </div>
              <button className="btn btn-outline" onClick={() => handleDownload(selectedClaim)}>Download Full Audit Evidence (JSON)</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}