# 📈 Serverless Git-Ops Trading Simulator

A powerful, entirely serverless trading simulator built for multi-currency portfolios (US Stocks, Crypto, and IHSG) with **IDR (Indonesian Rupiah)** as the master base currency. 

It uses a unique Git-Ops architecture: JSON files act as your database, GitHub Actions serves as your backend engine, and a Vite/React application provides a live, dynamic dashboard.

## 🌟 Key Features

*   **IDR Base Currency & Forex Time-Machine:** All USD assets (Stocks, Crypto) are dynamically converted to IDR. The Python engine fetches the *exact historical USDIDR exchange rate* for the day a trade occurred to determine a precise cost basis.
*   **FIFO Capital Gains:** Accurately tracks realized Profit and Loss (PnL) using First-In-First-Out matching logic.
*   **Live Market Data:** Fetches real-time price quotes directly from Yahoo Finance via a proxy (bypassing CORS) for an always up-to-date portfolio valuation.
*   **Phantom Auto-Execution:** The backend engine checks daily High/Low prices against your active positions. If a Stop Loss (SL), Take Profit (TP), or Trailing Stop is breached, it automatically executes the sell and updates your ledger.
*   **Conditional / Pending Orders:** Set "Support Buy" (buy when price drops to X) or "Breakout Buy" (buy when price crosses X) orders. The system will auto-fill them when live or historical data confirms the price hit the trigger.
*   **Zero Backend Infrastructure:** No database or traditional server required. Runs 100% locally or via GitHub Actions.

---

## 🏗 Architecture

The system consists of two primary components operating on the same JSON files:

1.  **The React Dashboard (`/dashboard`)**: A Vite + React + TypeScript frontend. When run locally, it serves as your trading terminal. You can execute market orders or place pending conditional orders. It reads and writes directly to local JSON files (`journal.json`, `pending_orders.json`) via a Vite dev-server API.
2.  **The Python Engine (`engine.py`)**: A backend script intended to run periodically (e.g., via GitHub Actions cron jobs). It acts as the "clearing house", checking for triggered pending orders or Stop Loss / Take Profit breaches on daily candles, executing them, and generating state cache files.

### Data Flow

*   **`journal.json`**: The append-only event ledger. All buys, sells, deposits, and withdrawals go here.
*   **`pending_orders.json`**: Active conditional orders waiting for a price trigger.
*   **`watchlist.json`**: Tickers you want to track on the dashboard side-panel.

---

## 🚀 How to Start (Local Development)

### Prerequisites
*   **Node.js** (v18+) & **npm**
*   **Python 3.10+** & **pip**

### 1. Start the Live Dashboard
The dashboard provides a premium, glassmorphism UI for live trading and portfolio tracking. It automatically loads your local JSON files.

```bash
# Navigate to the dashboard directory
cd dashboard

# Install dependencies (only needed once)
npm install

# Start the Vite development server
npm run dev
```
Open your browser to `http://localhost:5173/`. You can now place trades, add pending orders, and watch live PnL.

### 2. Run the Engine Manually
To process historical FIFO matching, trigger phantom orders (SL/TP), and generate cached state, run the Python engine.

```bash
# Navigate to the project root
cd ..

# Install Python dependencies (only needed once)
pip install yfinance

# Run the engine
python engine.py
```
*Note: The React dashboard also has an internal JavaScript port of the FIFO engine to calculate live portfolio state instantly, but running the Python script ensures phantom orders on daily candle data are executed and logged.*

---

## ☁️ Deployment (GitHub Actions)

This repository is pre-configured for a "Serverless Git-Ops" deployment.

1.  Push this entire repository to GitHub as a **Public** repository.
2.  The workflow in `.github/workflows/engine.yml` will automatically trigger:
    *   On every push to `main` (e.g., when you edit `journal.json` or `watchlist.json`).
    *   On a Cron schedule (03:00, 12:00, and 17:00 WIB).
3.  The workflow runs `engine.py` using GitHub's runners, checks for SL/TP execution, processes pending orders, and calculates your full portfolio state.
4.  It automatically publishes the computed output (`portfolio_state.json`, `performance_metrics.json`, etc.) to an isolated `data-cache` branch.

### ⚡ Quick View (Read-Only Mode)
If deployed to GitHub, you can use the `index.html` file in the root directory as a lightweight, read-only viewer. It fetches the cached JSON files directly from your raw GitHub `data-cache` branch URLs.

---

## 📁 File Structure

```text
.
├── dashboard/               # Vite/React Application (Frontend)
│   ├── src/                 # React components, Engine port, Types
│   └── vite.config.ts       # Local file API and Yahoo Finance proxy
├── engine.py                # Python clearing-house & FIFO calculator
├── journal.json             # Core database: Event-sourced trading ledger
├── pending_orders.json      # Database: Active conditional orders
├── watchlist.json           # Database: Tracked ticker symbols
├── index.html               # Read-only Quick View static page
└── .github/workflows/       # GitHub Actions automation
```