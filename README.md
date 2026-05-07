# PortfolioPulse — Interactive Portfolio Diversification Storytelling App

PortfolioPulse is an interactive financial visualization project that transforms portfolio theory into a cinematic storytelling experience.

Instead of presenting investing concepts through static formulas, the app uses interactive charts, behavioral finance narratives, and portfolio analytics to explain one core idea:

> “Diversification is survival.”

The project combines:
- Interactive financial visualizations
- Real historical market behavior
- Modern Portfolio Theory (MPT)
- Behavioral finance storytelling
- Risk analytics
- Narrative-driven UI/UX

---

# Project Goal

This project helps new investor understand:

- Why “ALL-IN” investing is dangerous
- How diversification reduces portfolio risk
- Why correlation matters
- How investor psychology affects decisions
- How efficient portfolios outperform emotional investing

The experience is designed more like an interactive presentation than a traditional dashboard.

---

# Main Features

## 1. Portfolio Builder
Users can:
- Add/remove assets (Only 15 given assets)
- Adjust portfolio allocation
- View dynamic portfolio weights
- Track allocation balance

Components:
- `PortfolioWeights.js`
- `AllocationPieChart.js`
- `AssetPickerModal.js`

---

## 2. Correlation Analysis
Visualizes how assets move relative to each other.

Features:
- Correlation heatmap
- Correlation ranking bars
- Pair scatter plots
- Hedge/risk identification

Components:
- `CorrelationMatrix.js`
- `CorrelationBarChart.js`
- `PairScatterPlot.js`

---

## 3. Risk Visualization
Analyzes portfolio risk through:
- Volatility metrics
- Tail risk (95% VaR)
- Concentration risk
- Risk contribution
- Sector exposure

Components:
- `RiskMeter.js`
- `RiskRadar.js`
- `AssetContribution.js`

---

## 4. Drawdown & Crisis Storytelling
Shows how major assets collapse during market crashes.

Features:
- BTC drawdown analysis
- “Hall of Pain” comparison
- Crisis annotations
- Zoom + hover interaction

Components:
- `BTCDrawdownChart.js`
- `AllInHallOfPain.js`
- `AllInVsDiversifiedChart.js`

---

## 5. Efficient Frontier Explorer
Modern Portfolio Theory simulation system.

Features:
- Efficient Frontier
- Random portfolio cloud
- Max Sharpe portfolio
- Minimum variance portfolio
- Portfolio optimization
- Interactive filtering
- Semantic zooming
- Brushing & selection

Components:
- `EfficientFrontier.js`
- `FrontierExplorer.js`

---

## 6. Behavioral Finance Narrative
Explains emotional investing behavior and market psychology.

Topics:
- Panic selling
- Capitulation
- Emotional cycles
- HODL psychology

Components:
- `InvestorPsychology.js`
- `HumanizeLossCard.js`
- `TakeawayCards.js`

---

## 7. Diversification Scoring System
Computes diversification quality using:
- Asset correlation
- Portfolio composition
- Natural hedges
- Risk concentration

Component:
- `DiversificationScore.js`

---

## 8. Data Transparency
Displays market data attribution and source information.

Component:
- `DataAttribution.js`

---

# Tech Stack

## Frontend
- JavaScript (ES Modules)
- Preact-style hooks
- TailwindCSS
- D3.js

## Data & Analytics
- Historical returns analysis
- Correlation matrices
- Drawdown analysis
- Portfolio volatility
- Efficient Frontier simulation
- Historical VaR

## Data Source
- Yahoo Finance
- `yfinance` Python library

---

# Project Structure

```bash
├── components/
│   ├── AllocationPieChart.js
│   ├── AllInHallOfPain.js
│   ├── AllInVsDiversifiedChart.js
│   ├── AssetContribution.js
│   ├── AssetPickerModal.js
│   ├── BTCDrawdownChart.js
│   ├── CorrelationBarChart.js
│   ├── CorrelationMatrix.js
│   ├── DataAttribution.js
│   ├── DiversificationScore.js
│   ├── EfficientFrontier.js
│   ├── FrontierExplorer.js
│   ├── HumanizeLossCard.js
│   ├── icons.js
│   ├── InvestorPsychology.js
│   ├── PairScatterPlot.js
│   ├── PortfolioWeights.js
│   ├── RiskMeter.js
│   ├── RiskRadar.js
│   └── TakeawayCards.js
│
├── css/
├── App.js
├── chartHelpers.js
├── constants.js
├── lib.js
├── main.js
├── returns_data.js
├── index.html
├── package.json
└── README.md