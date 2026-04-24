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
    <div className="claim-card">
      <div className="claim-header">
        <span className="claim-id">Claim #{claim.claim_id?.slice(0, 8)}</span>
        <span className="claim-status" style={{ backgroundColor: STATUS_COLORS[claim.status] || STATUS_COLORS.pending }}>
          {displayStatus}
        </span>
      </div>
      <div className="claim-body">
        <p><strong>Estimated Amount:</strong> ${claim.estimated_amount?.toLocaleString()}</p>
        <p><strong>Description:</strong> {claim.accident_description}</p>
        {claim.reasoning && (
          <p><strong>AI Reasoning:</strong> {claim.reasoning}</p>
        )}
        {claim.police_report_url && (
          <p><strong>Police Report:</strong> <a href={claim.police_report_url} target="_blank" rel="noreferrer">View PDF</a></p>
        )}
        {claim.image_url && (
          <p><strong>Accident Image:</strong> <a href={claim.image_url} target="_blank" rel="noreferrer">View Image</a></p>
        )}
      </div>
      {claim.ai_decision_log && (
        <div className="claim-ai-section">
          <button className="btn btn-sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide' : 'Show'} AI Decision Log
          </button>
          {expanded && (
            <pre className="ai-log">{claim.ai_decision_log}</pre>
          )}
        </div>
      )}
    </div>
  );
}
