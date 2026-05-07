# PortfolioPulse — Review & changelog

Review đầy đủ dự án sau khi xem qua tất cả các file (trừ `returns_data.js` theo yêu cầu).
File này chia làm 4 phần:

1. **Tính năng đã thêm** — zoom + tooltip cho line chart
2. **Bug đã sửa** — đã fix trong các file output
3. **Phát hiện cần bạn xử lý** — không tự động sửa được, cần bạn tự kiểm tra
4. **Đề xuất cải thiện cho dự án** — nice-to-have

---

## 1. Tính năng đã thêm

### Zoom + date tooltip cho line chart
Áp dụng cho 2 chart có nhiều điểm dữ liệu:

- `components/BTCDrawdownChart.js` (Slide 4)
- `components/AllInVsDiversifiedChart.js` (Slide 9 — chart quan trọng nhất)

**Cách hoạt động:**

| Hành động | Kết quả |
|---|---|
| Drag kéo chuột ngang trên chart | Zoom vào khoảng đã chọn |
| Hover chuột bất kỳ vị trí nào | Hiện vertical line + dot + tooltip box (ngày + giá trị) |
| Double-click | Reset về toàn bộ giai đoạn |
| Click nút "↺ Reset zoom" | Reset (chỉ hiện khi đang zoom) |

**Chi tiết kỹ thuật:**

- Thêm 2 helper mới vào `chartHelpers.js`: `attachLineInteractions` và `drawHoverMarker`. Cả hai pure D3, không phụ thuộc React, có thể tái sử dụng cho line chart bất kỳ trong tương lai.
- Brush + hover chia sẻ cùng overlay rect; xử lý xung đột pointer-event bằng D3 namespace `.zoomTooltip`.
- X-axis tự động chọn granularity phù hợp (year → month → week → day) dựa vào span ngày visible — đã có sẵn trong `pickTimeTicks` nhưng trước giờ không được dùng. Giờ cả 2 chart đều dùng.
- Y-axis trong `AllInVsDiversifiedChart`:
  - **Price mode:** tự rescale theo visible range để zoom vào thấy detail rõ.
  - **Drawdown mode:** giữ anchored vào global min để cảm giác "rơi sâu" không bị mất khi zoom.
- Annotation (COVID/Crypto Winter line, Max drawdown circle) chỉ hiện khi index của chúng nằm trong domain đang xem.
- `EVENTS` trong `AllInVsDiversifiedChart` đổi từ `dayPct` (hardcoded 0.27, 0.46) sang `date` thực (`2020-03-23`, `2021-11-10`). Helper `dateToIndex` mới trong `chartHelpers.js` lo việc map ngày → index. Đây cũng là điều mà CHANGES.md cũ gắn cờ "có thể cải thiện".

---

## 2. Bug đã sửa (có trong output)

### Bug A — Sai số La Mã của Act trong header [`App.js`]

Theo `NoteIdeaDV.docx`: Act 1 = Hook, Act 2 = Wake-up, Act 3 = Bridge, Act 4 = Plot Twist, Act 5 = Solution, Act 6 = Conclusion. Nhưng các badge tiêu đề trong code đang lệch 1 đơn vị:

| Vị trí | Trước | Sau |
|---|---|---|
| Act Wake-up Call (line 278) | `Act I` | `Act II` |
| Act Bridge (line 318) | `Act II` | `Act III` |
| Act Plot Twist (line 357) | `Act III` | `Act IV` |
| Act Solution (line 443) | `Act IV` | `Act V` |

Mảng `ACTS` ở đầu file (dùng cho navigation dots) đã đúng — chỉ có badges là sai.

### Bug B — Tailwind class invalid trong `StressTestCompare.js` (line 140 cũ)

```js
// Trước (BROKEN):
<span class=${scenario.color.replace('text-', 'text-white/90')}>
//  scenario.color = 'text-red-600'
//  → 'text-white/90red-600'  ← Tailwind không nhận diện
```

Lỗi này khiến nhãn scenario name (ví dụ "🦠 COVID Crash") không có màu — Tailwind bỏ qua class lạ. Giờ thay bằng `text-white/90` trực tiếp.

### Bug C — Logic verdict "lose/gain" lệch dấu trong `StressTestCompare.js`

```js
// Trước:
your portfolio would ${A < B ? 'lose' : 'gain'}
  ${(A - B).toFixed(1)}% more than {preset}
```

Khi A=−10%, B=−5%, code in ra "would lose **−5%** more than..." — số âm trong câu "lose more" là sai logic. Khi A=+5%, B=+10%, in ra "lose −5% more" — vô nghĩa.

Đã rewrite thành phrase neutral:
```
your portfolio outperforms/underperforms ${preset} by ${absPct}%
```
Always positive number, semantic luôn đúng dù shock là crash hay bull.

### Bug D — Badge "🏆 LESS LOSS" sai trong bull market scenario [`StressTestCompare.js`]

