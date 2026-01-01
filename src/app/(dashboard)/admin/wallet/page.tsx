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
  requester_username?: string;
  requester_email?: string;
  target_username?: string;
}

interface User {
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
  from_username?: string;
}

export default function OrganizerWalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"balance" | "request" | "user-requests" | "deposit" | "my-requests">("balance");
  
  // Wallet state
  const [balance, setBalance] = useState<number>(0);
  const [pendingIncoming, setPendingIncoming] = useState<number>(0);
  const [pendingOutgoing, setPendingOutgoing] = useState<number>(0);
  
  // Request deposit from owner
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestPaymentRef, setRequestPaymentRef] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  // My requests to owner
  const [myRequests, setMyRequests] = useState<DepositRequest[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  
  // User deposit requests
  const [userRequests, setUserRequests] = useState<DepositRequest[]>([]);
  const [userRequestsLoading, setUserRequestsLoading] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState("pending");
  
  // Direct deposit to user
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDescription, setDepositDescription] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  
  // Transaction history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Modal
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
        if (!data.success || (data.data.role !== "organizer" && data.data.role !== "owner")) {
          router.push("/dashboard");
        } else {
          setLoading(false);
        }
      })
      .catch(() => router.push("/dashboard"));
  }, [router]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const res = await secureFetch("/api/wallet/balance");
      const data = await res.json();
      if (data.success) {
        setBalance(data.data.balance);
        setPendingIncoming(data.data.pendingRequests?.incoming || 0);
        setPendingOutgoing(data.data.pendingRequests?.outgoing || 0);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  }, []);

  // Fetch my requests
  const fetchMyRequests = useCallback(async () => {
    setMyRequestsLoading(true);
    try {
      const res = await secureFetch("/api/organizer/my-requests");
      const data = await res.json();
      if (data.success) {
        setMyRequests(data.data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch my requests:", error);
    } finally {
      setMyRequestsLoading(false);
    }
  }, []);

  // Fetch user requests
  const fetchUserRequests = useCallback(async () => {
    setUserRequestsLoading(true);
    try {
      const params = new URLSearchParams();
      if (userStatusFilter) params.set("status", userStatusFilter);
      
      const res = await secureFetch(`/api/organizer/deposit-requests?${params}`);
      const data = await res.json();
      if (data.success) {
        setUserRequests(data.data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch user requests:", error);
    } finally {
      setUserRequestsLoading(false);
    }
  }, [userStatusFilter]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await secureFetch("/api/wallet/transactions");
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

  // Search users
  const searchUsers = useCallback(async () => {
    if (!userSearch.trim()) {
      setUsers([]);
      return;
    }
    
    setSearchingUsers(true);
    try {
      const params = new URLSearchParams({ search: userSearch, limit: "10" });
      const res = await secureFetch(`/api/owner/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error("Failed to search users:", error);
    } finally {
      setSearchingUsers(false);
    }
  }, [userSearch]);

  useEffect(() => {
    if (!loading) {
      fetchBalance();
      fetchTransactions();
    }
  }, [loading, fetchBalance, fetchTransactions]);

  useEffect(() => {
    if (activeTab === "my-requests" && !loading) {
      fetchMyRequests();
    }
  }, [activeTab, loading, fetchMyRequests]);

  useEffect(() => {
    if (activeTab === "user-requests" && !loading) {
      fetchUserRequests();
    }
  }, [activeTab, loading, fetchUserRequests, userStatusFilter]);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearch.trim()) {
        searchUsers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  // Submit deposit request to owner
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestAmount) return;
    
    setSubmittingRequest(true);
    setMessage(null);
    
    try {
      const res = await secureFetch("/api/organizer/request-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(requestAmount),
          note: requestNote || undefined,
          paymentReference: requestPaymentRef || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setRequestAmount("");
        setRequestNote("");
        setRequestPaymentRef("");
        fetchMyRequests();
        fetchBalance();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to submit request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Direct deposit to user
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !depositAmount) return;
    
    setDepositing(true);
    setMessage(null);
    
    try {
      const res = await secureFetch("/api/organizer/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          amount: parseFloat(depositAmount),
          description: depositDescription || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setSelectedUser("");
        setDepositAmount("");
        setDepositDescription("");
        setUserSearch("");
        setUsers([]);
        fetchBalance();
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

  // Approve user request
  const handleApprove = async () => {
    if (!processingRequest) return;
    
    setApproving(true);
    try {
      const res = await secureFetch(`/api/organizer/deposit-requests/${processingRequest.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setProcessingRequest(null);
        fetchUserRequests();
        fetchBalance();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to approve request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to approve request" });
    } finally {
      setApproving(false);
    }
  };

  // Reject user request
  const handleReject = async () => {
    if (!processingRequest || !rejectNote.trim()) return;
    
    setRejecting(true);
    try {
      const res = await secureFetch(`/api/organizer/deposit-requests/${processingRequest.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: "Request rejected" });
        setProcessingRequest(null);
        setRejectNote("");
        fetchUserRequests();
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
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "approved": return "bg-green-500/20 text-green-400";
      case "rejected": return "bg-red-500/20 text-red-400";
      case "cancelled": return "bg-gray-500/20 text-gray-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
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
              <h1 className="text-xl font-bold text-white">Wallet Management</h1>
              <p className="text-sm text-gray-400">Manage deposits and transactions</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            ← Back to Admin Panel
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { id: "balance" as const, label: "💵 Balance" },
              { id: "request" as const, label: "📤 Request Deposit" },
              { id: "my-requests" as const, label: "📋 My Requests" },
              { id: "user-requests" as const, label: `📥 User Requests ${pendingIncoming > 0 ? `(${pendingIncoming})` : ""}` },
              { id: "deposit" as const, label: "💸 Deposit to User" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "text-blue-400 border-b-2 border-blue-400"
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
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        {/* Balance Tab */}
        {activeTab === "balance" && (
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white">
              <p className="text-blue-200 mb-2">Current Balance</p>
              <p className="text-4xl font-bold">₹{balance.toLocaleString()}</p>
              <div className="flex gap-6 mt-4 text-sm">
                <div>
                  <span className="text-blue-200">Pending Outgoing:</span>{" "}
                  <span className="font-medium">{pendingOutgoing}</span>
                </div>
                <div>
                  <span className="text-blue-200">Pending Incoming:</span>{" "}
                  <span className="font-medium">{pendingIncoming}</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
              {transactionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 bg-gray-800 rounded-xl border border-gray-700">
                  <p className="text-gray-400">No transactions yet</p>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {transactions.slice(0, 10).map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-4 py-3 text-sm text-gray-400">{formatDate(tx.created_at)}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{tx.type.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-sm text-white">{tx.description}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${
                            tx.amount > 0 ? "text-green-400" : "text-red-400"
                          }`}>
                            {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Request Deposit Tab */}
        {activeTab === "request" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                📤 Request Deposit from Owner
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Submit a deposit request to the platform owner. Once approved, the amount will be credited to your wallet.
              </p>
              
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    required
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">Min: ₹10 | Max: ₹100,000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={requestPaymentRef}
                    onChange={(e) => setRequestPaymentRef(e.target.value)}
                    placeholder="e.g., UPI Transaction ID"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Note (Optional)
                  </label>
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Additional information for the owner"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRequest || !requestAmount}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submittingRequest ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* My Requests Tab */}
        {activeTab === "my-requests" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">My Deposit Requests</h2>
              <button
                onClick={fetchMyRequests}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Refresh
              </button>
            </div>

            {myRequestsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <span className="text-4xl mb-4 block">📋</span>
                <p className="text-gray-400">No requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((req) => (
                  <div key={req.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-white">₹{req.amount}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(req.status)}`}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        {req.requester_note && (
                          <p className="text-gray-400 text-sm">Note: {req.requester_note}</p>
                        )}
                        {req.responder_note && (
                          <p className={`text-sm ${req.status === "rejected" ? "text-red-400" : "text-green-400"}`}>
                            Response: {req.responder_note}
                          </p>
                        )}
                        <p className="text-gray-500 text-sm">{formatDate(req.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Requests Tab */}
        {activeTab === "user-requests" && (
          <div className="space-y-6">
            <div className="flex gap-4 items-center">
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={fetchUserRequests}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Refresh
              </button>
            </div>

            {userRequestsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : userRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <span className="text-4xl mb-4 block">📭</span>
                <p className="text-gray-400">No user deposit requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userRequests.map((req) => (
                  <div key={req.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-white">₹{req.amount}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(req.status)}`}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-400">
                          From: <span className="text-white">{req.requester_username}</span>
                          <span className="text-gray-500 ml-2">({req.requester_email})</span>
                        </p>
                        {req.requester_note && (
                          <p className="text-gray-400 text-sm">Note: {req.requester_note}</p>
                        )}
                        {req.payment_reference && (
                          <p className="text-gray-400 text-sm">Payment Ref: {req.payment_reference}</p>
                        )}
                        <p className="text-gray-500 text-sm">{formatDate(req.created_at)}</p>
                      </div>
                      
                      {req.status === "pending" && (
                        <button
                          onClick={() => setProcessingRequest(req)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deposit to User Tab */}
        {activeTab === "deposit" && (
          <div className="max-w-xl mx-auto">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                💸 Direct Deposit to User
              </h2>
              
              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Search User
                  </label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by username or email"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {searchingUsers && (
                    <p className="text-gray-400 text-sm mt-2">Searching...</p>
                  )}
                  
                  {users.length > 0 && (
                    <div className="mt-2 bg-gray-700 rounded-lg border border-gray-600 max-h-48 overflow-y-auto">
                      {users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(String(u.id));
                            setUserSearch(u.username);
                            setUsers([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-600 text-white"
                        >
                          {u.username} <span className="text-gray-400">({u.email})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedUser && (
                  <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400 text-sm">
                    Selected: {userSearch}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositDescription}
                    onChange={(e) => setDepositDescription(e.target.value)}
                    placeholder="e.g., Tournament prize"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depositing || !selectedUser || !depositAmount}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {depositing ? "Processing..." : "Deposit Now"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Review Modal */}
      {processingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Review Deposit Request</h3>
            
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
