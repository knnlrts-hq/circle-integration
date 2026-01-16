# Circle Payment Factory POC

Proof of concept demonstrating Circle API integration with ISO 20022 pain.001.001.03 payment files for corporate payment factory applications.

## Live Demo

Deploy to GitHub Pages and access at: `https://[username].github.io/circle-integration/`

## Modules

| Module | Description |
|--------|-------------|
| **Payment File Processor** | Parse pain.001.001.03 XML files and route payments to Circle or traditional rails |
| **Blockchain Payment Desk** | Execute direct USDC transfers to blockchain wallet addresses |
| **Cross-Border Rate Desk** | Compare BFI quotes for CPN cross-border payment corridors |
| **Beneficiary Compliance** | Collect and encrypt travel rule data for CPN regulatory compliance |
| **Payment Operations Monitor** | Track payment settlement through CPN's 4-stage lifecycle |
| **Treasury Liquidity Dashboard** | View consolidated USDC positions across multiple blockchains |

## Features

- **pain.001.001.03 Parsing**: Browser-side XML parsing with automatic routing detection
- **CPN Integration**: Full Circle Payments Network quote and payment flow
- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Base, and Solana
- **Travel Rule Compliance**: Data collection and encryption for regulatory requirements
- **Real-Time Monitoring**: Webhook event simulation and payment lifecycle tracking
- **Treasury Management**: Multi-chain balance aggregation with rebalancing suggestions

## Configuration

Each module supports two modes:

1. **Live Mode** - Enter your Circle API key for real API calls
2. **Mock Mode** - Use pre-configured sample data for demonstrations

The API key is stored in browser localStorage and shared across all modules.

## Local Development

No build step required. Simply serve the files with any static server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open http://localhost:8000

## Project Structure

```
/
├── index.html                      # Payment Factory Console (landing page)
├── modules/
│   ├── payment-file-processor/     # pain.001 parsing & routing
│   ├── blockchain-payment-desk/    # Direct USDC transfers
│   ├── cross-border-rate-desk/     # BFI quote comparison
│   ├── beneficiary-compliance/     # Travel rule data
│   ├── payment-operations-monitor/ # Settlement lifecycle
│   └── treasury-liquidity-dashboard/ # Multi-chain balances
├── shared/
│   ├── mock-data.js               # Shared mock data
│   ├── circle-api.js              # Circle API wrapper
│   └── samples/                   # Sample pain.001 XML files
└── docs/
    └── plans/                     # Design documentation
```

## Supported CPN Corridors

| Source | Destinations |
|--------|-------------|
| US (USD) | Mexico, Brazil, Colombia, Nigeria, Hong Kong, China |
| UK (GBP) | Mexico, Brazil, Nigeria, India, Philippines |
| EU (EUR) | Mexico, Brazil, Colombia, Nigeria |

## Technology Stack

- **Tailwind CSS** - Utility-first styling (CDN)
- **Alpine.js** - Lightweight reactivity (CDN)
- **Prism.js** - Syntax highlighting (CDN)
- **Vanilla JavaScript** - No build step required

## Circle API Documentation

- [Circle Developers Portal](https://developers.circle.com)
- [CPN API Reference](https://developers.circle.com/cpn/reference)
- [Circle Mint Documentation](https://developers.circle.com/circle-mint)
- [Wallets API](https://developers.circle.com/w3s/docs)

## Design Document

See [docs/plans/2026-01-16-circle-payment-factory-poc-design.md](docs/plans/2026-01-16-circle-payment-factory-poc-design.md) for the complete design specification.

## License

This is a proof of concept for demonstration purposes.
