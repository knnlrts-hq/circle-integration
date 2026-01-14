# Circle Integration Design
**Date**: 2025-11-24
**Status**: Draft
**Version**: 1.0

## Executive Summary

This document describes the integration of Circle's stablecoin infrastructure into the Trax payment factory and Bank Connector. The integration enables corporate customers to:
- Make direct blockchain payments using USDC (USD Coin) stablecoin
- Execute cross-border remittances via Circle Payments Network (CPN)
- Access faster settlement times (minutes vs days) with reduced costs

The integration will be delivered in two phases: Phase 1 focuses on core wallet capabilities and direct blockchain payments; Phase 2 adds CPN cross-border payment functionality.

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Data Model Enhancements](#2-data-model-enhancements)
3. [Phase 1: Core Wallet Capabilities](#3-phase-1-core-wallet-capabilities)
4. [Phase 2: Circle Payments Network Integration](#4-phase-2-circle-payments-network-integration)
5. [Reconciliation Strategy](#5-reconciliation-strategy)
6. [Testing & Rollout Strategy](#6-testing--rollout-strategy)
7. [Security & Operational Considerations](#7-security--operational-considerations)
8. [Future Enhancements](#8-future-enhancements)

---

## 1. Architecture Overview

### 1.1 Design Principles

The Circle integration maintains the established separation of concerns between Trax and Bank Connector:
- **Trax**: Handles payment orchestration, workflows, business logic, and corporate user interactions
- **Bank Connector**: Owns technical protocol implementation, network communication, and Circle API integration

Bank Connector will be extended to support Circle as a new connectivity channel, with the option to extract into a dedicated microservice if complexity warrants it in the future.

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Trax                                 │
│  - Payment Orchestration                                     │
│  - Workflow Engine                                           │
│  - Corporate Portal                                          │
│  - Business Rules                                            │
└─────────────────┬───────────────────────────────────────────┘
                  │ Async Messaging (Queue)
                  │ Payment Requests / Status Events
┌─────────────────▼───────────────────────────────────────────┐
│                    Bank Connector                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Circle Integration Module                      │ │
│  │  - Circle API Client (Wallet, Mint, CPN)               │ │
│  │  - Webhook Receiver & Handler                          │ │
│  │  - Blockchain Address Validation                       │ │
│  │  - Error Classification & Retry Logic                  │ │
│  │  - Travel Rule Encryption                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Existing Channels: SWIFT, ISO20022, Local Clearing, etc.   │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS REST APIs
                  │ Webhook Callbacks
┌─────────────────▼───────────────────────────────────────────┐
│                     Circle Platform                          │
│  - Circle Wallets API (multi-chain wallet management)       │
│  - Circle Mint API (USDC/EURC issuance)                     │
│  - Circle Payments Network (CPN) API                         │
│  - Webhooks (transaction/payment status notifications)      │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Payment Routing Logic

Payment routing is determined by beneficiary account pattern matching:

**Blockchain Address Detection:**
- If beneficiary account matches blockchain address patterns (e.g., `0x[40 hex chars]` for Ethereum-style addresses, Solana base58 patterns, etc.)
- Route to Bank Connector → Circle Wallet Transfer API

**Traditional Account:**
- If beneficiary account matches traditional patterns (IBAN, account number with bank identifier)
- Route to Bank Connector → existing bank channels (SWIFT, local clearing, etc.)

**CPN Cross-Border:**
- If payment is CPN-eligible (specific currency pairs + destination countries in enabled corridors)
- Route to Bank Connector → Circle CPN API

**Validation:**
- Invalid or ambiguous formats return validation error to user with guidance

This account-based routing requires zero UI changes and leverages intuitive user behavior.

### 1.4 Integration Patterns

**Asynchronous Messaging:**
- Trax publishes payment requests to message queue
- Bank Connector consumes messages, processes via Circle APIs, publishes status events back
- Non-blocking design prevents Trax from waiting during blockchain operations

**Webhook-Driven Updates:**
- Circle sends webhook notifications for transaction/payment status changes
- Bank Connector exposes HTTPS endpoint to receive webhooks
- Webhook events validated (signature verification) and published to queue
- Trax consumes events to update corporate views in real-time

---

## 2. Data Model Enhancements

### 2.1 Account Entity Extensions

Extend existing `Account` table with optional blockchain-related fields:

```sql
ALTER TABLE Account ADD COLUMN (
    blockchain_address VARCHAR(255) NULL,
    blockchain_chain VARCHAR(50) NULL,  -- e.g., "ETH", "SOL", "MATIC"
    circle_wallet_id VARCHAR(255) NULL,
    wallet_type VARCHAR(50) NULL,  -- e.g., "corporate_custody", "user_controlled"
    created_at_block BIGINT NULL,  -- block number when wallet created

    INDEX idx_blockchain_address (blockchain_address),
    INDEX idx_circle_wallet_id (circle_wallet_id)
);
```

### 2.2 Payment Entity Extensions

Extend existing `Payment` table to capture blockchain-specific metadata:

```sql
ALTER TABLE Payment ADD COLUMN (
    payment_method VARCHAR(50),  -- Extended enum: "CIRCLE_WALLET_TRANSFER", "CIRCLE_CPN"
    blockchain_tx_hash VARCHAR(255) NULL,  -- On-chain transaction hash
    blockchain_chain VARCHAR(50) NULL,  -- Chain where transaction executed
    gas_fee_amount DECIMAL(18, 8) NULL,  -- Gas fees paid
    gas_fee_currency VARCHAR(10) NULL,  -- Native token (e.g., "ETH", "MATIC")
    circle_transfer_id VARCHAR(255) NULL,  -- Circle API transfer identifier
    circle_payment_id VARCHAR(255) NULL,  -- For CPN payments
    circle_quote_id VARCHAR(255) NULL,  -- For CPN quote reference
    travel_rule_data_encrypted BLOB NULL,  -- Encrypted compliance data
    bfi_partner_name VARCHAR(255) NULL,  -- Selected BFI for CPN
    estimated_settlement_time TIMESTAMP NULL,

    INDEX idx_circle_transfer_id (circle_transfer_id),
    INDEX idx_circle_payment_id (circle_payment_id),
    INDEX idx_blockchain_tx_hash (blockchain_tx_hash)
);
```

### 2.3 Currency Entity Extensions

Extend `Currency` table to support stablecoins and token metadata:

```sql
ALTER TABLE Currency ADD COLUMN (
    is_stablecoin BOOLEAN DEFAULT FALSE,
    token_contract_address VARCHAR(255) NULL,  -- Smart contract address if applicable
    supported_chains JSON NULL,  -- ["ETH", "MATIC", "ARB", "BASE"]
    decimals INT DEFAULT 2,  -- Token decimals (USDC = 6)

    INDEX idx_token_contract (token_contract_address)
);

-- Insert USDC and EURC
INSERT INTO Currency (code, name, is_stablecoin, decimals, supported_chains) VALUES
('USDC', 'USD Coin', TRUE, 6, '["ETH", "MATIC", "ARB", "BASE", "SOL", "AVAX"]'),
('EURC', 'Euro Coin', TRUE, 6, '["ETH", "MATIC", "ARB"]');
```

### 2.4 New Entity: CircleConfiguration

Store corporate-specific Circle settings:

```sql
CREATE TABLE CircleConfiguration (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    corporate_id BIGINT NOT NULL,
    circle_api_key_encrypted BLOB NOT NULL,
    circle_environment VARCHAR(20) NOT NULL,  -- "sandbox" or "production"
    enabled_features JSON NOT NULL,  -- ["wallet_transfers", "cpn_payments", "mint_redemption"]
    default_blockchain_chain VARCHAR(50) DEFAULT 'ETH',
    cpn_enabled_corridors JSON,  -- ["MX", "BR", "NG", "CO"]
    webhook_secret_encrypted BLOB,
    onboarding_status VARCHAR(50) DEFAULT 'pending',  -- "pending", "active", "suspended"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (corporate_id) REFERENCES Corporate(id),
    UNIQUE KEY unique_corporate_circle (corporate_id),
    INDEX idx_corporate (corporate_id)
);
```

### 2.5 Migration Strategy

- Schema changes deployed during maintenance window
- Backward compatible: all new fields are nullable or have defaults
- Existing payment processing continues unaffected
- Circle integration enabled per corporate via `CircleConfiguration` records

---

## 3. Phase 1: Core Wallet Capabilities

### 3.1 Scope & Objectives

Phase 1 delivers foundational blockchain payment functionality:
- Corporate wallet registration with Circle (manual onboarding)
- USD to USDC funding via Circle Mint
- Balance inquiries across wallets and blockchain chains
- Direct USDC transfers to blockchain addresses
- Transaction monitoring and reconciliation

**Success Criteria:**
- Successful USDC transfers to external blockchain addresses
- Real-time balance visibility across multiple chains
- <1 hour average settlement time for blockchain payments
- >98% payment success rate

### 3.2 Circle API Integration - Bank Connector

**Circle API Client Module** (new component in Bank Connector):

```python
class CircleAPIClient:
    """REST client for Circle Wallet APIs"""

    def __init__(self, api_key: str, environment: str):
        self.base_url = "https://api.circle.com" if environment == "production" \
                        else "https://api-sandbox.circle.com"
        self.api_key = api_key

    def create_wallet(self, params: WalletCreationParams) -> Wallet:
        """POST /v1/wallets"""

    def get_wallet_balances(self, wallet_id: str) -> List[Balance]:
        """GET /v1/wallets/{id}/balances"""

    def estimate_transfer_fee(self, params: TransferParams) -> FeeEstimate:
        """POST /v1/transactions/transfer/estimateFee"""

    def create_transfer(self, params: TransferParams) -> Transfer:
        """POST /v1/user/transactions/transfer"""

    def get_transaction_status(self, transaction_id: str) -> Transaction:
        """GET /v1/transactions/{id}"""
```

**Implemented Endpoints:**
- `POST /v1/wallets` - Create corporate wallet (developer-controlled)
- `GET /v1/wallets/{id}/balances` - Query USDC/EURC balances across all supported chains
- `POST /v1/transactions/transfer/estimateFee` - Get gas fee estimates before transfer
- `POST /v1/user/transactions/transfer` - Execute wallet-to-address USDC transfer
- `GET /v1/transactions/{id}` - Query transaction status and blockchain details

### 3.3 Payment Processing Flow

**Step-by-Step Flow:**

```
1. Corporate User Action:
   - Submits payment in Trax portal
   - Beneficiary: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb (blockchain address)
   - Amount: 10,000 USDC

2. Trax Processing:
   - Validates payment submission
   - Detects blockchain address pattern
   - Publishes message to queue: {payment_id, corporate_id, beneficiary_address, amount, currency}

3. Bank Connector Consumption:
   - Consumes payment request message
   - Retrieves CircleConfiguration for corporate
   - Validates corporate has active Circle wallet
   - Decrypts Circle API key

4. Fee Estimation:
   - Calls Circle: POST /transactions/transfer/estimateFee
   - Receives estimate: {gas_fee: 0.15 USDC, estimated_time: "30s"}
   - Validates sufficient balance (amount + gas fee)

5. Transfer Creation:
   - Calls Circle: POST /user/transactions/transfer
   - Payload: {walletId, destination, amount, blockchain}
   - Receives: {transferId: "abc123", status: "pending"}

6. Database Update:
   - Updates Payment record: circle_transfer_id = "abc123", status = "PENDING"
   - Publishes status event to queue

7. Trax Update:
   - Consumes status event
   - Updates corporate view: Payment status = "Processing"
   - Sends notification to corporate user

8. Circle Processing:
   - Circle signs transaction
   - Broadcasts to blockchain network
   - Transaction propagates and confirms

9. Webhook Notification:
   - Circle sends webhook: POST /api/circle/webhook
   - Payload: {event: "transaction.completed", transferId: "abc123", txHash: "0xdef456..."}

10. Bank Connector Webhook Handler:
    - Verifies webhook signature
    - Updates Payment: status = "COMPLETED", blockchain_tx_hash = "0xdef456..."
    - Publishes completion event

11. Trax Final Update:
    - Consumes completion event
    - Updates corporate view: Payment status = "Completed"
    - Sends confirmation notification with blockchain explorer link
```

### 3.4 Error Handling & Retry Logic

**Error Classification:**

**Retryable Errors (automatic retry with exponential backoff):**
- Network timeouts (connection errors, DNS failures)
- Circle API rate limits (HTTP 429)
- Circle service errors (HTTP 5xx)
- Blockchain network congestion (timeout waiting for broadcast)

**Non-Retryable Errors (immediate failure, alert user):**
- Invalid blockchain address format (fails checksum validation)
- Insufficient wallet balance (including gas fees)
- Authentication failures (invalid/expired API key)
- Unsupported blockchain or token
- Amount below minimum or above maximum limits

**Blockchain-Specific Handling:**
- Gas price spikes: Re-estimate fees, optionally prompt user to approve higher cost
- Chain congestion: Increase timeout, provide estimated delay to user
- Transaction failure on-chain: Mark as failed, capture on-chain error reason

**Retry Configuration:**
```python
RETRY_CONFIG = {
    "max_attempts": 3,
    "initial_backoff": 5,  # seconds
    "backoff_multiplier": 2,  # exponential: 5s, 10s, 20s
    "max_backoff": 60  # cap at 60 seconds
}
```

### 3.5 Webhook Integration

**Webhook Endpoint** (Bank Connector):

```
POST /api/circle/webhook
Content-Type: application/json
X-Circle-Signature: <HMAC signature>

{
  "eventId": "evt_123abc",
  "eventType": "transaction.completed",
  "timestamp": "2025-11-24T10:30:00Z",
  "data": {
    "transferId": "abc123",
    "transactionHash": "0xdef456...",
    "status": "confirmed",
    "blockNumber": 12345678,
    "blockchain": "ETH"
  }
}
```

**Webhook Security:**
- Verify HMAC signature using Circle's webhook secret
- Validate timestamp (reject events >5 minutes old to prevent replay attacks)
- IP allowlisting (only accept from Circle's published IP ranges)
- Idempotency: use `eventId` to prevent duplicate processing

**Event Types Handled:**
- `transaction.pending` - Transfer submitted to blockchain
- `transaction.broadcast` - Transaction broadcast to network
- `transaction.confirmed` - Transaction confirmed on-chain (payment complete)
- `transaction.failed` - Transfer failed (insufficient gas, invalid address, etc.)

### 3.6 Onboarding Process (Manual - Phase 1)

**Corporate Onboarding Steps:**

1. **Circle Account Application:**
   - Corporate applies for Circle Mint institutional account (via Circle sales/portal)
   - Circle performs KYC/AML verification
   - Circle issues API credentials (API key, entity ID)

2. **Trax Configuration:**
   - Corporate admin provides Circle credentials to Trax support team
   - Trax admin creates `CircleConfiguration` record
   - Credentials encrypted and stored
   - Enabled features configured: `["wallet_transfers"]`

3. **Wallet Creation:**
   - Trax admin triggers wallet creation via Bank Connector admin API
   - Bank Connector calls Circle: `POST /wallets`
   - Circle wallet ID stored in `CircleConfiguration`

4. **Funding:**
   - Corporate transfers USD from business bank account to Circle
   - Circle mints equivalent USDC to corporate wallet
   - Balance visible in Trax portal

5. **Go-Live:**
   - Corporate authorized to submit USDC payments
   - Trax displays available USDC balance from Circle

**Future Enhancement:** Self-service onboarding portal (Phase 3, post-CPN).

---

## 4. Phase 2: Circle Payments Network Integration

### 4.1 Scope & Objectives

Phase 2 adds cross-border payment capabilities via Circle Payments Network (CPN), enabling corporates to send international remittances with stablecoin rails.

**CPN Value Proposition:**
- Near-instant settlement (vs 1-3 days for SWIFT)
- Transparent FX rates via BFI quote competition
- Built-in travel rule compliance
- Support for emerging market corridors

**Initial Corridors (as of 2025):**
- US → Mexico (MX)
- US → Brazil (BR)
- US → Colombia (CO)
- US → Nigeria (NG)
- US → Hong Kong (HK)
- US → China (CN)

**Planned Expansion:** India (IN), Philippines (PH)

### 4.2 CPN Payment Flow

CPN payments follow a 4-stage process:

#### Stage 1: Quote Generation

```
1. Corporate submits payment:
   - Amount: $10,000 USD
   - Destination: Mexico
   - Beneficiary bank account (local MXN account)

2. Trax detects CPN eligibility:
   - Currency pair: USD → MXN
   - Country: Mexico (in enabled corridors)

3. Bank Connector requests quotes:
   - Calls Circle: GET /v1/cpn/quotes
   - Params: {amount: 10000, sourceCurrency: "USD", destCurrency: "MXN", country: "MX"}

4. Circle returns quotes from multiple BFIs:
   [
     {quoteId: "q1", bfiName: "BFI Partner A", rate: 17.85, fee: 25.00, total: 178,475 MXN},
     {quoteId: "q2", bfiName: "BFI Partner B", rate: 17.90, fee: 15.00, total: 178,985 MXN},
     {quoteId: "q3", bfiName: "BFI Partner C", rate: 17.88, fee: 20.00, total: 178,780 MXN}
   ]

5. Bank Connector selects best quote:
   - Algorithm: max(total_amount_received_by_beneficiary)
   - Selected: q2 (BFI Partner B, beneficiary receives 178,985 MXN)
   - Stores quote_id and BFI partner name
```

**Quote Validity:**
- Quotes typically valid for 30-60 seconds
- Must create payment within validity window or re-quote

#### Stage 2: Payment Creation with Travel Rule Data

```
6. Bank Connector collects travel rule data:
   - From payment form (collected during submission):
     * Beneficiary full legal name
     * Beneficiary residential address
     * Beneficiary ID type and number
     * Beneficiary date of birth

7. Encrypt compliance data:
   - Use Circle's public encryption key (RSA or PGP)
   - Encrypted payload ensures only Circle and BFI can decrypt

8. Create CPN payment:
   - Calls Circle: POST /v1/cpn/payments
   - Payload: {
       quoteId: "q2",
       beneficiaryAccount: {bankCode: "012345", accountNumber: "9876543210"},
       travelRuleData: "<encrypted blob>",
       metadata: {internalPaymentId: "pay_123"}
     }

9. Circle assigns payment ID:
   - Response: {paymentId: "cpn_abc123", status: "pending_bfi_approval"}
   - BFI reviews travel rule data for compliance

10. Await BFI approval:
    - BFI validates compliance data (typically automated, <1 minute)
    - BFI approves or requests additional information (RFI)
```

#### Stage 3: Crypto Transfer

```
11. BFI approves payment:
    - Webhook: {event: "payment.approved", paymentId: "cpn_abc123"}

12. Bank Connector signs USDC transaction:
    - Calls Circle: POST /v1/cpn/payments/{id}/sign
    - Circle generates on-chain USDC transfer to BFI's address

13. Circle broadcasts transaction:
    - Transaction submitted to blockchain (e.g., Ethereum, Polygon)
    - Webhook: {event: "payment.crypto_transfer_broadcast", txHash: "0x..."}

14. On-chain confirmation:
    - Transaction included in block and confirmed
    - Webhook: {event: "payment.crypto_transfer_confirmed", blockNumber: 12345678}
```

#### Stage 4: Fiat Settlement

```
15. BFI receives USDC:
    - BFI's wallet balance updated
    - BFI converts USDC to MXN at locked-in rate

16. BFI settles to beneficiary:
    - BFI initiates local bank transfer (SPEI in Mexico)
    - Beneficiary's MXN account credited: 178,985 MXN

17. Settlement confirmation:
    - Webhook: {event: "payment.completed", paymentId: "cpn_abc123", settlementTime: "2025-11-24T10:35:00Z"}
    - Bank Connector updates Payment status: "COMPLETED"
    - Trax notifies corporate: "Payment delivered to beneficiary"
```

**Total Time:** Typically 5-30 minutes from submission to beneficiary receipt.

### 4.3 Travel Rule Compliance

**Required Data Fields:**

For originator (corporate):
- Full legal name
- Business address
- Tax identification number
- Account identifier

For beneficiary (payment recipient):
- Full legal name
- Residential address (street, city, postal code, country)
- ID type (passport, national ID, tax ID)
- ID number
- Date of birth

**Data Collection:**

Payment form extended with conditional fields:
```html
<!-- Shown only when CPN route detected -->
<section id="cpn-compliance-section" style="display: none">
  <h3>Beneficiary Information (Required for International Transfer)</h3>

  <input name="beneficiary_full_name" required />
  <input name="beneficiary_address_street" required />
  <input name="beneficiary_address_city" required />
  <input name="beneficiary_address_postal" required />
  <select name="beneficiary_address_country" required>...</select>

  <select name="beneficiary_id_type" required>
    <option value="passport">Passport</option>
    <option value="national_id">National ID</option>
    <option value="tax_id">Tax ID</option>
  </select>
  <input name="beneficiary_id_number" required />
  <input name="beneficiary_dob" type="date" required />
</section>
```

**Encryption Process:**

```python
def encrypt_travel_rule_data(data: dict, circle_public_key: str) -> bytes:
    """
    Encrypt travel rule data using Circle's public key.
    Only Circle and approved BFIs can decrypt.
    """
    plaintext = json.dumps(data)
    encrypted = rsa_encrypt(plaintext, circle_public_key)
    return encrypted

# Example usage
travel_rule_data = {
    "originator": {
        "name": "Acme Corp",
        "address": "123 Main St, New York, NY 10001, USA",
        "taxId": "12-3456789",
        "accountId": "wallet_xyz"
    },
    "beneficiary": {
        "name": "Juan Pérez García",
        "address": "Av. Insurgentes Sur 1234, Ciudad de México, 03900, México",
        "idType": "national_id",
        "idNumber": "PEGJ850315HDFRNN01",
        "dateOfBirth": "1985-03-15"
    }
}

encrypted_blob = encrypt_travel_rule_data(travel_rule_data, circle_public_key)
# Store in Payment.travel_rule_data_encrypted
```

**Storage & Security:**
- Never log or display decrypted travel rule data
- Store only encrypted blobs in database
- Encryption keys managed via secure key management system (e.g., AWS KMS, HashiCorp Vault)
- Access audited: only compliance personnel with explicit authorization

### 4.4 BFI Selection Strategy

**Automatic Best-Rate Selection:**

```python
def select_best_bfi(quotes: List[Quote]) -> Quote:
    """
    Select BFI offering best value to beneficiary.
    Metric: total amount received by beneficiary (after fees and FX conversion).
    """
    return max(quotes, key=lambda q: q.total_received_amount)

# Example
quotes = [
    Quote(bfi="Partner A", rate=17.85, fee=25.00, total_received=178475),
    Quote(bfi="Partner B", rate=17.90, fee=15.00, total_received=178985),  # Best
    Quote(bfi="Partner C", rate=17.88, fee=20.00, total_received=178780)
]

best_quote = select_best_bfi(quotes)  # Returns Partner B
```

**Rationale:**
- Maximizes value for corporate's beneficiaries
- Transparent: no hidden relationships or kickbacks
- Simple: no configuration or manual selection needed

**Future Enhancement:** Allow corporate to configure preferred BFI per corridor (e.g., for relationship management).

### 4.5 CPN Webhook Events

**Additional webhook events for CPN payments:**

- `payment.quote_accepted` - Quote locked in for payment
- `payment.pending_bfi_approval` - Awaiting BFI compliance review
- `payment.bfi_approved` - BFI approved, ready for crypto transfer
- `payment.bfi_rfi` - BFI requests additional information (RFI)
- `payment.crypto_transfer_broadcast` - USDC transaction broadcast to blockchain
- `payment.crypto_transfer_confirmed` - On-chain confirmation received
- `payment.settlement_initiated` - BFI initiated local fiat settlement
- `payment.completed` - Beneficiary received funds
- `payment.failed` - Payment failed (with reason: compliance rejection, BFI unavailable, etc.)

**Webhook Handler Updates:**

```python
def handle_cpn_webhook(event: WebhookEvent):
    """Handle CPN-specific webhook events"""

    payment = get_payment_by_circle_id(event.payment_id)

    if event.type == "payment.bfi_approved":
        payment.status = "BFI_APPROVED"
        log_event("BFI approved payment", payment_id=payment.id)

    elif event.type == "payment.bfi_rfi":
        payment.status = "RFI_REQUESTED"
        alert_corporate_admin(payment, event.rfi_details)

    elif event.type == "payment.crypto_transfer_confirmed":
        payment.blockchain_tx_hash = event.tx_hash
        payment.status = "CRYPTO_CONFIRMED"
        log_event("On-chain transfer confirmed", tx_hash=event.tx_hash)

    elif event.type == "payment.completed":
        payment.status = "COMPLETED"
        payment.completed_at = event.settlement_time
        notify_corporate_user(payment, "Payment delivered to beneficiary")

    payment.save()
    publish_status_event(payment)
```

---

## 5. Reconciliation Strategy

### 5.1 Hybrid Reconciliation Approach

Combination of real-time webhook updates (primary path) with periodic batch reconciliation (backstop).

### 5.2 Real-Time Reconciliation via Webhooks

**Primary Path:**

```
1. Circle webhook received: POST /api/circle/webhook
2. Bank Connector validates signature and timestamp
3. Extract Circle transaction/payment ID
4. Query database for matching Payment record
5. Update Payment status, blockchain metadata
6. Publish reconciliation event to message queue
7. Trax consumes event, updates corporate ledger
8. Corporate sees updated payment status in real-time
```

**Webhook Reliability Measures:**

- **Digital Signature Verification:**
  ```python
  def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
      expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
      return hmac.compare_digest(signature, expected)
  ```

- **Idempotency:**
  - Use Circle's `eventId` to detect duplicates
  - Store processed event IDs in cache (Redis) with 24-hour TTL
  - Skip processing if `eventId` already seen

- **Timeout Handling:**
  - Respond to webhook within 5 seconds or Circle retries
  - Process webhook asynchronously: validate → respond 200 OK → process

- **Dead Letter Queue (DLQ):**
  - Failed webhook processing events moved to DLQ
  - Admin alerting for DLQ accumulation
  - Manual review and reprocessing

### 5.3 Batch Reconciliation (Backstop)

**Scheduled Job:**

Runs hourly to catch any payments missed by webhooks:

```python
def batch_reconciliation_job():
    """
    Hourly job to reconcile payments in PENDING status.
    Catches webhook delivery failures, network partitions, etc.
    """

    # Find payments stuck in PENDING > 1 hour
    stale_payments = Payment.query.filter(
        Payment.status == "PENDING",
        Payment.created_at < datetime.now() - timedelta(hours=1)
    ).all()

    discrepancies = []

    for payment in stale_payments:
        # Query Circle for current status
        if payment.circle_transfer_id:
            circle_tx = circle_api.get_transaction_status(payment.circle_transfer_id)
            circle_status = map_circle_status(circle_tx.status)
        elif payment.circle_payment_id:
            circle_payment = circle_api.get_cpn_payment_status(payment.circle_payment_id)
            circle_status = map_circle_status(circle_payment.status)
        else:
            log_error("Payment missing Circle ID", payment_id=payment.id)
            continue

        # Compare database vs Circle
        if payment.status != circle_status:
            discrepancies.append({
                "payment_id": payment.id,
                "db_status": payment.status,
                "circle_status": circle_status
            })

            # Update to match Circle's status
            payment.status = circle_status
            if circle_tx.blockchain_tx_hash:
                payment.blockchain_tx_hash = circle_tx.blockchain_tx_hash
            payment.save()

            # Publish reconciliation event
            publish_status_event(payment, source="batch_reconciliation")

    # Alert if significant discrepancies found
    if len(discrepancies) > 5:
        alert_ops_team("High reconciliation discrepancies", count=len(discrepancies))

    log_metric("batch_reconciliation.discrepancies", len(discrepancies))
    return discrepancies
```

**Batch Job Scheduling:**
- Runs every hour (configurable)
- Looks back 1 hour for stale payments
- Updates database and publishes events for any corrections
- Metrics logged for monitoring

### 5.4 Reconciliation Reporting

**Metrics Dashboard:**
- Webhook receipt rate (events/hour)
- Webhook processing success rate
- Batch reconciliation corrections per run
- Payment status distribution (pending, completed, failed)
- Average time from submission to completion

**Alerts:**
- Webhook receipt rate drops >20% below baseline
- Batch job finds >10 discrepancies in single run
- Any payment stuck in PENDING >4 hours
- Dead letter queue depth >50 events

**Audit Log:**
- All reconciliation actions logged with timestamps
- Source of update (webhook vs batch)
- Old status → new status transitions
- Circle API responses captured for compliance

---

## 6. Testing & Rollout Strategy

### 6.1 Testing Approach

#### 6.1.1 Sandbox Development (Primary)

**Circle Sandbox Environment:**
- Full API functionality without real money
- Test USDC tokens for transfers
- Simulated blockchain confirmations (instant, no actual gas fees)
- Mock CPN corridors and BFI quotes
- Webhook event simulation

**Automated Test Suite:**

```
Phase 1 Test Cases:
- Wallet creation and configuration
- Balance queries (single chain, multi-chain)
- Transfer fee estimation
- USDC transfers (valid address, invalid address, insufficient balance)
- Webhook receipt and processing (all event types)
- Error handling (retryable vs non-retryable)
- Reconciliation batch job

Phase 2 Test Cases:
- CPN quote generation (multiple BFIs)
- Best-rate selection logic
- Travel rule data encryption and submission
- CPN payment creation and BFI approval
- RFI handling (request for information)
- 4-stage CPN flow end-to-end
- Multi-corridor support
```

**Integration Tests:**
- Trax → Bank Connector → Circle Sandbox → Bank Connector → Trax
- Full payment flow with async messaging
- Webhook simulation and event consumption
- Reconciliation triggered by missing webhook

**CI/CD Integration:**
- Automated tests run on every commit
- Sandbox environment refreshed nightly
- Test coverage target: >80% for Circle integration code

#### 6.1.2 Production Pilot (Real-World Validation)

**Pilot Selection:**
- 1-2 friendly corporate customers
- Criteria: tech-savvy, willing to provide feedback, low initial volume
- Signed pilot agreement with expectations and support SLA

**Pilot Scope:**

**Phase 1 Pilot (Weeks 3-6):**
- Small USDC transfers to test wallets ($100-$1,000 amounts)
- Test blockchain address validation
- Validate webhook reliability in production
- Validate reconciliation accuracy
- Collect feedback on UX, error messages, notification clarity

**Phase 2 Pilot (Weeks 11-14):**
- CPN payments to real beneficiaries (limited corridors: US-Mexico only)
- Test travel rule data collection
- Validate BFI quote selection
- End-to-end timing measurement
- Compliance review of travel rule encryption

**Pilot Support:**
- Dedicated Slack channel with Trax engineering team
- Weekly feedback sessions
- Real-time issue resolution (P0/P1 within 4 hours)
- Pilot customers exempt from Circle payment fees

**Pilot Success Criteria:**
- >95% payment success rate
- <5% webhook delivery failures requiring batch reconciliation
- Average settlement time <1 hour (Phase 1) or <30 minutes (Phase 2)
- Positive customer feedback (NPS >8)

### 6.2 Rollout Phases

#### 6.2.1 Phase 1 Rollout: Core Wallet (Months 1-2)

**Week 1-2: Sandbox Development**
- Implement Circle API client in Bank Connector
- Implement webhook endpoint and handlers
- Implement payment routing logic in Trax
- Implement data model changes (schema migration)
- Write automated test suite
- Code review and QA testing

**Week 3: Production Pilot Launch**
- Deploy to production environment
- Onboard 1-2 pilot corporate customers
- Create Circle configuration records
- Fund pilot wallets with test amounts
- Execute first production USDC transfers

**Week 4-6: Pilot Validation**
- Monitor pilot usage and metrics
- Weekly feedback sessions with pilot customers
- Bug fixes and UX improvements
- Validate webhook reliability
- Stress test with higher volume

**Week 7-8: General Availability**
- Open Circle integration to all interested corporates
- Publish user documentation and guides
- Marketing announcement
- Sales enablement (demo, pitch deck)
- Customer support training

**Success Gates:**
- All automated tests passing
- Pilot customers approve for GA
- Zero P0/P1 bugs outstanding
- Runbooks and documentation complete

#### 6.2.2 Phase 2 Rollout: CPN (Months 3-4)

**Week 9-10: CPN Sandbox Development**
- Implement CPN quote and payment APIs
- Implement travel rule data collection and encryption
- Implement BFI selection logic
- Extend webhook handlers for CPN events
- Write CPN-specific automated tests
- Code review and QA testing

**Week 11: Extend Pilot to CPN**
- Enable CPN for existing pilot customers
- Start with single corridor: US → Mexico
- Test with real beneficiaries (small amounts: $100-$500)
- Validate 4-stage flow end-to-end
- Validate travel rule compliance

**Week 12-14: Pilot Validation**
- Monitor CPN usage and metrics
- Measure settlement times
- Validate BFI quote competition
- Compliance review of travel rule handling
- Collect feedback on UX

**Week 15-16: General Availability**
- Enable CPN for all corporates with Circle onboarding
- Launch with 2-3 initial corridors (MX, BR, NG)
- Publish CPN-specific documentation
- Marketing announcement: cross-border payments
- Sales team training

**Success Gates:**
- CPN automated tests passing
- Pilot customers approve CPN for GA
- Compliance sign-off on travel rule handling
- Zero P0/P1 bugs
- BFI partners confirmed and tested

### 6.3 Success Metrics (Post-Rollout)

**Adoption Metrics:**
- Number of corporates onboarded to Circle
- % of eligible payments using Circle (target: 20% within 3 months)
- Monthly USDC transaction volume (target: $10M+ by month 6)
- Number of CPN corridors actively used

**Economic Metrics:**
- Average payment fee: Circle vs traditional rails (target: 30% reduction)
- Total cost savings for corporates (aggregate)
- Revenue from Circle-enabled premium services (future)
- New corporate customer acquisition attributed to Circle

**Performance Metrics:**
- Average settlement time: wallet transfers (target: <1 hour) and CPN (target: <30 minutes)
- Payment success rate (target: >98%)
- Webhook delivery success rate (target: >99%)
- Batch reconciliation correction rate (target: <0.5%)

**Customer Satisfaction:**
- NPS score from Circle users (target: >8)
- Support ticket volume related to Circle (target: <5% of total)
- User-reported payment failures (target: <2%)

**Monitoring Cadence:**
- Daily: transaction volume, success rate, errors
- Weekly: adoption metrics, settlement times
- Monthly: economic impact, NPS, strategic review

---

## 7. Security & Operational Considerations

### 7.1 Security Measures

#### 7.1.1 API Key Management

**Storage:**
- Circle API keys encrypted at rest using AES-256
- Encryption keys stored in secure key management system (AWS KMS, HashiCorp Vault, Azure Key Vault)
- API keys never logged or displayed in plaintext
- Access to encryption keys restricted to Bank Connector service identity

**Rotation:**
- API keys rotated every 90 days
- Rotation process: generate new key → update CircleConfiguration → verify connectivity → revoke old key
- Automated reminders for upcoming rotation
- Zero-downtime rotation via dual-key overlap period

**Environment Separation:**
- Separate API keys for sandbox vs production
- Production keys never used in non-production environments
- Environment clearly labeled in configuration

**Access Logging:**
```python
def log_circle_api_call(endpoint: str, corporate_id: int, response_status: int):
    """Audit log for all Circle API interactions"""
    audit_log.info({
        "timestamp": datetime.now().isoformat(),
        "service": "bank_connector",
        "action": "circle_api_call",
        "endpoint": endpoint,
        "corporate_id": corporate_id,
        "response_status": response_status,
        "user_agent": "TraxBankConnector/1.0"
    })
```

#### 7.1.2 Webhook Security

**Digital Signature Verification:**
```python
def verify_webhook(request: HttpRequest, secret: str) -> bool:
    """
    Verify Circle webhook signature.
    Circle uses HMAC-SHA256 with webhook secret.
    """
    signature = request.headers.get("X-Circle-Signature")
    payload = request.body

    expected_signature = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(signature, expected_signature)

@app.route("/api/circle/webhook", methods=["POST"])
def handle_webhook():
    if not verify_webhook(request, circle_webhook_secret):
        logger.warning("Invalid webhook signature", ip=request.remote_addr)
        return {"error": "Invalid signature"}, 401

    # Process webhook...
```

**IP Allowlisting:**
- Configure firewall/security groups to only accept webhooks from Circle's published IP ranges
- Regularly update IP allowlist as Circle publishes changes
- Log and alert on webhook attempts from non-allowlisted IPs

**Rate Limiting:**
- Maximum 100 webhook requests per minute per corporate
- Prevents webhook flooding DoS attacks
- Excess requests return HTTP 429 with Retry-After header

**HTTPS Required:**
- Webhook endpoint only accessible via HTTPS
- Valid TLS certificate (not self-signed)
- TLS 1.2+ required

#### 7.1.3 Travel Rule Data Protection

**Encryption at Collection:**
```python
def encrypt_travel_rule_data(data: dict, public_key: str) -> bytes:
    """
    Encrypt travel rule PII immediately upon collection.
    Uses Circle's public RSA key (4096-bit).
    """
    plaintext = json.dumps(data).encode()

    # Encrypt with RSA-OAEP padding
    encrypted = rsa.encrypt(plaintext, public_key, padding="OAEP")

    # Never log or display plaintext
    return encrypted
```

**Storage:**
- Travel rule data stored only in encrypted form (`Payment.travel_rule_data_encrypted`)
- Never stored or logged in plaintext
- Database column encrypted at rest (database-level encryption)

**Access Control:**
- Only Circle and approved BFI partners can decrypt (they have the private key)
- Trax/Bank Connector never decrypt travel rule data
- Access to encrypted blobs audited
- Compliance personnel have read-only access to encrypted data (cannot decrypt without private key)

**Audit Trail:**
```python
def audit_travel_rule_access(payment_id: int, user_id: int, action: str):
    """Log all access to travel rule data for compliance"""
    compliance_audit_log.info({
        "timestamp": datetime.now().isoformat(),
        "payment_id": payment_id,
        "user_id": user_id,
        "action": action,  # "encrypted", "transmitted", "viewed_encrypted"
        "data_classification": "PII - Travel Rule"
    })
```

#### 7.1.4 Blockchain Address Validation

**Format Validation:**
```python
def validate_blockchain_address(address: str, chain: str) -> bool:
    """Validate blockchain address format before submission"""

    if chain in ["ETH", "MATIC", "ARB", "BASE"]:  # Ethereum-style
        if not re.match(r"^0x[a-fA-F0-9]{40}$", address):
            return False
        # Verify EIP-55 checksum
        return verify_eip55_checksum(address)

    elif chain == "SOL":  # Solana
        if not re.match(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$", address):
            return False
        return verify_base58_checksum(address)

    else:
        raise ValueError(f"Unsupported chain: {chain}")
```

**Amount Validation:**
- Minimum transfer: 10 USDC (configurable per corporate)
- Maximum transfer: $100,000 USDC per transaction (regulatory limit, configurable)
- Daily limit per corporate (configurable, e.g., $500,000)

**Blacklist Checking:**
```python
def check_address_blacklist(address: str, corporate_id: int) -> bool:
    """
    Check if address is blacklisted (fraud prevention).
    Corporate-specific blacklists + global OFAC/sanctions list.
    """

    # Check corporate-specific blacklist
    if AddressBlacklist.query.filter_by(
        corporate_id=corporate_id,
        address=address
    ).first():
        return True

    # Check global sanctions list (OFAC, EU, UN)
    if check_sanctions_list(address):
        return True

    return False
```

### 7.2 Operational Monitoring

#### 7.2.1 Key Metrics

**Circle API Performance:**
- Request latency (p50, p95, p99) per endpoint
- Error rate (4xx, 5xx) per endpoint
- Rate limit headroom (requests used vs limit)
- Timeout frequency

**Payment Success:**
- Success rate: wallet transfers
- Success rate: CPN payments
- Failure reasons distribution (insufficient balance, invalid address, compliance rejection, etc.)
- Retry statistics (retries per payment, retry success rate)

**Webhook Reliability:**
- Webhook delivery success rate
- Webhook processing latency (receipt to database update)
- Duplicate webhook rate (idempotency hits)
- DLQ depth

**Reconciliation:**
- Batch job findings per run (discrepancies corrected)
- % of payments requiring batch correction
- Average time to reconciliation

**Settlement Performance:**
- Average time: submission to completion (wallet transfers)
- Average time: submission to completion (CPN payments)
- Settlement time distribution (histogram)

**Gas Fees:**
- Average gas fee per transaction (by chain)
- Gas fee as % of transfer amount
- Gas price volatility (alert on spikes)

#### 7.2.2 Alerting

**Critical Alerts (P0 - immediate response):**
- Circle API error rate >10% for 5 minutes
- Zero successful payments for 30 minutes
- Webhook endpoint returning 5xx errors
- Any payment stuck in PENDING >4 hours
- Circle API authentication failures

**High Priority Alerts (P1 - response within 1 hour):**
- Circle API error rate >5% for 10 minutes
- Webhook delivery success rate <95% for 1 hour
- Batch reconciliation finds >10 discrepancies
- Gas fees >200% of 24-hour average
- Payment success rate <95% for 1 hour

**Medium Priority Alerts (P2 - response within 4 hours):**
- Circle API latency p95 >5 seconds
- Webhook processing latency >30 seconds
- Payment stuck in PENDING >2 hours
- Dead letter queue depth >50 events

**Alert Channels:**
- P0: PagerDuty (on-call engineer paged)
- P1: Slack #circle-alerts channel + email
- P2: Slack #circle-alerts channel

#### 7.2.3 Incident Response

**Runbooks:**

**Scenario: Circle API Outage**
1. Verify outage (check Circle status page, try multiple endpoints)
2. Enable "degraded mode" flag → Trax disables Circle routing, falls back to traditional rails
3. Notify corporates of temporary Circle unavailability
4. Monitor Circle status page for restoration
5. Test connectivity after restoration, re-enable Circle routing
6. Post-incident review: analyze impact, identify improvements

**Scenario: Webhook Delivery Failure**
1. Check Bank Connector webhook endpoint health
2. Check firewall/security group rules (IP allowlist)
3. Check TLS certificate validity
4. Manually trigger batch reconciliation for affected time window
5. Review webhook delivery logs from Circle dashboard
6. If systemic issue, contact Circle support
7. Update affected payment statuses manually if needed

**Scenario: Payment Stuck in PENDING**
1. Query Circle API for current transaction/payment status
2. If Circle shows completed but webhook missed: manually update status
3. If Circle shows pending: investigate reason (insufficient gas, BFI delay, etc.)
4. If Circle shows failed but database shows pending: update status to failed
5. Notify corporate with specific reason and next steps
6. If blockchain transaction, check explorer for on-chain status

**Scenario: Blockchain Congestion**
1. Monitor gas prices on target chain
2. If gas fees >3x normal: alert corporates, suggest alternative chains
3. Consider increasing timeout for transaction confirmation
4. If urgent, option to bump gas price (via Circle API if supported)
5. Communicate estimated delay to affected corporates

**Escalation Path:**
1. Bank Connector on-call engineer (P0/P1 alerts)
2. Trax platform team lead (if Bank Connector cannot resolve)
3. Circle support (if issue is on Circle side)
4. Executive escalation (if business-critical impact)

**Communication Templates:**

```
Subject: Circle Payments Temporarily Unavailable

Dear [Corporate Name],

We're experiencing a temporary issue with our Circle stablecoin payment service due to [reason].

Impact: USDC/CPN payments cannot be processed at this time.
Workaround: You can continue using traditional payment methods (SWIFT, local clearing).
ETA for resolution: [estimated time]

We'll notify you as soon as Circle payments are restored. We apologize for the inconvenience.

Best regards,
Trax Support Team
```

#### 7.2.4 Compliance & Audit

**Transaction Logging:**
- All Circle API requests/responses logged (excluding PII)
- All payment status transitions logged with timestamps
- All webhook events logged with raw payloads
- All reconciliation actions logged
- Retention: 7 years (financial services standard)

**Travel Rule Audit:**
- All travel rule data collection events logged
- All encryption operations logged (who, when, which payment)
- All CPN payment submissions logged
- Quarterly compliance review of travel rule handling
- Annual external audit of PII protection

**Regulatory Reporting:**
- Monthly transaction volume report (by corridor, by currency)
- Quarterly compliance flag report (RFIs, rejections)
- Annual AML/CFT assessment
- Ad-hoc reporting for regulatory inquiries

**Data Retention:**
```sql
-- Payment records retained for 7 years
-- After 7 years, archive to cold storage

CREATE TABLE PaymentArchive (
    -- Same schema as Payment table
    archived_at TIMESTAMP NOT NULL,
    original_payment_id BIGINT NOT NULL
);

-- Annual archival job
INSERT INTO PaymentArchive
SELECT *, NOW(), payment_id
FROM Payment
WHERE created_at < NOW() - INTERVAL 7 YEAR;

DELETE FROM Payment WHERE created_at < NOW() - INTERVAL 7 YEAR;
```

**Access Auditing:**
```python
def audit_database_access(query: str, user: str, result_count: int):
    """Audit all database queries accessing sensitive Circle data"""
    if any(table in query.upper() for table in ["PAYMENT", "CIRCLECONFIGURATION"]):
        audit_log.info({
            "timestamp": datetime.now().isoformat(),
            "user": user,
            "action": "database_query",
            "query": sanitize_query(query),  # Remove sensitive values
            "result_count": result_count
        })
```

---

## 8. Future Enhancements

### 8.1 Treasury Management & Liquidity Optimization

**Capability:**
Unified USDC balance view across multiple blockchains using Circle Gateway, with automatic rebalancing via CCTP.

**Value Proposition:**
- Corporate sees total USDC liquidity without checking each chain manually
- Automatic rebalancing to optimize gas fees (move USDC to cheaper chains)
- Reduces idle capital fragmentation

**Implementation:**
- Circle Gateway API aggregates balances from all chains
- Bank Connector exposes consolidated balance in Trax portal
- CCTP API enables cross-chain USDC transfers with 1:1 efficiency (no slippage)
- Rebalancing rules configured per corporate (e.g., "maintain 20% on Polygon for low gas fees")

**Use Case:**
Corporate has 100K USDC on Ethereum, 50K on Polygon, 30K on Arbitrum. Trax shows total: 180K USDC available. Corporate submits payment on Polygon (low gas fees), CCTP automatically moves funds from Ethereum if needed.

**Priority:** High (Phase 3, after CPN stabilizes)

### 8.2 Cross-Chain Transfer Protocol (CCTP)

**Capability:**
Move USDC between blockchains without swapping or bridging risks. Circle burns USDC on source chain, mints equivalent on destination chain.

**Value Proposition:**
- 1:1 transfer efficiency (no slippage or bridge fees)
- Eliminates wrapped tokens and bridge risk
- Automatic optimization: pay on cheapest chain

**Implementation:**
- Bank Connector calls CCTP API when transfer destination chain differs from source balance location
- Transparent to user: they select recipient address, Bank Connector handles cross-chain routing

**Use Case:**
Corporate wants to pay to Polygon address but only has USDC on Ethereum. Bank Connector automatically: CCTP transfer ETH→MATIC, then pay recipient. User sees single transaction.

**Priority:** High (can implement in Phase 3 alongside treasury management)

### 8.3 Programmable Payments with Smart Contracts

**Capability:**
Deploy escrow or conditional payment contracts using Circle Contracts platform (audited templates).

**Value Proposition:**
- Automated payment releases based on milestones, delivery confirmation, multi-party approvals
- Reduces disputes and manual intervention
- Increases trust with counterparties

**Implementation:**
- Trax workflow triggers contract deployment via Circle Contracts API
- Bank Connector monitors contract events (e.g., "goods delivered" event releases payment)
- Templates: escrow, milestone-based release, recurring payments

**Use Cases:**
1. **International Trade:** Payment held in escrow until shipping documents verified, automatically released
2. **Milestone Projects:** Contract releases 25% upon each milestone completion
3. **Subscription Services:** Automated recurring monthly payments from corporate wallet

**Priority:** Medium (Phase 4, requires workflow builder in Trax)

### 8.4 Mass Payout Capabilities

**Capability:**
Batch USDC payouts to hundreds of recipients (contractors, vendors, employees) in single operation.

**Value Proposition:**
- Instant global payroll or supplier payments
- 24/7 availability (no banking hours restrictions)
- Reduced FX fees for international payouts
- Simpler compliance (fewer individual payments to track)

**Implementation:**
- Bulk payment API in Bank Connector: submit CSV with recipient addresses and amounts
- Batch processing with status tracking per recipient
- Webhooks report completion status for each payout

**Use Case:**
Corporate runs monthly contractor payroll to 200 global freelancers. Upload CSV, trigger batch payout, all 200 receive USDC within minutes. No individual wire transfer fees.

**Priority:** High (strong customer demand, Phase 3)

### 8.5 Gasless Transactions via Circle Paymaster

**Capability:**
Users pay gas fees in USDC instead of native tokens (ETH, MATIC, etc.).

**Value Proposition:**
- Simplified UX: corporates don't need to manage multiple token types for gas
- Eliminates "stuck transactions" due to insufficient gas token
- Bank Connector auto-deducts gas from USDC balance

**Implementation:**
- Enable Paymaster feature in Circle wallet configuration
- Gas fees automatically deducted from USDC balance during transfers
- Transparent to user: they see "Transfer: 1000 USDC + 0.15 USDC gas = 1000.15 USDC total"

**Use Case:**
Corporate making Polygon transfer doesn't need to acquire MATIC for gas. Gas deducted from USDC balance automatically.

**Priority:** Medium (nice-to-have, Phase 4)

### 8.6 Multi-Corridor Remittance Expansion

**Capability:**
As Circle expands CPN to new countries (India, Philippines planned), enable new corridors automatically.

**Value Proposition:**
- Broader geographic reach for corporate customers
- Competitive advantage in emerging markets
- First-mover advantage in new corridors

**Implementation:**
- Configuration-driven corridor enablement (no code changes required)
- As Circle announces new BFI partnerships, enable in `CircleConfiguration.cpn_enabled_corridors`
- Test with pilot corporates, then general availability

**Planned Corridors:**
- India (USD → INR) - Q1 2026
- Philippines (USD → PHP) - Q2 2026
- Additional countries as Circle announces

**Priority:** Continuous (enable as Circle launches)

### 8.7 EURC Support

**Capability:**
Circle issues EURC (Euro-backed stablecoin) alongside USDC. Enable EUR-denominated flows.

**Value Proposition:**
- European corporate customers
- EUR-denominated payments without USD conversion
- Expands addressable market

**Implementation:**
- Extend currency model to support EURC alongside USDC
- Same APIs as USDC (Circle Wallets, CPN support EURC)
- Additional compliance review for EUR regulations

**Use Case:**
European corporate pays vendors in EURC, avoiding EUR→USD→EUR conversion costs.

**Priority:** Medium (depends on European market demand, Phase 4)

### 8.8 Self-Service Corporate Onboarding

**Capability:**
Corporate customers can register for Circle services directly within Trax self-service portal.

**Value Proposition:**
- Improved UX vs manual onboarding
- Faster time-to-value (no waiting for admin setup)
- Scales better than manual process

**Implementation:**
- Trax self-service portal integration with Circle OAuth
- Automated wallet creation upon approval
- Admin approval workflow for compliance review
- Credential management (API keys never exposed to corporate user)

**Priority:** Medium (Phase 3-4, after validating demand with manual onboarding)

---

## 9. Implementation Priorities

### Phase 1: Core Wallet (Months 1-2)
**Deliverables:**
- Circle API client in Bank Connector
- Webhook endpoint and handlers
- Payment routing logic
- Data model changes
- Automated tests
- Sandbox validation
- Production pilot with 2 corporates
- General availability

**Success Criteria:**
- 2+ pilot corporates successfully using Circle
- >95% payment success rate
- <1 hour average settlement time
- Positive pilot feedback

### Phase 2: CPN Integration (Months 3-4)
**Deliverables:**
- CPN quote and payment APIs
- Travel rule data collection and encryption
- BFI selection logic
- CPN webhook handlers
- Automated CPN tests
- Pilot extension to CPN
- General availability (2-3 corridors)

**Success Criteria:**
- CPN payments successfully delivered to beneficiaries
- <30 minutes average settlement time
- Compliance sign-off on travel rule handling
- Positive pilot feedback

### Phase 3: Advanced Features (Months 5-6)
**Priority Ranked:**
1. **CCTP cross-chain transfers** (high value, moderate complexity)
2. **Mass payout capabilities** (high demand, moderate complexity)
3. **Treasury management dashboard** (high value, low complexity)
4. **Self-service onboarding** (scales better, moderate complexity)

### Phase 4: Strategic Enhancements (Months 7+)
**Backlog:**
- EURC support
- Smart contract escrow
- Gasless transactions (Paymaster)
- Advanced treasury optimization
- Additional CPN corridors as available

---

## 10. Conclusion

This Circle integration design enables Trax and Bank Connector to support stablecoin payments and cross-border remittances via blockchain rails, providing corporate customers with:
- **Speed**: Minutes vs days for settlement
- **Cost**: 30%+ reduction in payment fees
- **Reach**: Access to emerging market corridors via CPN
- **Transparency**: Real-time tracking with blockchain confirmations

The phased approach validates core capabilities (Phase 1) before adding complexity (Phase 2), with production pilots de-risking each phase. The architecture maintains separation of concerns (Trax orchestration, Bank Connector connectivity) while leaving room to extract a Circle microservice if needed.

Future enhancements provide a clear roadmap for differentiated features (CCTP, smart contracts, mass payouts) that expand value for corporate customers.

**Next Steps:**
1. Review and approve this design document
2. Create detailed implementation plan with task breakdown
3. Set up Circle Mint sandbox account
4. Begin Phase 1 development

---

**Document History:**
- 2025-11-24: Initial draft (v1.0) - comprehensive design from brainstorming session
