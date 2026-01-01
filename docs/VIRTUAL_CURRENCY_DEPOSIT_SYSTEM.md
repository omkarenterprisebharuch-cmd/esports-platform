# 💰 Virtual Currency Deposit System - Implementation Plan

## 📋 Overview

This document outlines the implementation of a hierarchical virtual currency deposit system for tournament entry fees. The system enables:

1. **Owner** → Deposits virtual currency to **Organizer** accounts
2. **Organizer** → Deposits virtual currency to **User** accounts
3. **Organizer** → Sends deposit requests to **Owner**
4. **User** → Sends deposit requests to **Organizer**

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OWNER (Platform)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • View organizer deposit requests                       │    │
│  │  • Approve/Reject requests                               │    │
│  │  • Direct deposit to organizer wallet                    │    │
│  │  • View all transactions                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Deposits ₹
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORGANIZER (Tournament Host)                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Request deposits from Owner                           │    │
│  │  • View user deposit requests                            │    │
│  │  • Approve/Reject user requests                          │    │
│  │  • Direct deposit to user wallet                         │    │
│  │  • View own wallet balance & transactions                │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Deposits ₹
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                          USER (Player)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Request deposits from Organizer                       │    │
│  │  • View wallet balance                                   │    │
│  │  • Pay tournament entry fees                             │    │
│  │  • View transaction history                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### 1. Wallet Transactions Table (New)

```sql
CREATE TABLE wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(30) NOT NULL,
    -- Types: 'deposit', 'withdrawal', 'entry_fee', 'prize', 'refund', 
    --        'owner_deposit', 'organizer_deposit'
    status VARCHAR(20) DEFAULT 'completed',
    -- Status: 'pending', 'completed', 'failed'
    description TEXT,
    reference_id VARCHAR(100),
    -- Reference to deposit_request if applicable
    from_user_id INTEGER REFERENCES users(id),
    -- Who sent the deposit (owner/organizer)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
```

### 2. Deposit Requests Table (New)

```sql
CREATE TABLE deposit_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- User or Organizer requesting the deposit
    target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Owner or Organizer who will process the request
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    request_type VARCHAR(30) NOT NULL,
    -- 'organizer_to_owner' or 'user_to_organizer'
    status VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'approved', 'rejected'
    requester_note TEXT,
    -- Note from requester
    responder_note TEXT,
    -- Note from approver/rejector
    payment_proof_url TEXT,
    -- Optional: URL to payment proof image
    processed_by INTEGER REFERENCES users(id),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposit_requests_requester ON deposit_requests(requester_id);
CREATE INDEX idx_deposit_requests_target ON deposit_requests(target_id);
CREATE INDEX idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX idx_deposit_requests_type ON deposit_requests(request_type);
```

---

## 🔌 API Endpoints

### Owner APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/owner/deposit-requests` | List all organizer deposit requests |
| POST | `/api/owner/deposit` | Direct deposit to organizer wallet |
| POST | `/api/owner/deposit-requests/[id]/approve` | Approve organizer request |
| POST | `/api/owner/deposit-requests/[id]/reject` | Reject organizer request |

### Organizer APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/organizer/request-deposit` | Request deposit from owner |
| GET | `/api/organizer/deposit-requests` | List user deposit requests |
| POST | `/api/organizer/deposit` | Direct deposit to user wallet |
| POST | `/api/organizer/deposit-requests/[id]/approve` | Approve user request |
| POST | `/api/organizer/deposit-requests/[id]/reject` | Reject user request |
| GET | `/api/organizer/my-requests` | View own requests to owner |

### User APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallet/request-deposit` | Request deposit from organizer |
| GET | `/api/wallet/balance` | Get wallet balance |
| GET | `/api/wallet/transactions` | Get transaction history |
| GET | `/api/wallet/my-requests` | View own deposit requests |

---

## 🖥️ UI Components

### 1. Owner Dashboard - Deposit Panel

**Location:** `/src/app/(dashboard)/owner/deposits/page.tsx`

Features:
- Tab 1: **Pending Requests** - List of organizer requests awaiting approval
- Tab 2: **Direct Deposit** - Form to deposit directly to organizer account
- Tab 3: **Transaction History** - All owner-initiated deposits

### 2. Organizer Dashboard - Wallet Management

**Location:** `/src/app/(dashboard)/admin/wallet/page.tsx`

Features:
- **Request Deposit** - Form to request funds from owner
- **My Requests** - Status of requests to owner
- **User Requests** - List of user deposit requests
- **Direct Deposit** - Form to deposit to user account
- **Transaction History** - All wallet transactions

