import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitClaim, interrogateClaim, getUserClaims } from '../api/claims';
import FileUpload from '../components/FileUpload';
import ClaimCard from '../components/ClaimCard';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Interrogation state
  const [interrogating, setInterrogating] = useState(false);
  const [answers, setAnswers] = useState({});

  const [description, setDescription] = useState('');
  const [policeReportUrl, setPoliceReportUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const data = await getUserClaims(user.id);
      setClaims(data);
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const data = await submitClaim({
        user_id: user.id,
        accident_description: description,
        police_report_url: policeReportUrl,
        image_url: imageUrl,
      });
      setResult(data);
      setClaims([data, ...claims]);
      setDescription('');
      setPoliceReportUrl('');
      setImageUrl('');
    } catch (err) {
      setResult({ error: err.response?.data?.detail || 'Claim submission failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInterrogate = async () => {
    if (!result?.claim_id) return;
    setInterrogating(true);

    try {
      const answersText = result.interrogation_questions
        .map((q, i) => `Q: ${q}\nA: ${answers[i] || ''}`)
        .join('\n\n');

      const data = await interrogateClaim({
        claim_id: result.claim_id,
        answers: answersText,
      });
      setResult(data);
      setClaims(claims.map(c => c.claim_id === data.claim_id ? data : c));
    } catch (err) {
      alert('Interrogation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setInterrogating(false);
    }
  };

  const isFlaggedForInterrogation = result?.status === 'flagged_for_interrogation' && result?.interrogation_questions?.length > 0;

  return (
    <div className="page-container">
      <Navbar />
      <div className="dashboard">
        <h2>Submit a Claim</h2>
        <p className="subtitle">The AI Adjuster will review your evidence, estimate the damage cost, and make a decision.</p>

        <form className="claim-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Accident Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Describe what happened in detail..."
            />
          </div>

          <FileUpload
            label="Police Report (PDF)"
            accept=".pdf"
            bucketPath="police-reports"
            onUploadComplete={setPoliceReportUrl}
          />

          <FileUpload
            label="Accident Image"
            accept="image/*"
            bucketPath="accident-images"
            onUploadComplete={setImageUrl}
          />

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'AI is analyzing your claim...' : 'Submit Claim'}
          </button>
        </form>

        {submitting && (
          <div className="processing">
            <div className="spinner"></div>
            <p>AI Adjuster is reviewing your claim. This may take 10-30 seconds...</p>
          </div>
        )}

        {result && !result.error && (
          <div className={`result-card result-${result.status === 'flagged_for_interrogation' ? 'flagged' : result.status}`}>
            <h3>Decision: {result.status.replace(/_/g, ' ').toUpperCase()}</h3>
            <p><strong>Claim ID:</strong> {result.claim_id?.slice(0, 8)}</p>
            <p><strong>Estimated Amount:</strong> ${result.estimated_amount?.toLocaleString()}</p>
            {result.reasoning && (
              <p><strong>AI Reasoning:</strong> {result.reasoning}</p>
            )}
            {result.ai_decision_log && (
              <details>
                <summary>View Detailed AI Log</summary>
                <pre className="ai-log">{result.ai_decision_log}</pre>
              </details>
            )}
          </div>
        )}

        {isFlaggedForInterrogation && (
          <div className="interrogation-panel">
            <h3>AI Adjuster has questions for you</h3>
            <p className="subtitle">Answer these questions to help the AI make a final decision on your claim.</p>

            {result.interrogation_questions.map((q, i) => (
              <div key={i} className="form-group">
                <label>Q{i + 1}: {q}</label>
                <textarea
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  rows={2}
                  placeholder="Type your answer..."
                />
              </div>
            ))}

            <button
              className="btn btn-primary"
              onClick={handleInterrogate}
              disabled={interrogating}
            >
              {interrogating ? 'AI is reviewing your answers...' : 'Submit Answers'}
            </button>
          </div>
        )}

        {result?.error && (
          <div className="error-msg">{result.error}</div>
        )}

        <div className="claims-section">
          <h2>Your Claims</h2>
          {loading ? (
            <p>Loading claims...</p>
          ) : claims.length === 0 ? (
            <p>No claims submitted yet.</p>
          ) : (
            <div className="claims-list">
              {claims.map((c) => (
                <ClaimCard key={c.claim_id} claim={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
