/**
 * Circle Payment Factory POC - Circle API Wrapper
 * Handles API calls with fallback to mock data
 */

const CircleAPI = {
  config: {
    baseUrl: 'https://api.circle.com',
    sandboxUrl: 'https://api-sandbox.circle.com',
    apiKey: null,
    useMock: true
  },

  /**
   * Initialize API configuration from localStorage
   */
  init() {
    const stored = localStorage.getItem('circleConfig');
    if (stored) {
      const config = JSON.parse(stored);
      this.config.apiKey = config.apiKey;
      this.config.useMock = config.mode === 'mock';
    }
    return this;
  },

  /**
   * Check if we're using live API
   */
  isLive() {
    return !this.config.useMock && this.config.apiKey;
  },

  /**
   * Make an API request
   */
  async request(endpoint, options = {}) {
    if (this.config.useMock) {
      console.log('[CircleAPI] Mock mode - returning mock data for:', endpoint);
      return null; // Caller should handle mock fallback
    }

    const url = `${this.config.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CircleAPIError(response.status, error);
      }

      return response.json();
    } catch (error) {
      console.error('[CircleAPI] Request failed:', error);
      throw error;
    }
  },

  /**
   * Wallet APIs
   */
  wallets: {
    async getBalances(walletId) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        return MOCK_DATA.balances;
      }

      const response = await api.request(`/v1/wallets/${walletId}/balances`);
      return response.data;
    },

    async estimateFee(params) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        const chain = params.blockchain || 'ETH';
        return MOCK_DATA.feeEstimates[chain];
      }

      const response = await api.request('/v1/transfers/estimateFee', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      return response.data;
    },

    async createTransfer(params) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        // Simulate transfer creation
        return {
          id: `transfer-${Date.now()}`,
          status: 'pending',
          createDate: new Date().toISOString(),
          ...params
        };
      }

      const response = await api.request('/v1/transfers', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      return response.data;
    }
  },

  /**
   * CPN APIs
   */
  cpn: {
    async createQuote(params) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        const corridor = `${params.senderCountry}-${params.destinationCountry}`;
        return MockDataHelpers.getQuotes(corridor, parseFloat(params.sourceAmount.amount));
      }

      const response = await api.request('/v1/cpn/quotes', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      return response.data;
    },

    async createPayment(params) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        return {
          id: `cpn-payment-${Date.now()}`,
          status: 'pending',
          createDate: new Date().toISOString(),
          quoteId: params.quoteId,
          sourceAmount: params.sourceAmount,
          destinationAmount: params.destinationAmount
        };
      }

      const response = await api.request('/v1/cpn/payments', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      return response.data;
    },

    async getPayment(paymentId) {
      const api = CircleAPI.init();
      if (!api.isLive()) {
        return {
          id: paymentId,
          status: 'completed',
          events: MOCK_DATA.paymentEvents
        };
      }

      const response = await api.request(`/v1/cpn/payments/${paymentId}`);
      return response.data;
    }
  }
};

/**
 * Custom error class for Circle API errors
 */
class CircleAPIError extends Error {
  constructor(status, data) {
    super(data.message || 'Circle API Error');
    this.name = 'CircleAPIError';
    this.status = status;
    this.code = data.code;
    this.data = data;
  }
}

/**
 * Pain.001 XML Parser
 */
const Pain001Parser = {
  /**
   * Parse pain.001.001.03 XML content
   */
  parse(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML: ' + parseError.textContent);
    }

    // Extract namespace-aware elements
    const ns = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03';

    const getElement = (parent, localName) => {
      return parent.getElementsByTagNameNS(ns, localName)[0] ||
             parent.getElementsByTagName(localName)[0];
    };

    const getText = (parent, localName) => {
      const el = getElement(parent, localName);
      return el ? el.textContent.trim() : null;
    };

    // Parse group header
    const grpHdr = getElement(doc, 'GrpHdr');
    const header = {
      messageId: getText(grpHdr, 'MsgId'),
      creationDateTime: getText(grpHdr, 'CreDtTm'),
      numberOfTransactions: parseInt(getText(grpHdr, 'NbOfTxs')) || 0,
      controlSum: parseFloat(getText(grpHdr, 'CtrlSum')) || 0
    };

    // Parse payment information blocks
    const pmtInfs = doc.getElementsByTagNameNS(ns, 'PmtInf').length > 0 ?
                    doc.getElementsByTagNameNS(ns, 'PmtInf') :
                    doc.getElementsByTagName('PmtInf');

    const payments = [];

    for (const pmtInf of pmtInfs) {
      const paymentId = getText(pmtInf, 'PmtInfId');
      const debtorName = getText(getElement(pmtInf, 'Dbtr'), 'Nm');

      // Get debtor account (IBAN or other)
      const dbtrAcct = getElement(pmtInf, 'DbtrAcct');
      const debtorAccount = getText(getElement(dbtrAcct, 'Id'), 'IBAN') ||
                           getText(getElement(getElement(dbtrAcct, 'Id'), 'Othr'), 'Id');

      // Parse credit transfer transactions
      const txs = pmtInf.getElementsByTagNameNS(ns, 'CdtTrfTxInf').length > 0 ?
                  pmtInf.getElementsByTagNameNS(ns, 'CdtTrfTxInf') :
                  pmtInf.getElementsByTagName('CdtTrfTxInf');

      for (const tx of txs) {
        const pmtId = getElement(tx, 'PmtId');
        const endToEndId = getText(pmtId, 'EndToEndId');

        // Amount and currency
        const amt = getElement(tx, 'Amt');
        const instdAmt = getElement(amt, 'InstdAmt');
        const amount = parseFloat(instdAmt?.textContent) || 0;
        const currency = instdAmt?.getAttribute('Ccy') || 'USD';

        // Creditor information
        const cdtr = getElement(tx, 'Cdtr');
        const creditorName = getText(cdtr, 'Nm');

        // Creditor address
        const cdtrAdr = getElement(cdtr, 'PstlAdr');
        const creditorCountry = getText(cdtrAdr, 'Ctry');

        // Creditor account
        const cdtrAcct = getElement(tx, 'CdtrAcct');
        const cdtrAcctId = getElement(cdtrAcct, 'Id');
        const creditorAccount = getText(cdtrAcctId, 'IBAN') ||
                               getText(getElement(cdtrAcctId, 'Othr'), 'Id');

        // Remittance information
        const rmtInf = getElement(tx, 'RmtInf');
        const remittanceInfo = getText(rmtInf, 'Ustrd');

        // Determine route
        const routeInfo = MockDataHelpers.detectRoute(creditorAccount, creditorCountry, currency);

        payments.push({
          id: `PMT-${payments.length + 1}`.padStart(7, '0'),
          paymentId,
          endToEndId,
          debtorName,
          debtorAccount,
          creditorName,
          creditorAccount,
          creditorCountry,
          amount,
          currency,
          remittanceInfo,
          route: routeInfo.route,
          routeReason: routeInfo.reason,
          chain: routeInfo.chain || null
        });
      }
    }

    return {
      header,
      payments
    };
  }
};

/**
 * Travel Rule Data Encryption (simplified for POC)
 * In production, use proper JWE with Circle's public key
 */
const TravelRuleEncryption = {
  /**
   * Encrypt travel rule data (mock implementation)
   */
  async encrypt(data) {
    // In production, this would use Circle's public key for JWE encryption
    const jsonData = JSON.stringify(data);
    const base64 = btoa(unescape(encodeURIComponent(jsonData)));

    // Return mock JWE format
    return {
      jwe: `eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0.${base64.substring(0, 50)}...encrypted`,
      algorithm: 'RSA-OAEP-256',
      keyId: 'circle-pub-key-001',
      preview: this.getPreview(data)
    };
  },

  /**
   * Get a preview of the data structure (for UI display)
   */
  getPreview(data) {
    return {
      originator: {
        name: data.originator?.name ? '***' + data.originator.name.slice(-4) : null,
        country: data.originator?.country
      },
      beneficiary: {
        name: data.beneficiary?.name ? '***' + data.beneficiary.name.slice(-4) : null,
        country: data.beneficiary?.country
      },
      fieldsEncrypted: Object.keys(data.beneficiary || {}).length
    };
  }
};

// Export for use in modules
if (typeof window !== 'undefined') {
  window.CircleAPI = CircleAPI;
  window.CircleAPIError = CircleAPIError;
  window.Pain001Parser = Pain001Parser;
  window.TravelRuleEncryption = TravelRuleEncryption;
}