Khi chọn scenario `bull_run`, cả 2 portfolio đều positive impact. Badge winner vẫn ghi "LESS LOSS" — sai về ngữ nghĩa. Giờ adaptive:

```js
🏆 ${totalImpact >= 0 ? 'MORE GAIN' : 'LESS LOSS'}
```

### Bug E — Verdict text awkward trong `WhatIfSimulator.js`

```js
// Trước (gồ ghề):
`You gain ${X}% ${riskDelta < 0 ? 'less' : 'more'} risk for ${Y} pts ${...} diversification`
// "You gain X% less risk" — gain less là vô nghĩa.
// Khi scoreDelta=0: "0 pts worse diversification" — vô nghĩa.
```

Đã rewrite tách 2 trục ra rõ ràng:
```
"Risk drops by 0.42% while diversification gains 2 pts."
```

### Bug F — `DataAttribution.js` rỗng (0 byte)

File này tồn tại nhưng không có nội dung gì và không được import bất kỳ đâu. Tôi đã viết một component nhỏ ghi credit nguồn dữ liệu (Yahoo Finance / yfinance, period 2018-01-01 → 2026-04-22). Bạn có thể thêm vào Act 6 trong App.js:

```js
import { DataAttribution } from './components/DataAttribution.js';
// ...trong Act 6 sau TakeawayCards:
<${DataAttribution} />
```

Phần lớn rubric dự án Data Science đều đánh giá cao việc credit nguồn dữ liệu rõ ràng.

### Bug G — Import thừa trong `PortfolioComparison.js`

```js
// Trước:
import { cn, calculatePortfolioRisk, calculateCorrelation, computeDiversificationScore } from '../utils.js';
//                                  ^^^^^^^^^^^^^^^^^^^^ không dùng
```
Đã bỏ.

---

## 3. Phát hiện cần bạn xử lý

### 3.1. Khả năng lệch giữa SCENARIOS description và HARDCODED_SHOCKS [`constants.js`]

Mô tả của các scenario có vẻ tham chiếu đến số liệu cụ thể nhưng số trong `HARDCODED_SHOCKS` lại khác:

| Scenario | Description nói | HARDCODED_SHOCKS có |
|---|---|---|
| `stagflation` | "BTC crashed -55%" | `BTC: -0.20` (-20%) |
| `crypto_winter` | "BTC -76%, ETH -76%" | `BTC: -0.83` (-83%), `ETH: -0.94` (-94%) |
| `rate_hike` | "Energy (XOM) surged +79%" | XOM **không có** |
| `bull_run` | "NVDA +246%, META +187%" | `NVDA: 2.40` (+240%), `META: 1.94` (+194%) — close nhưng khác |

Vì `buildShocks()` ưu tiên `REAL_SHOCKS[eventId]` (từ `returns_data.js`) trước, nếu `REAL_SHOCKS` có data đúng với description thì OK. Nhưng nếu `REAL_SHOCKS` thiếu key nào đó, nó fallback về `HARDCODED_SHOCKS` mà số lệch description.

**Hành động đề xuất cho bạn:**
1. Mở `returns_data.js`, kiểm tra `REAL_SHOCKS.stagflation.BTC`, `REAL_SHOCKS.rate_hike.XOM`, v.v., có khớp description không.
2. Nếu lệch → sửa hoặc description (cho khớp data) hoặc data (cho khớp description).
3. Nếu cả `REAL_SHOCKS` và `HARDCODED_SHOCKS` đều thiếu thì asset sẽ fallback sang `globalShock` (-30% / -35% v.v.) — kiểm tra logic này có ý đồ không.

Tôi không tự sửa vì không muốn đọc dữ liệu khi bạn không yêu cầu.

### 3.2. `StressTest.js` không được dùng

File `components/StressTest.js` tồn tại đầy đủ nhưng `App.js` chỉ import `StressTestCompare`, không import `StressTest`. Đây là dead code — có thể xoá để clean.

Tuy nhiên tôi **không xoá**, vì có thể bạn vẫn dùng `StressTest` ở đâu đó (offline demo, screenshot). Bạn quyết định.

### 3.3. Ranh giới `r === -0.1` trong `CorrelationBarChart.js`

`barColor()` dùng `r > -0.1 ? ... : 'HEDGE'` (gán hedge khi `r ≤ -0.1`). Nhưng summary count `pairs.filter(p => p.r < -0.1)` (loại trừ `-0.1` đúng đắn). Giá trị đúng `r = -0.1` thì cell hiện màu xanh nhưng không được đếm vào summary. Edge case nhỏ — gần như không xảy ra với data thực, nhưng nếu muốn nhất quán có thể đổi summary thành `<= -0.1`.

### 3.4. Performance: re-render full chart trên mỗi mousemove

