import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ArrowLeft, Eye, ThumbsUp, ThumbsDown, FileText, AlertCircle } from 'lucide-react';


const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8001' 
  : `http://${window.location.hostname}:8001`;

export default function AdminPanel({ onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/submissions`);
      const data = await response.json();
      setSubmissions(data.submissions.sort((a, b) => 
        new Date(b.submitted_at) - new Date(a.submitted_at)
      ));
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  const handleReview = async (submissionId, action) => {
  setLoading(true);
  console.log('🔍 Reviewing submission:', submissionId, 'Action:', action); // ⭐ Add this
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/submissions/${submissionId}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback })
      }
    );

    console.log('📡 Review response:', response.status); // ⭐ Add this
    const result = await response.json(); // ⭐ Add this
    console.log('📦 Review result:', result); // ⭐ Add this

    if (response.ok) {
      // Reload submissions to update stats
      await loadSubmissions();
      console.log('✅ Submissions reloaded'); // ⭐ Add this
      
      setSelectedSubmission(null);
      setFeedback('');
      
      alert(`Solution ${action === 'approve' ? 'approved' : 'revision requested'} successfully!`);
    }
  } catch (err) {
    console.error('❌ Review failed:', err);
    alert('Failed to submit review. Please try again.');
  } finally {
    setLoading(false);
  }
};



  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  if (selectedSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setSelectedSubmission(null)}
            className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Solution Review</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Submitted {new Date(selectedSubmission.submitted_at).toLocaleString()}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${getStatusColor(selectedSubmission.status)}`}>
                {getStatusIcon(selectedSubmission.status)}
                {selectedSubmission.status.toUpperCase()}
              </span>
            </div>

            {/* Challenge Details */}
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Challenge</h3>
              <p className="text-slate-700 text-sm">{selectedSubmission.challenge.challenge_description}</p>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-slate-600">Industry:</span>
                  <span className="ml-2 font-medium">{selectedSubmission.challenge.industry_sector || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-600">Timeline:</span>
                  <span className="ml-2 font-medium">{selectedSubmission.challenge.timeline_months || 'N/A'} months</span>
                </div>
                <div>
                  <span className="text-slate-600">Budget:</span>
                  <span className="ml-2 font-medium">{selectedSubmission.challenge.budget_range || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-slate-900">Generated Solutions ({selectedSubmission.solutions.length})</h3>
              {selectedSubmission.solutions.map((solution) => (
                <div key={solution.solution_id} className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-bold text-slate-900 mb-2">{solution.title}</h4>
                  <p className="text-sm text-slate-700 mb-3">{solution.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">Technologies ({solution.technologies.length}):</span>
                      <ul className="mt-1 space-y-1">
                        {solution.technologies.map((tech) => (
                          <li key={tech.tech_id} className="text-slate-600">
                            • {tech.title} (TRL {tech.trl})
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Feasibility:</span>
                      <span className="ml-2 text-slate-600">{solution.feasibility}</span>
                      <br />
                      <span className="font-medium text-slate-700">Timeline:</span>
                      <span className="ml-2 text-slate-600">{solution.timeline_estimate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Review Actions (only if pending) */}
            {selectedSubmission.status === 'pending' && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-3">SME Review</h3>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback for the team..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none text-sm mb-4"
                  rows="3"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview(selectedSubmission.submission_id, 'approve')}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:bg-slate-300"
                  >
                    <ThumbsUp className="w-5 h-5" />
                    Approve Solutions
                  </button>
                  <button
                    onClick={() => handleReview(selectedSubmission.submission_id, 'reject')}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:bg-slate-300"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    Request Revision
                  </button>
                </div>
              </div>
            )}

            {/* Show feedback if already reviewed */}
            {selectedSubmission.status !== 'pending' && selectedSubmission.feedback && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-2">Review Feedback</h3>
                <p className="text-sm text-slate-700">{selectedSubmission.feedback}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Reviewed on {new Date(selectedSubmission.reviewed_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SME Review Dashboard</h1>
            <p className="text-slate-600 mt-1">Review and approve AI-generated solutions</p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Back to App
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Submissions</p>
            <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-yellow-800">Pending Review</p>
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-800">Approved</p>
            <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{stats.approved}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-red-800">Revisions Requested</p>
            <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900">{stats.rejected}</p>
        </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Submitted</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Challenge</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Solutions</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {submissions.map((submission) => (
                <tr key={submission.submission_id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {submission.challenge.challenge_description.substring(0, 80)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {submission.solutions.length} concepts
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 w-fit ${getStatusColor(submission.status)}`}>
                      {getStatusIcon(submission.status)}
                      {submission.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedSubmission(submission)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {submissions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No submissions yet. Generate some solutions to see them here!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
