import { useState } from 'react';

const STATUS_COLORS = {
  approved: '#16a34a',
  rejected: '#dc2626',
  flagged: '#d97706',
  flagged_for_interrogation: '#d97706',
  pending: '#6b7280',
};

const STATUS_LABELS = {
  flagged_for_interrogation: 'AWAITING INTERROGATION',
};

export default function ClaimCard({ claim }) {
  const [expanded, setExpanded] = useState(false);
  const displayStatus = STATUS_LABELS[claim.status] || claim.status.toUpperCase();

  return (
    <div className="claim-card" style={{ border: '1px solid var(--gray-200)', boxShadow: 'none' }}>
      <div className="claim-header" style={{ background: 'var(--gray-50)' }}>
        <span className="claim-id" style={{ fontFamily: 'monospace', color: 'var(--gray-500)' }}>
          REF_ID: {claim.claim_id?.slice(0, 8).toUpperCase()}
        </span>
        <span className="claim-status" style={{ backgroundColor: STATUS_COLORS[claim.status] || STATUS_COLORS.pending, borderRadius: '4px' }}>
          {displayStatus}
        </span>
      </div>
      <div className="claim-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Assessment Value</label>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>RM {claim.estimated_amount?.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Evidence</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {claim.police_report_url && <a href={claim.police_report_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: '600' }}>DOC</a>}
                {claim.image_url && <a href={claim.image_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: '600' }}>IMG</a>}
            </div>
          </div>
        </div>
        
        <p style={{ color: 'var(--gray-700)', lineHeight: '1.6' }}>{claim.accident_description}</p>
        
        {claim.reasoning && (
          <div style={{ marginTop: '15px', padding: '12px', background: 'var(--gray-50)', borderRadius: '4px', borderLeft: '3px solid var(--gray-300)' }}>
            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: 'var(--gray-900)' }}>SYSTEM REASONING:</strong>
            <span style={{ fontSize: '13px', color: 'var(--gray-700)' }}>{claim.reasoning}</span>
          </div>
        )}
      </div>
    </div>
  );
}
