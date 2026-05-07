# PortfolioPulse — Tổng kết thay đổi

Dự án đã được refactor theo 3 Phase. Cấu trúc thư mục mới:

```
portfoliopulse/
├── index.html           ← sửa path CSS + title
├── main.js              ← không đổi
├── lib.js               ← không đổi
├── App.js               ← VIẾT LẠI HOÀN TOÀN (6-Act narrative)
├── utils.js             ← thêm helpers + fix công thức
├── constants.js         ← thêm buildPresetAssets()
├── styles.css           ← thêm smooth-scroll, animations
├── returns_data.js      ← không đổi
└── components/          ← tất cả components gom vào đây
    ├── (11 components cũ đã sửa hoặc giữ nguyên)
    └── (6 components MỚI)
```

---

## PHASE 1 — Sửa bug logic

### Bug 1: CorrelationMatrix màu ngược → PHÁ narrative "mind-blow"
**File:** `components/CorrelationMatrix.js`  
**Trước:** correlation = +1 hiện XANH (blue), −1 hiện ĐỎ  
**Sau:** +1 ĐỎ (risk cluster), 0 TRẮNG, −1 XANH LÁ (hedge)  
Tác động: Slide 12 của docx giờ đã "mind-blow" được — 5 mã FAANG hiện đỏ rực như bạn muốn.  
Đã thêm legend bên dưới heatmap để người xem hiểu ngay.

### Bug 2: WhatIfSimulator swap → dùng mock data
**File:** `components/WhatIfSimulator.js`  
**Trước:** khi swap asset, gọi `generateMockReturns(...)` — dữ liệu giả.  
**Sau:** `REAL_RETURNS[symbol] ?? generateMockReturns(...)` — ưu tiên data thật.  
Tác động: Demo Slide 17 (trước/sau khi swap NVDA→GOLD) giờ tính dựa trên data lịch sử thật.

### Bug 3: PortfolioComparison lọc sai
**File:** `components/PortfolioComparison.js`, `constants.js`  
**Trước:** `valid = assets.filter(a => weights[a.symbol] !== undefined)` — lọc portfolio user theo weights của preset, làm rơi mất TLT/GOLD nếu user không có.  
**Sau:** Thêm `buildPresetAssets()` trong `constants.js` — preset giờ được build ĐỘC LẬP từ `ASSET_CATALOG` + `REAL_RETURNS`, luôn đầy đủ 100% composition.  
Còn thêm panel "composition" show cho user biết preset gồm những mã gì.

### Bug 4: PairScatterPlot đặt tên biến ngược
**File:** `components/PairScatterPlot.js`  
**Trước:** `stdX = std(y values)`, `stdY = std(x values)` — tính slope = r*(stdX/stdY) hoá ra đúng vì ngược 2 lần.  
**Sau:** Đặt lại tên cho đúng: `stdX = std(x)`, `stdY = std(y)`, slope = `r * (stdY / stdX)`.  
Cùng kết quả, code đọc được.

### Bug 5: Diversification score không nhất quán
**File:** `utils.js`, `components/PortfolioComparison.js`  
**Trước:** `computeDiversificationScore` dùng `avgCorr` raw, còn `PortfolioComparison` dùng `Math.abs(avgCorr)`. Cùng 1 portfolio ra 2 số khác nhau tuỳ component.  
**Sau:** Tất cả component đều gọi `computeDiversificationScore(...)` duy nhất. Hedge (corr âm) đẩy điểm LÊN như thiết kế.

### Bug 6: Cấu trúc file path không khớp
**Trước:** Components ở root nhưng App.js import `./components/X.js`.  
**Sau:** Đã move 22 component vào folder `components/`, mọi import đều resolve.

---

## PHASE 2 — 6 Visualization mới (theo kế hoạch docx)

| # | File | Slide trong docx | Vai trò |
|---|------|---|---|
| 1 | `BTCDrawdownChart.js` | Slide 4 | Drawdown thật của BTC với annotate −50/−70/−80% |
| 2 | `HumanizeLossCard.js` | Slide 5 | "Nhân hoá" con số — 2 cọc tiền 100M/1 tỷ/$100K |
| 3 | `InvestorPsychology.js` | Slide 6 | Timeline Euphoria→Panic→Capitulation |
| 4 | `AllInVsDiversifiedChart.js` ⭐ | Slide 9 | **Chart quan trọng nhất** — ALL-IN BTC vs Diversified 8 năm, toggle Growth/Drawdown, annotate COVID + Crypto Winter |
| 5 | `StressTestCompare.js` | Slide 18 | Head-to-head: portfolio bạn vs preset dưới cùng 1 shock |
| 6 | `TakeawayCards.js` | Slide 20 | 3 ô takeaway kết bài |

