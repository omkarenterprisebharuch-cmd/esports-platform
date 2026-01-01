"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { secureFetch } from "@/lib/api-client";

interface DepositRequest {
  id: number;
  requester_id: number;
  target_id: number;
  amount: number;
  request_type: string;
  status: string;
  requester_note: string | null;
  responder_note: string | null;
  payment_proof_url: string | null;
  payment_reference: string | null;
  created_at: string;
  requester_username: string;
  requester_email: string;
}

interface Organizer {
  id: number;
  username: string;
  email: string;
  wallet_balance: number;
}

interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  balance_after: number;
}

export default function OwnerDepositsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "deposit" | "history">("requests");
  
  // Requests state
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  // Direct deposit state
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedOrganizer, setSelectedOrganizer] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositDescription, setDepositDescription] = useState<string>("");
  const [depositing, setDepositing] = useState(false);
  
  // Transaction history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Modal state
  const [processingRequest, setProcessingRequest] = useState<DepositRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  
  // Message
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check authorization
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || data.data.role !== "owner") {
          router.push("/dashboard");
        } else {
          setLoading(false);
        }
      })
      .catch(() => router.push("/dashboard"));
  }, [router]);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      
      const res = await secureFetch(`/api/owner/deposit-requests?${params}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setRequestsLoading(false);
    }
  }, [statusFilter]);

  // Fetch organizers
  const fetchOrganizers = useCallback(async () => {
    try {
      const res = await secureFetch("/api/owner/users?role=organizer&limit=100");
      const data = await res.json();
      if (data.success) {
        setOrganizers(data.data.users.map((u: Organizer) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          wallet_balance: u.wallet_balance || 0,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch organizers:", error);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await secureFetch("/api/wallet/transactions?type=owner_deposit");
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchRequests();
      fetchOrganizers();
    }
  }, [loading, fetchRequests, fetchOrganizers]);

  useEffect(() => {
    if (activeTab === "history" && !loading) {
      fetchTransactions();
    }
  }, [activeTab, loading, fetchTransactions]);

  // Handle direct deposit
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrganizer || !depositAmount) return;
    
    setDepositing(true);
    setMessage(null);
    
    try {
      const res = await secureFetch("/api/owner/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer,
          amount: parseFloat(depositAmount),
          description: depositDescription || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setSelectedOrganizer("");
        setDepositAmount("");
        setDepositDescription("");
        fetchOrganizers(); // Refresh balances
        fetchTransactions();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to process deposit" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to process deposit" });
    } finally {
      setDepositing(false);
    }
  };

  // Handle approve request
  const handleApprove = async () => {
    if (!processingRequest) return;
    
    setApproving(true);
    try {
      const res = await secureFetch(`/api/owner/deposit-requests/${processingRequest.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setProcessingRequest(null);
        fetchRequests();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to approve request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to approve request" });
    } finally {
      setApproving(false);
    }
  };

  // Handle reject request
  const handleReject = async () => {
    if (!processingRequest || !rejectNote.trim()) return;
    
    setRejecting(true);
    try {
      const res = await secureFetch(`/api/owner/deposit-requests/${processingRequest.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: "Request rejected" });
        setProcessingRequest(null);
        setRejectNote("");
        fetchRequests();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to reject request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to reject request" });
    } finally {
      setRejecting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      case "approved":
        return "bg-green-500/20 text-green-400";
      case "rejected":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">💰</span>
            <div>
              <h1 className="text-xl font-bold text-white">Deposit Management</h1>
              <p className="text-sm text-gray-400">Manage organizer deposits</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/owner")}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            ← Back to Owner Portal
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: "requests" as const, label: "📥 Deposit Requests" },
              { id: "deposit" as const, label: "💸 Direct Deposit" },
              { id: "history" as const, label: "📜 Transaction History" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-purple-400 border-b-2 border-purple-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        {/* Deposit Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 items-center">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={fetchRequests}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Refresh
              </button>
            </div>

            {/* Requests List */}
            {requestsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <span className="text-4xl mb-4 block">📭</span>
                <p className="text-gray-400">No deposit requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-white">₹{request.amount}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {request.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-400">
                          From: <span className="text-white">{request.requester_username}</span>
                          <span className="text-gray-500 ml-2">({request.requester_email})</span>
                        </p>
                        {request.requester_note && (
                          <p className="text-gray-400 text-sm">
                            Note: <span className="text-gray-300">{request.requester_note}</span>
                          </p>
                        )}
                        {request.payment_reference && (
                          <p className="text-gray-400 text-sm">
                            Payment Ref: <span className="text-gray-300">{request.payment_reference}</span>
                          </p>
                        )}
                        <p className="text-gray-500 text-sm">{formatDate(request.created_at)}</p>
                      </div>
                      
                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setProcessingRequest(request)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            Review
                          </button>
                        </div>
                      )}
                      
                      {request.status === "rejected" && request.responder_note && (
                        <div className="text-right">
                          <p className="text-red-400 text-sm">Rejection reason:</p>
                          <p className="text-gray-300 text-sm">{request.responder_note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Direct Deposit Tab */}
        {activeTab === "deposit" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                💸 Direct Deposit to Organizer
              </h2>
              
              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Organizer
                  </label>
                  <select
                    value={selectedOrganizer}
                    onChange={(e) => setSelectedOrganizer(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Choose an organizer...</option>
                    {organizers.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.username} ({org.email}) - Balance: ₹{org.wallet_balance}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    step="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">Min: ₹10 | Max: ₹100,000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositDescription}
                    onChange={(e) => setDepositDescription(e.target.value)}
                    placeholder="e.g., Monthly prize pool funds"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depositing || !selectedOrganizer || !depositAmount}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {depositing ? "Processing..." : "Deposit Now"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Transaction History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">📜 Deposit History</h2>
            
            {transactionsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <span className="text-4xl mb-4 block">📜</span>
                <p className="text-gray-400">No transactions found</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Description</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">
                          {tx.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-400 font-medium">
                          +₹{Math.abs(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {processingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              Review Deposit Request
            </h3>
            
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">
                <span className="text-gray-400">From:</span> {processingRequest.requester_username}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-400">Amount:</span>{" "}
                <span className="text-xl font-bold text-green-400">₹{processingRequest.amount}</span>
              </p>
              {processingRequest.requester_note && (
                <p className="text-gray-300">
                  <span className="text-gray-400">Note:</span> {processingRequest.requester_note}
                </p>
              )}
              {processingRequest.payment_reference && (
                <p className="text-gray-300">
                  <span className="text-gray-400">Payment Ref:</span> {processingRequest.payment_reference}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {approving ? "Approving..." : "✓ Approve & Credit Wallet"}
              </button>
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason for rejection (required)"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleReject}
                  disabled={approving || rejecting || !rejectNote.trim()}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {rejecting ? "Rejecting..." : "✗ Reject Request"}
                </button>
              </div>
              
              <button
                onClick={() => {
                  setProcessingRequest(null);
                  setRejectNote("");
                }}
                className="w-full py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