### 3. User Profile - Wallet Section

**Location:** `/src/app/(dashboard)/wallet/page.tsx`

Features:
- **Balance Display** - Current wallet balance
- **Request Deposit** - Form to request from organizer
- **My Requests** - Status of deposit requests
- **Transaction History** - All transactions

---

## 📁 File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── owner/
│   │   │   └── deposits/
│   │   │       └── page.tsx          # Owner deposit management
│   │   ├── admin/
│   │   │   └── wallet/
│   │   │       └── page.tsx          # Organizer wallet management
│   │   └── wallet/
│   │       └── page.tsx              # User wallet page
│   └── api/
│       ├── owner/
│       │   ├── deposit/
│       │   │   └── route.ts          # Direct deposit to organizer
│       │   └── deposit-requests/
│       │       ├── route.ts          # List organizer requests
│       │       └── [id]/
│       │           ├── approve/
│       │           │   └── route.ts
│       │           └── reject/
│       │               └── route.ts
│       ├── organizer/
│       │   ├── request-deposit/
│       │   │   └── route.ts          # Request from owner
│       │   ├── deposit/
│       │   │   └── route.ts          # Direct deposit to user
│       │   ├── deposit-requests/
│       │   │   ├── route.ts          # List user requests
│       │   │   └── [id]/
│       │   │       ├── approve/
│       │   │       │   └── route.ts
│       │   │       └── reject/
│       │   │           └── route.ts
│       │   └── my-requests/
│       │       └── route.ts          # Own requests to owner
│       └── wallet/
│           ├── balance/
│           │   └── route.ts
│           ├── transactions/
│           │   └── route.ts
│           ├── request-deposit/
│           │   └── route.ts          # Request from organizer
│           └── my-requests/
│               └── route.ts
├── lib/
│   └── wallet.ts                     # Wallet utility functions
└── components/
    └── wallet/
        ├── BalanceCard.tsx
        ├── DepositForm.tsx
        ├── DepositRequestCard.tsx
        ├── RequestDepositForm.tsx
        └── TransactionHistory.tsx
```

---

## 🔒 Security Considerations

1. **Role-Based Access Control**
   - Owner endpoints: Only users with `role = 'owner'`
   - Organizer endpoints: Only users with `role = 'organizer'`
   - User endpoints: All authenticated users

2. **Transaction Atomicity**
   - All balance updates use database transactions
   - Debit from source + Credit to target in single transaction

3. **Validation**
   - Amount must be positive
   - Cannot deposit more than available balance (for organizers)
   - Request amount limits (configurable)

4. **Audit Trail**
   - All transactions logged with timestamps
   - `from_user_id` tracks who initiated the deposit
   - Request history maintained even after approval/rejection

---

## 📋 Implementation Order

### Phase 1: Database & Core (Day 1)
- [x] Create implementation plan document
- [ ] Create database migration
- [ ] Create wallet utility library (`lib/wallet.ts`)
- [ ] Add error codes for wallet operations

### Phase 2: Owner APIs & UI (Day 2)
- [ ] Owner deposit API
- [ ] Owner deposit requests API
- [ ] Owner approve/reject APIs
- [ ] Owner deposits page UI

### Phase 3: Organizer APIs & UI (Day 3)
- [ ] Organizer request deposit API
- [ ] Organizer deposit to user API
- [ ] Organizer deposit requests API
- [ ] Organizer wallet page UI

### Phase 4: User APIs & UI (Day 4)
- [ ] User request deposit API
- [ ] User wallet page
- [ ] Update profile page wallet section
- [ ] Transaction history component

### Phase 5: Testing & Polish (Day 5)
- [ ] End-to-end testing
- [ ] Error handling improvements
- [ ] UI polish and notifications
- [ ] Documentation updates

---

## 🎯 Success Criteria

1. ✅ Owner can view and approve/reject organizer deposit requests
2. ✅ Owner can directly deposit to organizer wallets
3. ✅ Organizer can request deposits from owner
4. ✅ Organizer can view and approve/reject user deposit requests
5. ✅ Organizer can directly deposit to user wallets
6. ✅ Users can request deposits from organizers
7. ✅ All transactions are logged and visible
8. ✅ Wallet balances update correctly in real-time

---

## 📝 Notes

- The system uses **virtual currency** (₹), not real payment integration
- Real money is handled offline (organizer receives actual payment, then credits virtual balance)
- This enables tournament entry fee collection without payment gateway complexity
- Future enhancement: Add payment proof upload for audit purposes
