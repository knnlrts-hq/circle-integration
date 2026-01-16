/**
 * Circle Payment Factory POC - Mock Data
 * Shared mock data for all modules when Circle API is not available
 */

const MOCK_DATA = {
  // Corporate originator details
  originator: {
    name: 'Acme Corporation',
    address: '123 Financial District, New York, NY 10004, USA',
    taxId: '12-3456789',
    lei: '549300EXAMPLE0001',
    walletAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72'
  },

  // Wallet balances across chains
  balances: {
    walletId: 'wallet-corp-001',
    totalUSDC: 1247500.00,
    chains: [
      {
        chain: 'ETH',
        chainName: 'Ethereum',
        balance: 850000.00,
        percentage: 68.1,
        avgGas: 2.40,
        lastActivity: '2026-01-16T09:30:00Z',
        color: '#627EEA'
      },
      {
        chain: 'MATIC',
        chainName: 'Polygon',
        balance: 245000.00,
        percentage: 19.6,
        avgGas: 0.02,
        lastActivity: '2026-01-16T10:15:00Z',
        color: '#8247E5'
      },
      {
        chain: 'ARB',
        chainName: 'Arbitrum',
        balance: 102500.00,
        percentage: 8.2,
        avgGas: 0.08,
        lastActivity: '2026-01-15T14:22:00Z',
        color: '#28A0F0'
      },
      {
        chain: 'BASE',
        chainName: 'Base',
        balance: 35000.00,
        percentage: 2.8,
        avgGas: 0.05,
        lastActivity: '2026-01-14T11:45:00Z',
        color: '#0052FF'
      },
      {
        chain: 'SOL',
        chainName: 'Solana',
        balance: 15000.00,
        percentage: 1.2,
        avgGas: 0.001,
        lastActivity: '2026-01-13T16:00:00Z',
        color: '#00FFA3'
      }
    ]
  },

  // BFI quotes by corridor
  quotes: {
    'US-MX': [
      {
        quoteId: 'q-bitso-001',
        bfiName: 'Bitso',
        bfiLogo: 'https://assets.bitso.com/logos/bitso-logo.svg',
        rate: 17.85,
        inverseRate: 0.0560,
        fee: 25.00,
        totalReceived: 445625.00,
        settlementMinutes: 15,
        expiresAt: null, // Set dynamically
        historicalComparison: { vs24h: 0.5, vs7d: -0.2 },
        paymentMethod: 'SPEI'
      },
      {
        quoteId: 'q-mercado-002',
        bfiName: 'Mercado Pago',
        bfiLogo: null,
        rate: 17.82,
        inverseRate: 0.0561,
        fee: 15.00,
        totalReceived: 445485.00,
        settlementMinutes: 20,
        expiresAt: null,
        historicalComparison: { vs24h: 0.3, vs7d: -0.4 },
        paymentMethod: 'SPEI'
      },
      {
        quoteId: 'q-ripio-003',
        bfiName: 'Ripio',
        bfiLogo: null,
        rate: 17.88,
        inverseRate: 0.0559,
        fee: 30.00,
        totalReceived: 445670.00,
        settlementMinutes: 12,
        expiresAt: null,
        historicalComparison: { vs24h: 0.7, vs7d: 0.1 },
        paymentMethod: 'SPEI'
      }
    ],
    'US-BR': [
      {
        quoteId: 'q-nubank-001',
        bfiName: 'Nubank',
        bfiLogo: null,
        rate: 5.92,
        inverseRate: 0.169,
        fee: 20.00,
        totalReceived: 147980.00,
        settlementMinutes: 10,
        expiresAt: null,
        historicalComparison: { vs24h: -0.3, vs7d: 0.8 },
        paymentMethod: 'PIX'
      },
      {
        quoteId: 'q-btgpactual-002',
        bfiName: 'BTG Pactual',
        bfiLogo: null,
        rate: 5.89,
        inverseRate: 0.170,
        fee: 35.00,
        totalReceived: 147215.00,
        settlementMinutes: 15,
        expiresAt: null,
        historicalComparison: { vs24h: -0.5, vs7d: 0.5 },
        paymentMethod: 'PIX'
      }
    ],
    'US-NG': [
      {
        quoteId: 'q-flutterwave-001',
        bfiName: 'Flutterwave',
        bfiLogo: null,
        rate: 1580.50,
        inverseRate: 0.000633,
        fee: 50.00,
        totalReceived: 39462500.00,
        settlementMinutes: 30,
        expiresAt: null,
        historicalComparison: { vs24h: 1.2, vs7d: 2.5 },
        paymentMethod: 'BANK-TRANSFER'
      }
    ],
    'US-CO': [
      {
        quoteId: 'q-bold-001',
        bfiName: 'Bold',
        bfiLogo: null,
        rate: 4250.00,
        inverseRate: 0.000235,
        fee: 25.00,
        totalReceived: 106225000.00,
        settlementMinutes: 20,
        expiresAt: null,
        historicalComparison: { vs24h: 0.2, vs7d: -0.8 },
        paymentMethod: 'BANK-TRANSFER'
      }
    ]
  },

  // CPN supported corridors
  corridors: {
    'US': ['MX', 'BR', 'CO', 'NG', 'HK', 'CN', 'IN', 'PH'],
    'GB': ['MX', 'BR', 'NG', 'IN', 'PH'],
    'EU': ['MX', 'BR', 'CO', 'NG']
  },

  // Currency pairs
  currencyPairs: [
    { source: 'USD', destination: 'MXN', corridor: 'US-MX', symbol: '$', destSymbol: 'MX$' },
    { source: 'USD', destination: 'BRL', corridor: 'US-BR', symbol: '$', destSymbol: 'R$' },
    { source: 'USD', destination: 'COP', corridor: 'US-CO', symbol: '$', destSymbol: 'COL$' },
    { source: 'USD', destination: 'NGN', corridor: 'US-NG', symbol: '$', destSymbol: 'N' },
    { source: 'USD', destination: 'HKD', corridor: 'US-HK', symbol: '$', destSymbol: 'HK$' },
    { source: 'USD', destination: 'CNY', corridor: 'US-CN', symbol: '$', destSymbol: 'CN¥' },
    { source: 'EUR', destination: 'MXN', corridor: 'EU-MX', symbol: 'E', destSymbol: 'MX$' },
    { source: 'GBP', destination: 'NGN', corridor: 'GB-NG', symbol: '£', destSymbol: 'N' }
  ],

  // Country information
  countries: {
    'MX': { name: 'Mexico', currency: 'MXN', flag: 'MX', idFormat: 'CURP/RFC', idPattern: /^[A-Z]{4}\d{6}[A-Z]{6}\d{2}$|^[A-Z&]{3,4}\d{6}[A-Z0-9]{3}$/ },
    'BR': { name: 'Brazil', currency: 'BRL', flag: 'BR', idFormat: 'CPF', idPattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/ },
    'CO': { name: 'Colombia', currency: 'COP', flag: 'CO', idFormat: 'CC', idPattern: /^\d{6,10}$/ },
    'NG': { name: 'Nigeria', currency: 'NGN', flag: 'NG', idFormat: 'NIN', idPattern: /^\d{11}$/ },
    'HK': { name: 'Hong Kong', currency: 'HKD', flag: 'HK', idFormat: 'HKID', idPattern: /^[A-Z]{1,2}\d{6}\([0-9A]\)$/ },
    'CN': { name: 'China', currency: 'CNY', flag: 'CN', idFormat: 'ID Card', idPattern: /^\d{18}$|^\d{15}$/ },
    'IN': { name: 'India', currency: 'INR', flag: 'IN', idFormat: 'Aadhaar/PAN', idPattern: /^\d{12}$|^[A-Z]{5}\d{4}[A-Z]$/ },
    'PH': { name: 'Philippines', currency: 'PHP', flag: 'PH', idFormat: 'TIN', idPattern: /^\d{9,12}$/ },
    'US': { name: 'United States', currency: 'USD', flag: 'US', idFormat: 'SSN/EIN', idPattern: /^\d{9}$/ },
    'GB': { name: 'United Kingdom', currency: 'GBP', flag: 'GB', idFormat: 'NI Number', idPattern: /^[A-Z]{2}\d{6}[A-Z]$/ },
    'DE': { name: 'Germany', currency: 'EUR', flag: 'DE', idFormat: 'Tax ID', idPattern: /^\d{11}$/ }
  },

  // Sample payment lifecycle events
  paymentEvents: [
    { timestamp: '10:42:15', type: 'payment.created', description: 'Payment accepted, pending BFI approval', status: 'completed' },
    { timestamp: '10:42:18', type: 'payment.bfi_approved', description: 'Bitso approved, ready for crypto transfer', status: 'completed' },
    { timestamp: '10:42:24', type: 'crypto.broadcast', description: 'Tx 0x8a3f...7d2e broadcast to Polygon', status: 'completed' },
    { timestamp: '10:42:31', type: 'crypto.confirmed', description: 'Confirmed in block #52,847,102', status: 'completed' },
    { timestamp: '10:43:45', type: 'fiat.initiated', description: 'SPEI transfer initiated', status: 'completed' },
    { timestamp: '10:44:02', type: 'payment.completed', description: 'Beneficiary received 445,250.00 MXN', status: 'completed' }
  ],

  // Sample parsed payments from pain.001
  parsedPayments: [
    {
      id: 'PMT-001',
      endToEndId: 'E2E-2026011601',
      creditorName: 'Proveedor Azteca SA de CV',
      creditorAccount: 'MX12345678901234567890',
      creditorCountry: 'MX',
      amount: 25000.00,
      currency: 'USD',
      route: 'CPN',
      routeReason: 'Destination country Mexico + USD→MXN = CPN corridor supported'
    },
    {
      id: 'PMT-002',
      endToEndId: 'E2E-2026011602',
      creditorName: 'Comercio Brasil Ltda',
      creditorAccount: 'BR1234567890123456789012345',
      creditorCountry: 'BR',
      amount: 15000.00,
      currency: 'USD',
      route: 'CPN',
      routeReason: 'Destination country Brazil + USD→BRL = CPN corridor supported'
    },
    {
      id: 'PMT-003',
      endToEndId: 'E2E-2026011603',
      creditorName: 'DeFi Protocol Ltd',
      creditorAccount: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      creditorCountry: null,
      amount: 10000.00,
      currency: 'USDC',
      route: 'Blockchain',
      routeReason: 'Creditor account matches EVM blockchain address pattern (0x...)'
    },
    {
      id: 'PMT-004',
      endToEndId: 'E2E-2026011604',
      creditorName: 'Acme UK Limited',
      creditorAccount: 'GB82WEST12345698765432',
      creditorCountry: 'GB',
      amount: 50000.00,
      currency: 'GBP',
      route: 'Traditional',
      routeReason: 'GBP to UK - no CPN corridor, route via SWIFT'
    },
    {
      id: 'PMT-005',
      endToEndId: 'E2E-2026011605',
      creditorName: 'Euro Supplies GmbH',
      creditorAccount: 'DE89370400440532013000',
      creditorCountry: 'DE',
      amount: 30000.00,
      currency: 'EUR',
      route: 'Traditional',
      routeReason: 'EUR to Germany - route via SEPA'
    }
  ],

  // Fee estimates per chain
  feeEstimates: {
    ETH: { gas: 2.40, time: '~2 min', congestion: 'normal' },
    MATIC: { gas: 0.02, time: '~30 sec', congestion: 'low' },
    ARB: { gas: 0.08, time: '~30 sec', congestion: 'low' },
    BASE: { gas: 0.05, time: '~30 sec', congestion: 'low' },
    SOL: { gas: 0.001, time: '~1 sec', congestion: 'low' }
  },

  // Rebalancing suggestions
  rebalancingSuggestions: [
    {
      action: 'Move $200,000 from Ethereum to Polygon',
      reason: 'Upcoming Mexico payments batch will use Polygon for lower fees',
      estimatedSavings: '$47.60 per 100 transfers',
      priority: 'high'
    },
    {
      action: 'Move $50,000 from Ethereum to Arbitrum',
      reason: 'Maintain operational float for ad-hoc transfers',
      estimatedSavings: '$23.20 per 100 transfers',
      priority: 'medium'
    }
  ]
};

