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
  target_username?: string;
}

interface Organizer {
  id: number;
  username: string;
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

export default function WalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"balance" | "request" | "my-requests" | "history">("balance");
  
  // Wallet state
  const [balance, setBalance] = useState<number>(0);
  
  // Request deposit
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedOrganizer, setSelectedOrganizer] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestPaymentRef, setRequestPaymentRef] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  // My requests
  const [myRequests, setMyRequests] = useState<DepositRequest[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  
  // Transaction history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Message
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check authorization
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.push("/login");
        } else {
          setLoading(false);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const res = await secureFetch("/api/wallet/balance");
      const data = await res.json();
      if (data.success) {
        setBalance(data.data.balance);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  }, []);

  // Fetch organizers
  const fetchOrganizers = useCallback(async () => {
    try {
      const res = await secureFetch("/api/wallet/organizers");
      const data = await res.json();
      if (data.success) {
        setOrganizers(data.data.organizers);
      }
    } catch (error) {
      console.error("Failed to fetch organizers:", error);
    }
  }, []);

  // Fetch my requests
  const fetchMyRequests = useCallback(async () => {
    setMyRequestsLoading(true);
    try {
      const res = await secureFetch("/api/wallet/my-requests");
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

  useEffect(() => {
    if (!loading) {
      fetchBalance();
      fetchOrganizers();
      fetchTransactions();
    }
  }, [loading, fetchBalance, fetchOrganizers, fetchTransactions]);

  useEffect(() => {
    if (activeTab === "my-requests" && !loading) {
      fetchMyRequests();
    }
  }, [activeTab, loading, fetchMyRequests]);

  // Submit deposit request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrganizer || !requestAmount) return;
    
    setSubmittingRequest(true);
    setMessage(null);
    
    try {
      const res = await secureFetch("/api/wallet/request-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: selectedOrganizer,
          amount: parseFloat(requestAmount),
          note: requestNote || undefined,
          paymentReference: requestPaymentRef || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setSelectedOrganizer("");
        setRequestAmount("");
        setRequestNote("");
        setRequestPaymentRef("");
        fetchMyRequests();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to submit request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Cancel request
  const handleCancelRequest = async (requestId: number) => {
    try {
      const res = await secureFetch("/api/wallet/my-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: "success", text: "Request cancelled" });
        fetchMyRequests();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to cancel request" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to cancel request" });
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

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "owner_deposit": return "Owner Deposit";
      case "organizer_deposit": return "Organizer Deposit";
      case "entry_fee": return "Entry Fee";
      case "prize": return "Prize";
      case "refund": return "Refund";
      default: return type.replace(/_/g, " ");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">💰</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Wallet</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your virtual currency</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: "balance" as const, label: "💵 Balance" },
              { id: "request" as const, label: "📤 Request Deposit" },
              { id: "my-requests" as const, label: "📋 My Requests" },
              { id: "history" as const, label: "📜 History" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" 
              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" 
              : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
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
              <p className="text-blue-200 text-sm mt-4">
                Use this balance to pay tournament entry fees
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab("request")}
                className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-blue-500 transition"
              >
                <span className="text-2xl mb-2 block">📤</span>
                <h3 className="font-semibold text-gray-900 dark:text-white">Request Deposit</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Request funds from an organizer</p>
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-blue-500 transition"
              >
                <span className="text-2xl mb-2 block">📜</span>
                <h3 className="font-semibold text-gray-900 dark:text-white">Transaction History</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">View all your transactions</p>
              </button>
            </div>

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {transactions.slice(0, 5).map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {tx.description || getTransactionTypeLabel(tx.type)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${
                            tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}>
                            {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Request Deposit Tab */}
        {activeTab === "request" && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                📤 Request Deposit
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Submit a deposit request to an organizer. After you make a payment (UPI, bank transfer, etc.), 
                the organizer will approve your request and credit your wallet.
              </p>
              
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Organizer *
                  </label>
                  <select
                    value={selectedOrganizer}
                    onChange={(e) => setSelectedOrganizer(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose an organizer...</option>
                    {organizers.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">Min: ₹10 | Max: ₹100,000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={requestPaymentRef}
                    onChange={(e) => setRequestPaymentRef(e.target.value)}
                    placeholder="e.g., UPI Transaction ID"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Note (Optional)
                  </label>
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Additional information"
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRequest || !selectedOrganizer || !requestAmount}
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Deposit Requests</h2>
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
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-4xl mb-4 block">📋</span>
                <p className="text-gray-500 dark:text-gray-400">No requests yet</p>
                <button
                  onClick={() => setActiveTab("request")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create Request
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((req) => (
                  <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-gray-900 dark:text-white">₹{req.amount}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(req.status)}`}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          To: <span className="text-gray-700 dark:text-gray-300">{req.target_username}</span>
                        </p>
                        {req.requester_note && (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Note: {req.requester_note}</p>
                        )}
                        {req.responder_note && (
                          <p className={`text-sm ${req.status === "rejected" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            Response: {req.responder_note}
                          </p>
                        )}
                        <p className="text-gray-400 text-sm">{formatDate(req.created_at)}</p>
                      </div>
                      
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h2>

            {transactionsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-4xl mb-4 block">📜</span>
                <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Description</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {getTransactionTypeLabel(tx.type)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {tx.description}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
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
        )}
      </main>
    </div>
  );
}
