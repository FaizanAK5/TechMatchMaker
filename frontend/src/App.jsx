import React, { useState, useEffect } from 'react';
import { Search, Lightbulb, CheckCircle, FileText, Users, Zap, ArrowRight, Database, Brain, Settings, AlertCircle, XCircle, Shield } from 'lucide-react';
import AdminPanel from './AdminPanel';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8001' 
  : `http://${window.location.hostname}:8001`;

export default function NZTCInnovationApp() {
  const [activeScreen, setActiveScreen] = useState('landing');
  const [challengeDescription, setChallengeDescription] = useState('');
  const [formData, setFormData] = useState({
    industry_sector: '',
    emissions_baseline: '',
    target_reduction: '',
    timeline_months: '',
    budget_range: '',
    constraints: []
  });
  const [solutions, setSolutions] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [databaseStatus, setDatabaseStatus] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);


  // Check system health on mount
  useEffect(() => {
    checkSystemHealth();
    checkDatabaseStatus();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      const data = await response.json();
      setSystemStatus(data);
    } catch (err) {
      console.error('Health check failed:', err);
      setSystemStatus({ status: 'error', ollama: 'disconnected' });
    }
  };

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/database-status`);
      const data = await response.json();
      setDatabaseStatus(data);
    } catch (err) {
      console.error('Database status check failed:', err);
      setDatabaseStatus({ loaded: false, message: 'Failed to check database status' });
    }
  };

  const handleConstraintToggle = (constraint) => {
    setFormData(prev => ({
      ...prev,
      constraints: prev.constraints.includes(constraint)
        ? prev.constraints.filter(c => c !== constraint)
        : [...prev.constraints, constraint]
    }));
  };

  const generateSolutions = async () => {
    setLoading(true);
    setError(null);

    const requestData = {
      challenge_description: challengeDescription,
      industry_sector: formData.industry_sector || null,
      emissions_baseline: formData.emissions_baseline ? parseFloat(formData.emissions_baseline) : null,
      target_reduction: formData.target_reduction ? parseFloat(formData.target_reduction) : null,
      timeline_months: formData.timeline_months ? parseInt(formData.timeline_months) : null,
      budget_range: formData.budget_range || null,
      constraints: formData.constraints
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-solutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate solutions');
      }

      const data = await response.json();
      setSolutions(data);
      setSubmissionId(data.submission_id);
      setActiveScreen('results');
    } catch (err) {
      setError(`Failed to generate solutions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // check submission status
