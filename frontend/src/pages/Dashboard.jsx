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
  const [currentStep, setCurrentStep] = useState(1); // 1: Description, 2: Files, 3: Analysis
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const startAnalysis = async () => {
    setSubmitting(true);
    setCurrentStep(3);
    setResult(null);

    // Simulate a loading bar progress for AI analysis feel
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 95) clearInterval(interval);
      setUploadProgress(Math.min(progress, 95));
    }, 400);

    try {
      const data = await submitClaim({
        user_id: user.id,
        accident_description: description,
        police_report_url: policeReportUrl,
        image_url: imageUrl,
      });
      
      clearInterval(interval);
      setUploadProgress(100);
      
      // Small delay to let user see 100%
      setTimeout(() => {
        setResult(data);
        setClaims([data, ...claims]);
        setSubmitting(false);
        // Reset form for next time but stay on result view
        setDescription('');
        setPoliceReportUrl('');
        setImageUrl('');
      }, 800);

    } catch (err) {
      clearInterval(interval);
      setSubmitting(false);
      setCurrentStep(2); // Go back to files if failed
      alert('Action failed: ' + (err.response?.data?.detail || err.message));
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
    <div className="page-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Navbar />
      
      <div className="dashboard" style={{ maxWidth: '850px', margin: '0 auto', padding: '40px 20px' }}>
        <header style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>Claims Submission</h2>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Submit incident details for automated damage assessment and processing.</p>
        </header>

        {/* --- Multi-Stage Form Card --- */}
        <div style={{ background: 'white', padding: '32px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: '20px', letterSpacing: '1px' }}>Incident Information</h3>
          {/* Step Indicator */}
          {!result && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
              {[1, 2, 3].map(step => (
                <div key={step} style={{ 
                  height: '4px', flex: 1, borderRadius: '2px', 
                  background: currentStep >= step ? '#2563eb' : '#e2e8f0',
                  transition: 'background 0.3s ease'
                }} />
              ))}
            </div>
          )}

          {/* STAGE 1: Description */}
          {currentStep === 1 && !result && (
            <div className="step-content">
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Step 1: Accident Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Provide a factual, detailed description of the accident (time, location and how it occurred)"
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', background: '#fcfcfc', marginBottom: '20px', outlineColor: '#2563eb' }}
              />
              <button 
                className="btn btn-primary" 
                disabled={!description.trim()}
                onClick={() => setCurrentStep(2)}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '700' }}
              >
                Continue to Evidence →
              </button>
            </div>
          )}

          {/* STAGE 2: Evidence Upload */}
          {currentStep === 2 && !result && (
            <div className="step-content">
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Step 2: Supporting Evidence</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <FileUpload label="Police Report (PDF)" accept=".pdf" bucketPath="police-reports" onUploadComplete={setPoliceReportUrl} />
                <FileUpload label="Damage Photos" accept="image/*" bucketPath="accident-images" onUploadComplete={setImageUrl} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-outline" onClick={() => setCurrentStep(1)} style={{ flex: 1 }}>Back</button>
                <button 
                  className="btn btn-primary" 
                  disabled={!policeReportUrl || !imageUrl}
                  onClick={startAnalysis}
                  style={{ flex: 2, padding: '16px', borderRadius: '12px', fontWeight: '700' }}
                >
                  Analyze Claim Now
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Analysis Loading */}
          {currentStep === 3 && submitting && !result && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <h3 style={{ fontWeight: '800', marginBottom: '8px' }}>AI Underwriting in Progress</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Cross-referencing police records and verifying visual damage...</p>
              
              {/* Progress Bar */}
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }}>{Math.round(uploadProgress)}% Complete</span>
            </div>
          )}

          {/* RESULT VIEW */}
          {result && !result.error && (
            <div style={{ 
              padding: '24px', 
              borderRadius: '16px', 
              background: '#0f172a', 
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#38bdf8', marginBottom: '4px' }}>AI Underwriting Complete</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>Reference: #{result.claim_id?.slice(0,8)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>ESTIMATED PAYOUT</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#22c55e' }}>RM {result.estimated_amount?.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#38bdf8' }}>AI REASONING</span>
                <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '8px' }}>{result.reasoning || "Analyzing data patterns..."}</p>
              </div>

              {isFlaggedForInterrogation && (
                <div style={{ marginTop: '24px', padding: '20px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                  <p style={{ marginBottom: '16px', fontWeight: '600', color: '#fbbf24' }}>⚠ AI requires clarification to resolve flags:</p>
                  {result.interrogation_questions.map((q, i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px', display: 'block' }}>{q}</label>
                      <textarea
                        value={answers[i] || ''}
                        onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                        rows={2}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '8px', padding: '12px' }}
                      />
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={handleInterrogate} disabled={interrogating} style={{ width: '100%' }}>
                    {interrogating ? 'Verifying Answers...' : 'Submit Clarifications'}
                  </button>
                </div>
              )}
              
              <button className="btn btn-outline" onClick={() => {setResult(null); setCurrentStep(1)}} style={{ marginTop: '20px', width: '100%', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                File Another Claim
              </button>
            </div>
          )}
        </div>

        {/* --- History Section --- */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' }}>Your Claim History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Syncing...</div>
            ) : claims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
                No claim records found.
              </div>
            ) : (
              claims.map((c) => <ClaimCard key={c.claim_id} claim={c} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}