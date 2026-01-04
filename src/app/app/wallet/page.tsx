"use client";

import { useEffect, useState, useCallback } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { EmptyState } from "@/components/app/EmptyState";
import { DataTable } from "@/components/app/DataTable";
import { FormField, FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { Modal } from "@/components/app/Modal";
import { StatusBadge } from "@/components/app/Badges";

interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  balance_after: number;
}

interface DepositRequest {
  id: number;
  amount: number;
  status: string;
  requester_note: string | null;
  responder_note: string | null;
  payment_reference: string | null;
  created_at: string;
  target_username?: string;
}

interface Organizer {
  id: string;
  username: string;
}

/**
 * Wallet Page
 * 
 * Features:
 * - View balance
 * - Request deposits
 * - View deposit requests status
 * - Transaction history
 */
export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Deposit request
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    organizer_id: "",
    amount: "",
    note: "",
    payment_ref: "",
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  // My requests
  const [myRequests, setMyRequests] = useState<DepositRequest[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  
  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Message
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    } finally {
      setLoading(false);
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
    fetchBalance();
    fetchOrganizers();
  }, [fetchBalance, fetchOrganizers]);

  useEffect(() => {
    if (activeTab === "requests") {
      fetchMyRequests();
    } else if (activeTab === "history") {
      fetchTransactions();
    }
  }, [activeTab, fetchMyRequests, fetchTransactions]);

  // Handle deposit request
  const handleSubmitRequest = async () => {
    if (!requestForm.organizer_id || !requestForm.amount) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSubmittingRequest(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/wallet/request-deposit", {
        method: "POST",
        body: JSON.stringify({
          organizerId: requestForm.organizer_id,
          amount: parseFloat(requestForm.amount),
          note: requestForm.note,
          paymentReference: requestForm.payment_ref,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Deposit request submitted successfully!" });
        setShowRequestModal(false);
        setRequestForm({ organizer_id: "", amount: "", note: "", payment_ref: "" });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "pending": return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
      case "rejected": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
      default: return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        subtitle="Manage your balance and transactions"
        actions={
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2"
          >
            <span>💰</span>
            Request Deposit
          </button>
        }
      />

      {/* Message */}
      {message && (
        <div className={`
          px-4 py-3 rounded-xl
          ${message.type === "success" 
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" 
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }
        `}>
          {message.text}
        </div>
      )}

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
        <div className="relative">
          <p className="text-gray-400 mb-2">Current Balance</p>
          <p className="text-4xl md:text-5xl font-bold text-white mb-4">
            ₹{balance.toLocaleString()}
          </p>
          <p className="text-sm text-gray-400">
            Available for tournament entries and withdrawals
          </p>
        </div>
      </div>

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "overview", label: "Overview", icon: "📊" },
          { id: "requests", label: "My Requests", icon: "📝", badge: myRequests.filter(r => r.status === "pending").length || undefined },
          { id: "history", label: "History", icon: "📜" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Deposits"
            value={`₹${transactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`}
            icon={<span className="text-xl">📥</span>}
            color="success"
          />
          <StatCard
            title="Total Spent"
            value={`₹${Math.abs(transactions.filter(t => t.type === "entry_fee" || t.type === "debit").reduce((sum, t) => sum + t.amount, 0)).toLocaleString()}`}
            icon={<span className="text-xl">📤</span>}
            color="danger"
          />
          <StatCard
            title="Pending Requests"
            value={myRequests.filter(r => r.status === "pending").length}
            icon={<span className="text-xl">⏳</span>}
            color="warning"
          />
        </div>
      )}

      {activeTab === "requests" && (
        myRequestsLoading ? (
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        ) : myRequests.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No deposit requests"
            description="Submit a deposit request to add funds to your wallet"
            action={{ label: "Request Deposit", onClick: () => setShowRequestModal(true) }}
            variant="card"
          />
        ) : (
          <div className="space-y-4">
            {myRequests.map((request) => (
              <div 
                key={request.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ₹{request.amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      To: {request.target_username} • {formatDate(request.created_at)}
                    </p>
                    {request.requester_note && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Note: {request.requester_note}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                {request.responder_note && request.status !== "pending" && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Response: {request.responder_note}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === "history" && (
        transactionsLoading ? (
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No transactions yet"
            description="Your transaction history will appear here"
            variant="card"
          />
        ) : (
          <DataTable
            columns={[
              { 
                key: "description", 
                header: "Description",
                render: (t: Transaction) => (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.created_at)}</p>
                  </div>
                ),
              },
              { 
                key: "amount", 
                header: "Amount", 
                align: "right",
                render: (t: Transaction) => (
                  <span className={t.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString()}
                  </span>
                ),
              },
              { 
                key: "balance_after", 
                header: "Balance", 
                align: "right",
                render: (t: Transaction) => (
                  <span className="text-gray-500 dark:text-gray-400">
                    ₹{t.balance_after.toLocaleString()}
                  </span>
                ),
              },
            ]}
            data={transactions}
            keyExtractor={(t) => t.id}
          />
        )
      )}

      {/* Request Deposit Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Deposit"
        description="Submit a deposit request to an organizer"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowRequestModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRequest}
              disabled={submittingRequest}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              {submittingRequest ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Select Organizer"
            value={requestForm.organizer_id}
            onChange={(e) => setRequestForm({ ...requestForm, organizer_id: e.target.value })}
            options={[
              { value: "", label: "Choose an organizer" },
              ...organizers.map(org => ({ value: String(org.id), label: org.username })),
            ]}
            required
          />
          <FormField
            label="Amount (₹)"
            type="number"
            value={requestForm.amount}
            onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
            placeholder="Enter amount"
            required
          />
          <FormField
            label="Payment Reference (Optional)"
            value={requestForm.payment_ref}
            onChange={(e) => setRequestForm({ ...requestForm, payment_ref: e.target.value })}
            placeholder="Transaction ID or reference"
          />
          <FormTextArea
            label="Note (Optional)"
            value={requestForm.note}
            onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })}
            placeholder="Any additional information"
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}