Mọi viz mới đều dùng **REAL_RETURNS** trực tiếp (không có mock data).

---

## PHASE 3 — Layout 6-Act narrative (App.js viết lại)

Thay vì "dashboard 3 tabs", trang web giờ là một **scrolling story** đi qua 6 Act đúng như docx:

### Cấu trúc layout mới

| Act | Section | Nội dung | Cảm xúc |
|-----|---------|---------|---------|
| **1. Hook** | `#act-1` | Hero title + 3-choice question ($100K bạn chọn đâu?) | Tò mò |
| **2. Wake-up Call** | `#act-2` | BTCDrawdown → HumanizeLoss → InvestorPsychology → "ALL-IN = ALL-OR-NOTHING" | **Sợ hãi** |
| **3. Bridge** | `#act-3` | AllInVsDiversifiedChart + quote "minimize regret" | Nhẹ nhõm |
| **4. Plot Twist** | `#act-4` | FAANG CorrelationMatrix (pre-built) → "1 khoản, mua 5 lần" | **Mind-blown** |
| **5. Solution (Demo)** | `#act-5` | Tất cả 9 tool tương tác (sticky sidebar + step-by-step numbered sections) | Tin tưởng |
| **6. Conclusion** | `#act-6` | TakeawayCards + CTA | Hành động |

### Các chi tiết đã thêm

- **Header mới:** Sticky, tối giản, có nút "Skip to tool →" cho ai muốn vào thẳng Act 5
- **Navigation dots:** Fixed right-side, hiện tooltip label Act khi hover (chỉ desktop)
- **Màu section theo cảm xúc:**
  - Act 1 + 2: Dark (#0f172a gradient) — không khí nghiêm trọng
  - Act 3: Light + tint xanh lá — nhẹ nhõm
  - Act 4: Tint đỏ hồng — căng thẳng bất ngờ
  - Act 5: Slate-50 (neutral) — không khí chuyên nghiệp làm việc
  - Act 6: White + final dark CTA
- **Act 5 được đánh số:** "Step 1 → Step 9" dẫn người dùng theo flow phân tích (từ score tổng → 5 dim → correlation → ranking → what-if → stress test → compare → contribution → advisor)
- **FAANG trap portfolio riêng:** Act 4 có `faangAssets` pre-built độc lập khỏi portfolio user, dùng `buildPresetAssets()` với weights 20% × 5 mã FAANG
- **Shared InsightPanel:** Một component panel dùng chung cho cả Act 4 (heatmap FAANG) và Act 5 (heatmap của user), tránh duplicate code

---

## Cách chạy

```bash
cd portfoliopulse/
python3 -m http.server 8000
# Mở http://localhost:8000
```

Cần kết nối internet vì `index.html` load React, htm, D3, Tailwind từ CDN.

---

## Những gì bạn nên test

1. **Scroll từ trên xuống** — kiểm tra narrative flow có "dẫn dắt" như bạn muốn chưa
2. **Hover vào CorrelationMatrix ở Act 4** — xem panel scatter + insight có chạy không
3. **Vào Act 5**, chỉnh amount của AAPL → xem RiskMeter + DiversificationScore + RiskRadar có update real-time không
4. **Click nút "Skip to tool"** trên header — phải nhảy thẳng xuống Act 5
5. **Trong StressTestCompare**, chọn COVID Crash + preset Conservative — xem 2 panel có hiện số khác biệt rõ không
6. **Trong PortfolioComparison**, chọn preset All-Weather — panel "composition" phải hiện đầy đủ 8 mã (AAPL, GOOGL, MSFT, AMZN, TLT, GOLD, BTC, ETH), không bị rớt mã nào

---

## Còn có thể cải thiện (nếu bạn muốn làm thêm)

- **Responsive mobile:** hiện Act 5 grid 2-column sẽ stack trên mobile, nhưng chart có thể tràn. Chưa test kỹ trên screen <768px.
- **Active section highlight trên nav dots:** hiện các dots luôn cùng màu, có thể thêm `IntersectionObserver` để highlight act đang xem.
- **Event detection tự động trong AllInVsDiversifiedChart:** hiện `EVENTS` hardcode `dayPct: 0.27, 0.46`. Có thể tự tính bằng cách parse date từ dữ liệu gốc (cần thêm một field `dates[]` trong `returns_data.js`).
- **Performance:** Act 5 render rất nhiều chart cùng lúc. Nếu chậm, có thể thêm `IntersectionObserver` để lazy-render từng block khi user scroll tới.
