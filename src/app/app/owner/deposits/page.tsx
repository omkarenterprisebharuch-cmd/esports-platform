"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { TabNav } from "@/components/app/TabNav";
import { FormField, FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { Modal } from "@/components/app/Modal";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/Badges";

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
  const [activeTab, setActiveTab] = useState("requests");
  
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
          router.push("/app");
        } else {
          setLoading(false);
        }
      })
      .catch(() => router.push("/app"));
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
        fetchOrganizers();
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

  const getStatusVariant = (status: string): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case "pending": return "warning";
      case "approved": return "success";
      case "rejected": return "error";
      default: return "default";
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading deposit management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Deposit Management"
        subtitle="Manage organizer deposits and requests"
        backLink={{ href: "/app/owner", label: "Back to Owner Portal" }}
      />

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "requests", label: "📥 Deposit Requests" },
          { id: "deposit", label: "💸 Direct Deposit" },
          { id: "history", label: "📜 Transaction History" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${
          message.type === "success" 
            ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800" 
            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
        }`}>
          {message.text}
        </div>
      )}

      {/* Deposit Requests Tab */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <FormSelect
              label=""
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Status" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
            <button
              onClick={fetchRequests}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Requests List */}
          {requestsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No deposit requests found"
              description="Deposit requests from organizers will appear here."
            />
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">₹{request.amount}</span>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">
                        From: <span className="text-gray-900 dark:text-white font-medium">{request.requester_username}</span>
                        <span className="text-gray-500 ml-2">({request.requester_email})</span>
                      </p>
                      {request.requester_note && (
                        <p className="text-gray-500 text-sm">
                          Note: <span className="text-gray-700 dark:text-gray-300">{request.requester_note}</span>
                        </p>
                      )}
                      {request.payment_reference && (
                        <p className="text-gray-500 text-sm">
                          Payment Ref: <span className="text-gray-700 dark:text-gray-300">{request.payment_reference}</span>
                        </p>
                      )}
                      <p className="text-gray-400 text-sm">{formatDate(request.created_at)}</p>
                    </div>
                    
                    {request.status === "pending" && (
                      <button
                        onClick={() => setProcessingRequest(request)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    )}
                    
                    {request.status === "rejected" && request.responder_note && (
                      <div className="text-right">
                        <p className="text-red-500 text-sm font-medium">Rejection reason:</p>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">{request.responder_note}</p>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              💸 Direct Deposit to Organizer
            </h2>
            
            <form onSubmit={handleDeposit} className="space-y-4">
              <FormSelect
                label="Select Organizer"
                value={selectedOrganizer}
                onChange={(e) => setSelectedOrganizer(e.target.value)}
                options={[
                  { value: "", label: "Choose an organizer..." },
                  ...organizers.map((org) => ({
                    value: String(org.id),
                    label: `${org.username} (${org.email}) - Balance: ₹${org.wallet_balance}`,
                  })),
                ]}
              />
              
              <FormField
                label="Amount (₹)"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount (minimum 1)"
              />
              
              <FormTextArea
                label="Description (Optional)"
                value={depositDescription}
                onChange={(e) => setDepositDescription(e.target.value)}
                placeholder="Reason for deposit..."
                rows={3}
              />
              
              <button
                type="submit"
                disabled={depositing || !selectedOrganizer || !depositAmount}
                className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {depositing ? "Processing..." : "Deposit Funds"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Tab */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {transactionsLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="📜"
                title="No transactions yet"
                description="Deposit transactions will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm font-mono">#{tx.id}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm max-w-xs truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-medium">+₹{tx.amount}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">₹{tx.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Request Modal */}
      <Modal
        isOpen={!!processingRequest}
        onClose={() => {
          setProcessingRequest(null);
          setRejectNote("");
        }}
        title="Review Deposit Request"
      >
        {processingRequest && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="text-gray-900 dark:text-white font-bold text-xl">₹{processingRequest.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">From:</span>
                <span className="text-gray-900 dark:text-white">{processingRequest.requester_username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="text-gray-600 dark:text-gray-300">{processingRequest.requester_email}</span>
              </div>
              {processingRequest.requester_note && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 block mb-1">Note:</span>
                  <span className="text-gray-700 dark:text-gray-300">{processingRequest.requester_note}</span>
                </div>
              )}
              {processingRequest.payment_reference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Ref:</span>
                  <span className="text-gray-600 dark:text-gray-300">{processingRequest.payment_reference}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {approving ? "Approving..." : "✅ Approve"}
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <FormTextArea
                label="Rejection Reason"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain why you're rejecting this request..."
                rows={3}
              />
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectNote.trim()}
                className="w-full mt-3 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejecting ? "Rejecting..." : "❌ Reject Request"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