Trong các chart có zoom/tooltip, `hoverIdx` nằm trong dependency của `useEffect` chính → mỗi lần hover, toàn bộ SVG được rebuild. Với ~2000 data points, mỗi rebuild ~5–10ms. Trên máy mạnh thì OK; trên máy yếu (laptop cấu hình thấp khi demo trên máy chiếu) có thể giật nhẹ.

**Cách tối ưu nếu bị giật khi demo:** tách hover render ra useEffect riêng, chỉ manipulate `g.hover-layer` (xoá + vẽ lại), không rebuild các path khác. Tôi không làm trong lần này để giữ code đơn giản; flag để bạn cân nhắc.

---

## 4. Đề xuất cải thiện (nice-to-have)

### 4.1. Active section highlight cho navigation dots
Hiện 6 navigation dots bên phải luôn cùng độ đậm. Thêm `IntersectionObserver` để dot của Act đang xem được scale-up + outline:

```js
useEffect(() => {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) setActiveAct(e.target.id);
    });
  }, { rootMargin: '-40% 0px -40% 0px' });
  ACTS.forEach(a => obs.observe(document.getElementById(a.id)));
  return () => obs.disconnect();
}, []);
```

### 4.2. Lazy-render Act 5
Act 5 render 9 chart cùng lúc. Trên máy yếu hoặc khi load đầu trang có thể chậm. Wrap mỗi `<div>` step trong `IntersectionObserver`-based lazy mount để chỉ render khi gần đến viewport.

### 4.3. Mobile responsive
- AllInVsDiversifiedChart `viewBox` dài 860 — trên mobile sẽ thu nhỏ thành chữ tí xíu, tooltip box (max 220px) có thể tràn. Có thể thêm `mobile` prop để giảm số tick + tooltip width.
- Heatmap CorrelationMatrix kích thước cố định 380×380 — trên mobile có scroll horizontal nhưng UX không tự nhiên.

### 4.4. Thêm "Time-period preset" cho line chart
Bên cạnh drag-to-zoom, cho thêm các nút preset:
- "2020 COVID" → zoom vào Mar 2020 ± 6 tháng
- "Crypto Winter" → zoom vào Nov 2021 → Nov 2022
- "Bull 2023" → zoom vào 2023

Click 1 lần là zoom đúng vùng, không cần kéo. Đỡ confusion cho audience demo.

### 4.5. Annotation tooltip chính xác hơn
Hiện tooltip dùng linear interpolation index → date (giả sử mỗi day là trading day liên tục). Thực tế cuối tuần + holiday bị skip. Sai số có thể đến 2–3 tuần ở các điểm xa.

Cách fix tốt nhất: thêm `dates: string[]` array vào `returns_data.js` từ Python script `fetch_returns.py`. Trong `chartHelpers.js`, thay `indexToDate` bằng lookup array thực. Chính xác 100%.

### 4.6. Thêm 1 số chỗ tận dụng được narrative
- `HumanizeLossCard` đang chỉ dùng max BTC drawdown. Có thể cho user input "Mã của bạn" (text input) → tính max drawdown của mã đó → "Nếu bạn ALL-IN vào ABCD năm xx, bạn còn lại ___". Tuỳ ý — khá khớp với option D mà tôi đề xuất brainstorm trước đó.
- Slide 7 ("ALL-IN = ALL-OR-NOTHING") rất ngắn (1 màn). Có thể thêm 1 conditional sub-text dùng số drawdown thật của BTC từ data thay vì hardcode "−80%".

---

## 5. Tổng kết

**Files thay đổi (giữ cấu trúc dự án gốc):**

```
chartHelpers.js                         ← thêm helper zoom/tooltip + dateToIndex
App.js                                  ← sửa 4 act numbering
components/
  BTCDrawdownChart.js                   ← thêm zoom/tooltip
  AllInVsDiversifiedChart.js            ← thêm zoom/tooltip + EVENTS theo date
  StressTestCompare.js                  ← fix 3 bug (badge, replace, verdict)
  WhatIfSimulator.js                    ← fix verdict wording
  PortfolioComparison.js                ← bỏ import thừa
  DataAttribution.js                    ← viết nội dung (file gốc rỗng)
```

**Files KHÔNG thay đổi** (đã review nhưng chưa cần sửa): `lib.js`, `main.js`, `index.html`, `styles.css`, `utils.js`, `constants.js`, `returns_data.js`, `RiskMeter.js`, `RiskRadar.js`, `DiversificationScore.js`, `CorrelationMatrix.js`, `CorrelationBarChart.js`, `PairScatterPlot.js`, `AllocationPieChart.js`, `AssetContribution.js`, `AssetPickerModal.js`, `PortfolioWeights.js`, `PortfolioHealth.js`, `PortfolioAdvisor.js`, `HumanizeLossCard.js`, `InvestorPsychology.js`, `TakeawayCards.js`, `icons.js`, `StressTest.js`.

**Còn pending:** mở rộng "ALL-IN khác BTC" — bạn đã chọn để sau, sẵn sàng làm khi bạn quyết hướng A/B/C.