const checkSubmissionStatus = async (subId) => {
  if (!subId) return;
  console.log('🔍 Checking status for submission:', subId); // ⭐ Add this
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/submissions/${subId}`);
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Submission data:', data); // ⭐ Add this
      console.log('✅ Status:', data.status); // ⭐ Add this
      setSubmissionStatus(data.status);
    }
  } catch (err) {
    console.error('Failed to check status:', err);
  }
};

// In the useEffect, add logs:
useEffect(() => {
  console.log('🔄 useEffect triggered - submissionId:', submissionId, 'activeScreen:', activeScreen, 'showAdmin:', showAdmin); // ⭐ Add this
  
  if (submissionId && activeScreen === 'results') {
    checkSubmissionStatus(submissionId);
  }
}, [submissionId, activeScreen, showAdmin]);

  // Show admin panel if active
  if (showAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">NZTC Innovation Co-Pilot</h1>
              <p className="text-sm text-slate-600">AI-Powered Solution Synthesis</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition hover:bg-slate-100 rounded-lg"
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
            {systemStatus && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemStatus.ollama === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-slate-600">LLM: {systemStatus.ollama}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemStatus.database_loaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-slate-600">DB: {systemStatus.technologies_count || 0} techs</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Database Not Loaded Warning */}
        {databaseStatus && !databaseStatus.loaded && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-2">Database Not Available</h3>
                <p className="text-sm text-red-800 mb-2">
                  The technology database is not loaded. Please contact your system administrator.
                </p>
                {databaseStatus.message && (
                  <p className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded">
                    {databaseStatus.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Database Loaded Status */}
        {databaseStatus && databaseStatus.loaded && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Database className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm text-green-800">
                <span className="font-semibold">{databaseStatus.technology_count} technologies</span> loaded
                {databaseStatus.last_updated && (
                  <span className="text-green-700"> • Last updated: {new Date(databaseStatus.last_updated).toLocaleString()}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Pills */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveScreen('landing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeScreen === 'landing' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. Challenge Input
          </button>
          <button
            onClick={() => activeScreen !== 'landing' && setActiveScreen('intake')}
            disabled={!challengeDescription}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeScreen === 'intake' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50'
            }`}
          >
            2. Details & Context
          </button>
          <button
            onClick={() => activeScreen === 'results' && setActiveScreen('results')}
            disabled={!solutions}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeScreen === 'results' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50'
            }`}
          >
            3. AI-Generated Solutions
          </button>
        </div>

        {/* Landing Screen */}
        {activeScreen === 'landing' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Lightbulb className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Describe Your Net Zero Challenge</h2>
                <p className="text-lg text-slate-600">
                  Our AI will analyze your challenge and synthesize innovative solutions by combining technologies from our database
                </p>
              </div>

              <div className="max-w-2xl mx-auto mt-8">
                <textarea
                  value={challengeDescription}
                  onChange={(e) => setChallengeDescription(e.target.value)}
                  placeholder="Example: We need to reduce methane emissions from our offshore platform operations by 60% within 24 months, but existing point solutions don't address our unique operational constraints..."
                  className="w-full h-40 px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none text-slate-700"
                />
                <button
                  onClick={() => setActiveScreen('intake')}
                  disabled={!challengeDescription || !databaseStatus?.loaded}
                  className="mt-4 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue to Details
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* How It Works */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <Database className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Technology Database</h3>
                <p className="text-slate-600 text-sm">Semantic search through your catalogued technologies with ChromaDB embeddings</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <Brain className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Local LLM Synthesis</h3>
                <p className="text-slate-600 text-sm">Llama 3.1 running on your RTX 3090 combines technologies innovatively</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <Users className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Expert Validation</h3>
                <p className="text-slate-600 text-sm">SME review ensures technical feasibility and commercial viability</p>
              </div>
            </div>
          </div>
        )}

        {/* Intake Form Screen */}
        {activeScreen === 'intake' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Additional Context</h2>
            
            <div className="space-y-6 max-w-3xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry Sector</label>
                <select 
                  value={formData.industry_sector}
                  onChange={(e) => setFormData({...formData, industry_sector: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Oil & Gas - Offshore">Oil & Gas - Offshore</option>
                  <option value="Oil & Gas - Onshore">Oil & Gas - Onshore</option>
                  <option value="Renewable Energy">Renewable Energy</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Emissions Baseline (tCO2e/year)</label>
                <input 
                  type="number" 
                  value={formData.emissions_baseline}
                  onChange={(e) => setFormData({...formData, emissions_baseline: e.target.value})}
                  placeholder="e.g., 50000" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Reduction (%)</label>
                <input 
                  type="number" 
                  value={formData.target_reduction}
                  onChange={(e) => setFormData({...formData, target_reduction: e.target.value})}
                  placeholder="e.g., 60" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Timeline (months)</label>
                <input 
                  type="number" 
                  value={formData.timeline_months}
                  onChange={(e) => setFormData({...formData, timeline_months: e.target.value})}
                  placeholder="e.g., 24" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Budget Range</label>
                <select 
                  value={formData.budget_range}
                  onChange={(e) => setFormData({...formData, budget_range: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Under £500k">Under £500k</option>
                  <option value="£500k - £2M">£500k - £2M</option>
                  <option value="£2M - £10M">£2M - £10M</option>
                  <option value="£10M+">£10M+</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Key Constraints (select all that apply)</label>
                <div className="space-y-2">
                  {['Hazardous environment (ATEX/IECEx)', 'Remote location / limited connectivity', 'Existing infrastructure constraints', 'Regulatory compliance requirements'].map(constraint => (
                    <label key={constraint} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={formData.constraints.includes(constraint)}
                        onChange={() => handleConstraintToggle(constraint)}
                        className="w-4 h-4 text-blue-600" 
                      />
                      <span className="text-sm text-slate-700">{constraint}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setActiveScreen('landing')}
                  className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={generateSolutions}
                  disabled={loading || !databaseStatus?.loaded}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <Zap className="w-5 h-5" />
                  {loading ? 'Generating Solutions...' : 'Generate Solutions with AI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && activeScreen !== 'results' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mb-4"></div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Your Challenge</h3>
            <p className="text-slate-600">AI is searching technologies and synthesizing solutions...</p>
            <p className="text-sm text-slate-500 mt-2">This may take 30-60 seconds</p>
          </div>
        )}

        {/* Results Screen */}
        {activeScreen === 'results' && solutions && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
  <div className="flex items-start justify-between">
    <div>
      <h2 className="text-2xl font-bold mb-2">{solutions.solutions.length} Solution Concepts Generated</h2>
      <p className="text-blue-100">
        Analyzed {solutions.technologies_analyzed} technologies in {solutions.processing_time.toFixed(1)}s
      </p>
    </div>
    <div className={`backdrop-blur rounded-lg px-4 py-2 ${
      submissionStatus === 'approved' ? 'bg-green-500/30' :
      submissionStatus === 'rejected' ? 'bg-red-500/30' :
      'bg-white/20'
    }`}>
      <p className="text-sm font-medium flex items-center gap-2">
        {submissionStatus === 'approved' && (
          <>
            <CheckCircle className="w-4 h-4" />
            Status: Approved by SME
          </>
        )}
        {submissionStatus === 'rejected' && (
          <>
            <XCircle className="w-4 h-4" />
            Status: Revision Requested
          </>
        )}
        {submissionStatus === 'pending' && (
          <>
            <AlertCircle className="w-4 h-4" />
            Status: Pending Expert Review
          </>
        )}
        {!submissionStatus && 'Status: Pending Expert Review'}
      </p>
    </div>
  </div>
</div>

            {solutions.solutions.map((solution, idx) => (
              <div key={solution.solution_id} className={`bg-white rounded-xl shadow-sm border-2 p-6 ${idx === 0 ? 'border-blue-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${idx === 0 ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <span className={`font-bold ${idx === 0 ? 'text-blue-600' : 'text-slate-600'}`}>{solution.solution_id}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{solution.title}</h3>
                      {idx === 0 && <p className="text-sm text-blue-600 font-medium mt-1">Recommended Solution</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      solution.feasibility === 'High' ? 'bg-green-100 text-green-700' : 
                      solution.feasibility === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {solution.feasibility} Feasibility
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {solution.timeline_estimate}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Technology Combination:</h4>
                    <div className="grid md:grid-cols-3 gap-3">
                      {solution.technologies.map((tech) => (
                        <div key={tech.tech_id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-sm font-medium text-slate-900">{tech.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{tech.provider}</p>
                          <p className="text-xs text-slate-500 mt-1">TRL {tech.trl} • {tech.category}</p>
                          <p className="text-xs text-blue-600 mt-2 italic">{tech.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Overview:</h4>
                    <p className="text-slate-700 text-sm leading-relaxed">{solution.description}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">How It Works:</h4>
                    <p className="text-slate-700 text-sm leading-relaxed">{solution.how_it_works}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2 text-sm">Key Benefits:</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {solution.benefits.map((benefit, i) => (
                          <li key={i}>• {benefit}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2 text-sm">Integration Considerations:</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {solution.integration_considerations.map((consideration, i) => (
                          <li key={i}>• {consideration}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">Estimated Cost Range:</span> {solution.estimated_cost_range}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm">
                      Request Detailed Feasibility Study
                    </button>
                    <button 
                      onClick={() => setShowAdmin(true)}
                      className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition text-sm"
                    >
                      Schedule SME Review
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Next Steps</h4>
                  <p className="text-sm text-slate-700 mb-3">
                    Our SME team will review these AI-generated concepts within 48 hours. You'll receive a validation report with feasibility scores and recommended next actions.
                  </p>
                  <button 
                    onClick={() => {
                      setActiveScreen('landing');
                      setChallengeDescription('');
                      setSolutions(null);
                      setSubmissionId(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    ← Start New Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