// Helper functions
const MockDataHelpers = {
  /**
   * Get quotes for a corridor with dynamic expiry times
   */
  getQuotes(corridor, sourceAmount = 25000) {
    const quotes = MOCK_DATA.quotes[corridor] || [];
    const now = new Date();

    return quotes.map(q => ({
      ...q,
      expiresAt: new Date(now.getTime() + 30000).toISOString(), // 30 seconds from now
      totalReceived: (sourceAmount - q.fee) * q.rate
    }));
  },

  /**
   * Check if a corridor is CPN eligible
   */
  isCPNEligible(sourceCountry, destCountry) {
    const corridors = MOCK_DATA.corridors[sourceCountry];
    return corridors && corridors.includes(destCountry);
  },

  /**
   * Detect payment route based on account format
   */
  detectRoute(account, destCountry, currency) {
    // Check for EVM blockchain address
    if (/^0x[a-fA-F0-9]{40}$/.test(account)) {
      return { route: 'Blockchain', chain: 'EVM', reason: 'Creditor account matches EVM blockchain address pattern (0x...)' };
    }

    // Check for Solana address
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(account) && !account.includes(' ')) {
      return { route: 'Blockchain', chain: 'SOL', reason: 'Creditor account matches Solana address pattern (Base58)' };
    }

    // Check for CPN eligibility
    if (this.isCPNEligible('US', destCountry)) {
      return { route: 'CPN', reason: `Destination country ${destCountry} + ${currency} = CPN corridor supported` };
    }

    // Default to traditional
    return { route: 'Traditional', reason: 'No Circle route available, use traditional banking rails' };
  },

  /**
   * Format currency amount
   */
  formatAmount(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  },

  /**
   * Validate blockchain address checksum (EIP-55)
   */
  validateEVMAddress(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { valid: false, error: 'Invalid address format' };
    }
    // Simplified checksum validation (in production, use proper keccak256)
    return { valid: true };
  }
};

// Export for use in modules
if (typeof window !== 'undefined') {
  window.MOCK_DATA = MOCK_DATA;
  window.MockDataHelpers = MockDataHelpers;
}
