# Diagnosis — top-3 traps in this project's session harness

- 目的:記錄本專案 session 最容易出錯/失焦/漏 token 的前三名,附證據與明確修法。後續 docs 引用此檔。
- 目標讀者:Opus 4.8 級別的 Claude Code session(接手本專案者)。
- 修改權限:file:line 或指令輸出過期時,任何 session 可**先重跑驗證再更新**(見 [maintenance.md](maintenance.md));新增/刪除整條發現需先問使用者。
- 最後更新日期:2026-07-05(證據於此日實跑取得)

英文為主,與 CLAUDE.md 及 `~/.claude/playbooks/` 同語言,降低切換成本。

---

## #1 — `npm test` 在乾淨狀態下就會顯示 "1 failed"(最容易出錯 + 失焦)

**這是本專案最強的 done-signal 陷阱。** 乾淨的 tree 跑 `npm test` 一定紅字,不代表壞掉。

**證據(2026-07-05 實跑 `npx vitest run`):**
```
FAIL  src/recoverTracePoints.test.ts [ Error: Failed to load url vscode ]
Test Files  1 failed | 6 passed (7)
      Tests  92 passed (92)
```
`src/recoverTracePoints.test.ts` inline mock `vscode`、透過 `npx ts-node` 獨立執行(見 CLAUDE.md「Commands」與 `tips/tips.md`)。vitest 收集它時因 `import vscode` 失敗而報 "1 failed",且該檔在 vitest 下收集到 **0 test**。真正的 92 個測試全數通過。

**危害:** 做完真實修改後,session 無法區分「自己引入的新失敗」與「基線紅字」,可能(a)去修一個沒壞的東西,或(b)在仍紅的 run 上宣稱完成。

**修法(可判定):**
- 判定完成看 **`Tests` 那一行**(要 `X passed`,0 failed),**不要看 `Test Files` 那一行**。
- 真正的回歸會出現:一個**新的** failed 檔名,或 `Tests` 行出現 `X failed`。
- 要讓 `npm test` 在乾淨狀態變綠,需在 vitest 設定排除該獨立檔 —— **建議但需先問使用者**(改動測試基建,受 CLAUDE.md 保護)。列於本檔末「需人工確認」。

## #2 — 一個概念散落多檔;TypeScript 接住大部分,但有一處靜默漏接(最容易出錯)

**證據(2026-07-05 grep):** 新增一個 highlight 顏色需同步 **4 處**:
- `src/types.ts:11` — `HighlightColor` union
- `src/types.ts:60` — `HIGHLIGHT_TO_TAG`(`Record<HighlightColor, string>`)
- `src/decorationManager.ts:13` — `HIGHLIGHT_STYLES`(`Record<'default' | HighlightColor, …>`)
- `src/webview/components/TraceCard.tsx:68` — `HIGHLIGHT_COLORS`(`HighlightColor[]`)

新增一個訊息指令需同步 **2 處**:`src/types.ts:100` 的 union + `src/extension.ts` 的 dispatch switch(目前 21 個 case)。

**編譯器接哪些、漏哪些(有兩個靜默漏接處要人工顧):**
- **接得住**:兩個 `Record<HighlightColor, …>` 少 key → 編譯錯誤;訊息 switch 加了 union 沒有的 case → 編譯錯誤(字面量不在 union)。
- **靜默漏接 ①**:`HIGHLIGHT_COLORS` 是 `HighlightColor[]`(陣列,非 exhaustive map)→ 少一個 entry **照樣編譯**,只是 UI 色票不出現。
- **靜默漏接 ②**:dispatch switch **無 `default:` 也無 exhaustiveness 檢查**(`src/extension.ts:42–176`)→ union 加了指令但 switch 漏 case,**不報錯**,runtime **靜默忽略**該訊息。

**修法(可判定):**
- 改 `HighlightColor` 後:`npm run build` 通過,**再手動確認新色票在 TraceCard 出現**(編譯器不會警告 TraceCard 陣列漏項)。
- 加訊息指令後:同時 grep `src/types.ts` union 與 `src/extension.ts` switch,兩處都要有。

## #3 — 未限定範圍的搜尋/讀取會吃進 build 產物(最漏 token)

**證據(2026-07-05 `ls -la`):** 根目錄有 5 個 `*.vsix`(每個 ≈450–512 KB)、`package-lock.json`(270 KB)、`dist/` 的 minified bundle。

**危害:** `grep -r`、Glob `**/*`、或 Read 這些檔會灌爆 context。它們被 gitignore(`*.vsix`、`dist/`),所以 `git grep` 會略過,但**純 `grep -r` / Glob 不會**。

**修法(可判定):**
- 搜尋限定 `src/`;優先用 `git grep`(自動跳過 gitignore 的檔)。
- 永不 Read:`*.vsix`、`package-lock.json`、`dist/*.js`(minified,debug 用 source map — CLAUDE.md 已載明)。

---

## 需人工確認的事項

1. **是否要在 vitest 設定排除 `src/recoverTracePoints.test.ts`**(讓 `npm test` 乾淨變綠)。此改動觸及測試基建,受 CLAUDE.md「A test fails for an unclear reason: don't edit the test, ask」保護,故未逕自更動。未做時,基線紅字照 #1 的判定法處理。
