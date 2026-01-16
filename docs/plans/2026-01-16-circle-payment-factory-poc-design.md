# Circle Payment Factory POC Design

**Date:** 2026-01-16
**Status:** Approved
**Version:** 1.0

## Executive Summary

This document describes a proof of concept demonstrating Circle API integration with a corporate payment factory handling ISO 20022 pain.001.001.03 files. The POC consists of six interconnected modules that showcase real-world payment workflows, from file parsing through cross-border settlement.

**Primary Audience:** Internal technical teams validating integration patterns; business stakeholders evaluating value proposition.

**Key Principle:** Each module mirrors production use cases as closely as possible, using live Circle API calls where available.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Specifications](#2-module-specifications)
3. [Technical Implementation](#3-technical-implementation)
4. [Circle API Integration](#4-circle-api-integration)
5. [Mock Data Strategy](#5-mock-data-strategy)
6. [Hosting & Deployment](#6-hosting--deployment)

---

## 1. Architecture Overview

### 1.1 Directory Structure

```
/
├── index.html                      # Payment Factory Console (landing page)
├── modules/
│   ├── payment-file-processor/
│   │   └── index.html              # pain.001 parsing & routing
│   ├── blockchain-payment-desk/
│   │   └── index.html              # Direct USDC transfers
│   ├── cross-border-rate-desk/
│   │   └── index.html              # BFI quote comparison
│   ├── beneficiary-compliance/
│   │   └── index.html              # Travel rule data builder
│   ├── payment-operations-monitor/
│   │   └── index.html              # Settlement lifecycle tracker
│   └── treasury-liquidity-dashboard/
│       └── index.html              # Multi-chain balance view
├── shared/
│   ├── mock-data.js                # Shared mock data
│   ├── circle-api.js               # Circle API wrapper
│   └── samples/
│       ├── pain001-mixed.xml       # Sample with CPN + blockchain + SWIFT
│       ├── pain001-cpn-only.xml    # Mexico/Brazil payments
│       └── pain001-crypto.xml      # Blockchain address payments
├── README.md                       # Setup & GitHub Pages instructions
└── .nojekyll                       # Disable Jekyll processing
```

### 1.2 Design Principles

1. **Single-file modules:** Each module is a self-contained HTML file with inline CSS and JavaScript
2. **CDN dependencies:** No build step; libraries loaded from CDN
3. **Live API first:** Use real Circle API calls; fall back to mock data when API unavailable
4. **Production fidelity:** UI patterns, terminology, and workflows match real payment factory operations
5. **Demo-friendly:** Include controls for presentations (pause, manual triggers, reset)

### 1.3 Shared Dependencies (CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | 3.4 | Utility-first styling |
| Alpine.js | 3.x | Lightweight reactivity |
| Prism.js | 1.29 | XML/JSON syntax highlighting |

### 1.4 Design Tokens

```css
:root {
  --color-primary: #0052FF;      /* Circle blue */
  --color-primary-dark: #0041CC;
  --color-success: #10B981;      /* Emerald */
  --color-warning: #F59E0B;      /* Amber */
  --color-error: #EF4444;        /* Red */
  --color-neutral-50: #F9FAFB;
  --color-neutral-100: #F3F4F6;
  --color-neutral-200: #E5E7EB;
  --color-neutral-700: #374151;
  --color-neutral-900: #111827;
}
```

---

## 2. Module Specifications

### 2.1 Payment File Processor

**Purpose:** Parse pain.001.001.03 XML files, identify Circle-eligible payments, display routing decisions.

**Layout:**
- Left panel: File upload zone + sample file selector
- Right panel: Parsed payment instructions table

**Workflow:**
1. User uploads or selects sample pain.001 file
2. System parses XML, extracts `<PmtInf>` and `<CdtTrfTxInf>` blocks
3. Each payment row displays:
   - Creditor name, account (IBAN or address), amount, currency
   - Routing badge: `CPN Eligible`, `Blockchain`, or `Traditional Rails`
4. Click row to view routing rationale

**Routing Logic:**
```
IF creditor account matches /^0x[a-fA-F0-9]{40}$/ → Blockchain (EVM)
IF creditor account matches /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ → Blockchain (Solana)
IF destination country IN [MX, BR, CO, NG, HK, CN, IN, PH]
   AND currency pair supported → CPN Eligible
ELSE → Traditional Rails
```

**Technical Notes:**
- Browser-side XML parsing via `DOMParser`
- XPath queries for ISO 20022 element extraction
- No server required

---

### 2.2 Blockchain Payment Desk

**Purpose:** Process payments to blockchain addresses with validation, balance check, fee estimation, and transfer execution.

**Layout:**
- Top: Payment details (pre-filled or manual entry)
- Middle: Wallet balance display + chain selection + fee estimation
- Bottom: Transfer confirmation and status progression

**Workflow:**
1. Payment arrives with blockchain address
2. Validate address format (EIP-55 checksum for EVM)
3. **Balance check:** Display available USDC per chain
4. User selects chain (auto-suggested based on address format)
5. Estimate fees → show gas cost comparison across chains
6. Confirm → execute transfer with staged progress:
   - `Checking balance...`
   - `Signing transaction...`
   - `Broadcasting to network...`
   - `Confirmed in block #XX,XXX,XXX`
7. Display transaction hash with explorer link

**Chain Support:**
| Chain | Address Format | Avg Gas (USDC) |
|-------|---------------|----------------|
| Ethereum | 0x... (40 hex) | $2.40 |
| Polygon | 0x... (40 hex) | $0.02 |
| Arbitrum | 0x... (40 hex) | $0.08 |
| Base | 0x... (40 hex) | $0.05 |
| Solana | Base58 (32-44 chars) | $0.001 |

**API Integration:**
- `GET /v1/wallets/{id}/balances` - Fetch USDC balance per chain
- `POST /v1/transfers` - Execute transfer (or mock)

---

### 2.3 Cross-Border Rate Desk

**Purpose:** Compare competing BFI quotes for CPN corridors, demonstrate transparent rate selection.

**Layout:**
- Top: Payment summary bar (amount, corridor)
- Center: Quote cards grid (3-4 BFIs)
- Bottom: Selected quote details + "Lock Rate" action

**Quote Card Contents:**
- BFI partner name
- Exchange rate
- Fee breakdown (network fee + BFI fee)
- **Beneficiary receives:** total in destination currency (highlighted)
- Settlement time estimate
- Quote expiry countdown (30 seconds)
- **Historical context:** Comparison to 24h/7d average rate

**Workflow:**
1. Payment details from context or manual entry
2. Click "Get Quotes" → fetch from CPN API
3. Cards sorted by beneficiary value (best first, badged)
4. Countdown timer with color shift (green → yellow → red)
5. Select quote → expanded fee breakdown
6. "Lock Rate" → capture quote ID, proceed to compliance

**API Integration:**
- `POST /v1/cpn/quotes` - Fetch competing quotes

**Historical Rate Display:**
```
Rate: 17.85 MXN/USD
↑ 0.5% vs 24h avg (17.76)
↓ 0.2% vs 7d avg (17.89)
```

---

### 2.4 Beneficiary Compliance

**Purpose:** Collect and validate travel rule data required for CPN payments, demonstrate encryption.

**Layout:**
- Left panel: Form with originator + beneficiary fields
- Right panel: Live validation status + encryption preview

**Form Sections:**

**Originator (pre-filled):**
- Legal entity name
- Registered address
- Tax ID / LEI
- Wallet address

**Beneficiary:**
- Full legal name (required)
- Residential address: street, city, postal code, country (required)
- ID type: Passport, National ID, Tax ID (dropdown)
- ID number (required, format validated per country)
- Date of birth (required)

**Validation Rules:**
| Country | ID Format |
|---------|-----------|
| Mexico | CURP: 18 alphanumeric / RFC: 12-13 chars |
| Brazil | CPF: 11 digits (XXX.XXX.XXX-XX) |
| Nigeria | NIN: 11 digits |
| Colombia | CC: 6-10 digits |

**Encryption Preview:**
- Toggle to show JWE compact serialization
- Display: algorithm (RSA-OAEP-256), key ID
- Explanation: "Encrypted with Circle's public key. Only Circle and the receiving BFI can decrypt."

**Output:**
- `beneficiaryAccountData` (JWE)
- `travelRuleData` (JWE)

---

### 2.5 Payment Operations Monitor

**Purpose:** Visualize payment progression through CPN's 4-stage lifecycle.

**Layout:**
- Top: Payment header (ID, amount, corridor, beneficiary)
- Center: Horizontal stage pipeline
- Bottom: Event log with timestamps

**Stage Pipeline:**
```
[Quote Locked] → [Payment Created] → [Crypto Confirmed] → [Fiat Settled]
```

Each stage shows:
- Status icon (checkmark, spinner, pending)
- Completion timestamp
- Relevant metadata

**Event Log Format:**
```
HH:MM:SS  event.type              Description
10:42:15  payment.created         Payment accepted, pending BFI approval
10:42:18  payment.bfi_approved    Bitso approved, ready for crypto transfer
10:42:24  crypto.broadcast        Tx 0x8a3f... broadcast to Polygon
10:42:31  crypto.confirmed        Confirmed in block #52,847,102
10:43:45  fiat.initiated          SPEI transfer initiated
10:44:02  payment.completed       Beneficiary received 445,250.00 MXN
```

**Demo Controls:**
- "Simulate Payment" → auto-advance through stages
- Manual stage triggers
- Pause/resume
- Reset

**Timing (simulated):**
| Stage | Duration |
|-------|----------|
| Quote → Created | 2-3 seconds |
| Created → BFI Approved | 3-5 seconds |
| BFI Approved → Crypto Confirmed | 5-10 seconds |
| Crypto Confirmed → Fiat Settled | 15-30 seconds |

---

### 2.6 Treasury Liquidity Dashboard

**Purpose:** Display consolidated USDC positions across blockchains.

**Layout:**
- Top: Aggregate balance card
- Center: Chain breakdown cards (grid)
- Bottom: Rebalancing suggestions + recent activity

**Aggregate Card:**
```
Total USDC Balance: $1,247,500.00
Across 5 chains    ████████████████ 100%
```

**Chain Cards:**
Each displays:
- Chain logo + name
- USDC balance
- Percentage of total (visual bar)
- Average gas cost indicator
- Last activity timestamp

**Rebalancing Panel:**
- Suggested action based on upcoming payment patterns
- Example: "Move $200K from Ethereum → Polygon to reduce fees"
- Estimated savings calculation
- "Simulate Rebalance" → shows CCTP transfer animation

**API Integration:**
- `GET /v1/wallets/{id}/balances` - Per-chain balances
- Mock CCTP for rebalancing simulation

---

## 3. Technical Implementation

### 3.1 HTML Template Structure

Each module follows this template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Module Name] | Circle Payment Factory</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    /* Design tokens + module-specific styles */
  </style>
</head>
<body class="bg-neutral-50 min-h-screen">
  <nav><!-- Back to console + breadcrumb --></nav>
  <main x-data="moduleState()">
    <!-- Module content -->
  </main>
  <script>
    // Module logic
    function moduleState() {
      return {
        // Alpine.js reactive state
      }
    }
  </script>
</body>
</html>
```

### 3.2 pain.001.001.03 Parsing

Key XML paths for extraction:

```javascript
const PAIN001_PATHS = {
  messageId: '//Document/CstmrCdtTrfInitn/GrpHdr/MsgId',
  creationDateTime: '//Document/CstmrCdtTrfInitn/GrpHdr/CreDtTm',
  numberOfTransactions: '//Document/CstmrCdtTrfInitn/GrpHdr/NbOfTxs',
  controlSum: '//Document/CstmrCdtTrfInitn/GrpHdr/CtrlSum',
  payments: '//Document/CstmrCdtTrfInitn/PmtInf',

  // Per payment
  paymentId: 'PmtInfId',
  debtorName: 'Dbtr/Nm',
  debtorAccount: 'DbtrAcct/Id/IBAN',

  // Per transaction within payment
  transactions: 'CdtTrfTxInf',
  endToEndId: 'PmtId/EndToEndId',
  amount: 'Amt/InstdAmt',
  currency: 'Amt/InstdAmt/@Ccy',
  creditorName: 'Cdtr/Nm',
  creditorAccount: 'CdtrAcct/Id/IBAN | CdtrAcct/Id/Othr/Id',
  creditorCountry: 'Cdtr/PstlAdr/Ctry',
  remittanceInfo: 'RmtInf/Ustrd'
};
```

### 3.3 Address Validation

```javascript
function validateBlockchainAddress(address) {
  // EVM (Ethereum, Polygon, Arbitrum, Base)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: verifyEIP55Checksum(address), chain: 'EVM' };
  }

  // Solana
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { valid: true, chain: 'SOL' }; // Base58 check
  }

  return { valid: false, chain: null };
}

function verifyEIP55Checksum(address) {
  // Implement EIP-55 checksum verification
  const addr = address.slice(2).toLowerCase();
  const hash = keccak256(addr);

  for (let i = 0; i < 40; i++) {
    const hashByte = parseInt(hash[i], 16);
    const addrChar = address[i + 2];

    if (hashByte > 7 && addrChar !== addrChar.toUpperCase()) return false;
    if (hashByte <= 7 && addrChar !== addrChar.toLowerCase()) return false;
  }
  return true;
}
```

### 3.4 CPN Corridor Detection

```javascript
const CPN_CORRIDORS = {
  // Source country → [destination countries]
  'US': ['MX', 'BR', 'CO', 'NG', 'HK', 'CN', 'IN', 'PH'],
  'GB': ['MX', 'BR', 'NG', 'IN', 'PH'],
  'EU': ['MX', 'BR', 'CO', 'NG']  // AT, BE, DE, ES, FR, etc.
};

const CPN_CURRENCY_PAIRS = [
  { source: 'USD', destination: 'MXN', corridor: 'US-MX' },
  { source: 'USD', destination: 'BRL', corridor: 'US-BR' },
  { source: 'USD', destination: 'COP', corridor: 'US-CO' },
  { source: 'USD', destination: 'NGN', corridor: 'US-NG' },
  { source: 'USD', destination: 'HKD', corridor: 'US-HK' },
  { source: 'USD', destination: 'CNY', corridor: 'US-CN' },
  { source: 'EUR', destination: 'MXN', corridor: 'EU-MX' },
  { source: 'EUR', destination: 'BRL', corridor: 'EU-BR' },
  { source: 'GBP', destination: 'NGN', corridor: 'GB-NG' }
];

function isCPNEligible(payment) {
  const destCountry = payment.creditorCountry;
  const sourceCurrency = payment.currency;

  return CPN_CURRENCY_PAIRS.some(pair =>
    pair.source === sourceCurrency &&
    pair.corridor.endsWith(destCountry)
  );
}
```

---

## 4. Circle API Integration

### 4.1 API Configuration

```javascript
const CIRCLE_CONFIG = {
  baseUrl: 'https://api.circle.com',      // Production
  // baseUrl: 'https://api-sandbox.circle.com',  // Sandbox
  apiKey: null,  // Set at runtime

  endpoints: {
    wallets: '/v1/wallets',
    balances: '/v1/wallets/{walletId}/balances',
    transfers: '/v1/transfers',
    cpnQuotes: '/v1/cpn/quotes',
    cpnPayments: '/v1/cpn/payments'
  }
};

async function circleAPI(endpoint, options = {}) {
  const url = `${CIRCLE_CONFIG.baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CIRCLE_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new CircleAPIError(response.status, await response.json());
  }

  return response.json();
}
```

### 4.2 API Key Input

Each module includes an API key configuration panel:

```html
<div x-show="!apiKeyConfigured" class="bg-amber-50 border border-amber-200 p-4 rounded-lg">
  <h3 class="font-medium text-amber-800">Circle API Configuration</h3>
  <p class="text-sm text-amber-700 mt-1">Enter your Circle API key to use live data, or continue with mock data.</p>
  <div class="mt-3 flex gap-2">
    <input type="password" x-model="apiKey" placeholder="Enter API key"
           class="flex-1 px-3 py-2 border rounded">
    <button @click="configureAPI()" class="px-4 py-2 bg-blue-600 text-white rounded">
      Connect
    </button>
    <button @click="useMockData()" class="px-4 py-2 border rounded">
      Use Mock Data
    </button>
  </div>
</div>
```

### 4.3 Fallback Strategy

```javascript
async function fetchWithFallback(apiCall, mockData) {
  if (!CIRCLE_CONFIG.apiKey) {
    console.log('Using mock data (no API key)');
    return mockData;
  }

  try {
    return await apiCall();
  } catch (error) {
    console.warn('API call failed, falling back to mock:', error);
    return mockData;
  }
}
```

---

## 5. Mock Data Strategy

### 5.1 Sample pain.001 Files

**pain001-mixed.xml** - 5 payments demonstrating all routing paths:

| # | Creditor | Account | Amount | Country | Route |
|---|----------|---------|--------|---------|-------|
| 1 | Proveedor Azteca SA | MXIBAN... | 25,000 USD | MX | CPN |
| 2 | Comercio Brasil Ltda | BRIBAN... | 15,000 USD | BR | CPN |
| 3 | DeFi Protocol Ltd | 0x742d35Cc... | 10,000 USDC | - | Blockchain |
| 4 | Acme UK Ltd | GB82WEST... | 50,000 GBP | GB | SWIFT |
| 5 | Euro Supplies GmbH | DE89370... | 30,000 EUR | DE | SEPA |

### 5.2 Mock BFI Quotes

```javascript
const MOCK_QUOTES = {
  'US-MX': [
    {
      quoteId: 'q-bitso-001',
      bfiName: 'Bitso',
      rate: 17.85,
      fee: 25.00,
      totalReceived: 445625.00,
      settlementMinutes: 15,
      historicalComparison: { vs24h: +0.5, vs7d: -0.2 }
    },
    {
      quoteId: 'q-mercado-002',
      bfiName: 'Mercado Pago',
      rate: 17.82,
      fee: 15.00,
      totalReceived: 445485.00,
      settlementMinutes: 20,
      historicalComparison: { vs24h: +0.3, vs7d: -0.4 }
    },
    {
      quoteId: 'q-ripio-003',
      bfiName: 'Ripio',
      rate: 17.88,
      fee: 30.00,
      totalReceived: 445670.00,
      settlementMinutes: 12,
      historicalComparison: { vs24h: +0.7, vs7d: +0.1 }
    }
  ],
  'US-BR': [
    // Similar structure for Brazil corridor
  ]
};
```

### 5.3 Mock Wallet Balances

```javascript
const MOCK_BALANCES = {
  walletId: 'wallet-corp-001',
  totalUSDC: 1247500.00,
  chains: [
    { chain: 'ETH', balance: 850000.00, percentage: 68, avgGas: 2.40, lastActivity: '2026-01-16T09:30:00Z' },
    { chain: 'MATIC', balance: 245000.00, percentage: 20, avgGas: 0.02, lastActivity: '2026-01-16T10:15:00Z' },
    { chain: 'ARB', balance: 102500.00, percentage: 8, avgGas: 0.08, lastActivity: '2026-01-15T14:22:00Z' },
    { chain: 'BASE', balance: 35000.00, percentage: 3, avgGas: 0.05, lastActivity: '2026-01-14T11:45:00Z' },
    { chain: 'SOL', balance: 15000.00, percentage: 1, avgGas: 0.001, lastActivity: '2026-01-13T16:00:00Z' }
  ]
};
```

---

## 6. Hosting & Deployment

### 6.1 GitHub Pages Configuration

**Repository settings:**
- Source: Deploy from branch `main`, root directory `/`
- Custom domain: Optional

**Required files:**
- `.nojekyll` - Prevents Jekyll processing (allows underscore-prefixed files)
- `README.md` - Setup instructions

### 6.2 README.md Content

```markdown
# Circle Payment Factory POC

Proof of concept demonstrating Circle API integration with ISO 20022 pain.001.001.03 payment files.

## Live Demo

https://[username].github.io/circle-integration/

## Modules

1. **Payment File Processor** - Parse pain.001 files, route to Circle or traditional rails
2. **Blockchain Payment Desk** - Direct USDC transfers to wallet addresses
3. **Cross-Border Rate Desk** - Compare BFI quotes for CPN corridors
4. **Beneficiary Compliance** - Travel rule data collection and encryption
5. **Payment Operations Monitor** - Track settlement lifecycle
6. **Treasury Liquidity Dashboard** - Multi-chain USDC balance view

## Configuration

Each module can operate in two modes:

1. **Live Mode** - Enter your Circle API key for real API calls
2. **Mock Mode** - Use pre-configured sample data for demonstrations

## Local Development

No build step required. Simply serve the files:

\`\`\`bash
# Python
python -m http.server 8000

# Node.js
npx serve .
\`\`\`

Then open http://localhost:8000

## Circle API Documentation

- [Circle Developers](https://developers.circle.com)
- [CPN API Reference](https://developers.circle.com/cpn/reference)
- [Circle Mint](https://developers.circle.com/circle-mint)
```

### 6.3 Deployment Checklist

- [ ] All HTML files valid and self-contained
- [ ] CDN dependencies accessible
- [ ] Mock data works without API key
- [ ] API key input functional
- [ ] Navigation between modules works
- [ ] Mobile-responsive layout
- [ ] `.nojekyll` file present
- [ ] `README.md` complete

---

## Appendix A: pain.001.001.03 Reference

### Namespace
```xml
xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
```

### Key Elements

| Element | Path | Description |
|---------|------|-------------|
| Message ID | GrpHdr/MsgId | Unique message identifier |
| Creation Date | GrpHdr/CreDtTm | ISO 8601 timestamp |
| Number of Transactions | GrpHdr/NbOfTxs | Total payment count |
| Control Sum | GrpHdr/CtrlSum | Sum of all amounts |
| Debtor Name | PmtInf/Dbtr/Nm | Sending party name |
| Debtor Account | PmtInf/DbtrAcct/Id/IBAN | Sending account |
| Creditor Name | CdtTrfTxInf/Cdtr/Nm | Receiving party name |
| Creditor Account | CdtTrfTxInf/CdtrAcct/Id/IBAN | Receiving account (or Othr/Id for non-IBAN) |
| Amount | CdtTrfTxInf/Amt/InstdAmt | Payment amount with @Ccy attribute |
| Country | CdtTrfTxInf/Cdtr/PstlAdr/Ctry | ISO 3166-1 alpha-2 |

---

## Appendix B: Circle CPN API Summary

### Create Quote
```
POST /v1/cpn/quotes

Required:
- senderCountry (ISO 3166-1 alpha-2)
- sourceAmount { amount, currency }
- destinationCountry
- destinationAmount { amount, currency }
- blockchain (SOL, MATIC, ETH)
- senderType (BUSINESS, INDIVIDUAL)
- recipientType (BUSINESS, INDIVIDUAL)

Response: Array of quotes with rates, fees, settlement times
```

### Create Payment
```
POST /v1/cpn/payments

Required:
- quoteId (from quote response)
- idempotencyKey (UUID v4)
- beneficiaryAccountData (JWE encrypted)
- travelRuleData (JWE encrypted)
- senderAddress (wallet address)
- blockchain
- refundAddress
- useCase (B2B, B2C, C2C, C2B)
- reasonForPayment (PMT001-PMT030)

Response: Payment object with status, IDs, fee breakdown
```

---

**Document History:**
- 2026-01-16: Initial version (v1.0) - Full POC design from brainstorming session
