# SecVuln v2

企業級資安弱點管理平台，支援雙語介面（繁中／英）、RBAC 權限控制、設備弱點追蹤與 AI 輔助分析。

**技術堆疊：** React + Vite · Node.js + Express · PostgreSQL

---

## 功能特色

### 弱點管理
- 全文搜尋、多條件篩選、後端分頁排序
- 狀態工作流：`pending` → `fixed` / `accepted` / `deferred`
- 風險接受記錄（理由、緩解措施、重新評估日期）
- 處理備註（附作者與時間戳）
- 外部參考連結、CVSS 視覺化評分條

### 設備管理
- 設備 CRUD（類型、IP、韌體版本）
- 每設備獨立弱點狀態（junction table `device_vulnerabilities`）
- 單台掃描 / 全設備批次掃描比對
- 自動同步排程（5 分鐘輪詢）

### AI 弱點分析
支援四種 AI 引擎，於弱點詳情 modal 一鍵產生結構化分析報告：

| Provider | 驅動方式 |
|----------|---------|
| Claude (Anthropic) | `@anthropic-ai/sdk` |
| Gemini (Google) | `@google/generative-ai` |
| ChatGPT (OpenAI) | `openai` SDK |
| 本地模型（Ollama / vLLM） | `openai` SDK + 自訂 `baseURL` |

分析報告包含：威脅評估、影響分析、修復優先級、修復步驟、暫行緩解措施。

### 儀表板
- 弱點統計卡（總數、嚴重、高風險、待處理）
- 月度趨勢長條圖
- 即將到期的風險接受重新評估清單

### 其他
- RBAC：`superadmin` / `admin` / `user` 三級權限
- 雙語 UI（繁中／英文即時切換）
- 資料來源管理（NVD、Fortinet，可擴充）
- API 金鑰遮罩顯示、SSRF 防護（資料來源 URL）

---

## 環境需求

| 工具 | 版本 |
|------|------|
| Node.js | 18+ （生產環境 v22） |
| npm | 8+ |
| PostgreSQL | 14+（生產環境 16） |

---

## 快速啟動（本地開發）

### 1. 啟動 PostgreSQL

```bash
docker-compose up -d
```

### 2. 設定後端環境變數

```bash
cp backend/.env.example backend/.env
```

預設值已對應 `docker-compose.yml`，本地開發無需修改。

### 3. 安裝依賴

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. 執行資料庫 migrations

```bash
cd backend && npm run migrate
```

Migrations 會依序套用 `backend/migrations/` 下的所有 SQL 檔（schema、seed、設備類型、每設備弱點 junction table、AI base URL 欄位）。

### 5. 啟動開發伺服器

```bash
# Terminal 1 — 後端 (port 3001)
cd backend && npm run dev

# Terminal 2 — 前端 (port 5173)
cd frontend && npm run dev
```

開啟 [http://localhost:5173](http://localhost:5173)

---

## 示範帳號

| 角色 | 帳號 | 密碼 | 權限 |
|------|------|------|------|
| superadmin | admin@example.com | admin123 | 全部功能含設定 |
| admin | mgr@example.com | admin123 | 弱點處理、設備管理、使用者管理 |
| user | analyst@example.com | admin123 | 查看 + 新增備註 |
| user | viewer@example.com | admin123 | 唯讀 |

---

## AI 分析設定

前往「設定」頁面 → AI Provider 區塊：

### 雲端服務
1. 選擇 Provider（Claude / Gemini / ChatGPT）
2. 選擇模型
3. 填入對應的 API Key
4. 儲存

### 本地模型（Ollama / vLLM）
1. 選擇「本地模型」
2. 點選平台快速鍵或手動填入 API Base URL
3. 填入模型名稱（例如 `llama3.2`、`qwen2.5:72b`）
4. API Key 選填（vLLM 需要；Ollama 留空）
5. 儲存

**本地服務啟動參考：**
```bash
# Ollama
ollama run llama3.2

# vLLM
vllm serve meta-llama/Llama-3.2-3B-Instruct
```

---

## 專案結構

```
secvulnv2/
├── backend/
│   ├── migrations/
│   │   ├── 001_schema.sql        # 完整資料庫 schema
│   │   ├── 002_seed.sql          # 示範帳號與弱點資料
│   │   ├── 003_device_type.sql   # 設備類型欄位
│   │   ├── 004_device_vuln.sql   # 每設備弱點 junction table
│   │   └── 005_ai_base_url.sql   # AI 本地模型端點 URL
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── aiController.js          # AI 分析（Claude/Gemini/OpenAI/Local）
│   │   │   ├── dashboardController.js
│   │   │   ├── deviceController.js      # 設備 CRUD + scan + 每設備弱點
│   │   │   ├── settingsController.js    # API key 遮罩、SSRF 防護
│   │   │   ├── userController.js
│   │   │   └── vulnerabilityController.js
│   │   ├── lib/
│   │   │   └── deviceTypes.js           # DEVICE_TYPE_PRODUCTS 單一來源
│   │   ├── middleware/
│   │   │   ├── auth.js                  # JWT 驗證、requireRole
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── ai.js
│   │   │   ├── auth.js
│   │   │   ├── dashboard.js
│   │   │   ├── devices.js
│   │   │   ├── settings.js
│   │   │   ├── users.js
│   │   │   └── vulnerabilities.js
│   │   ├── services/
│   │   │   ├── nvdSync.js               # NVD / Fortinet 同步
│   │   │   └── scheduler.js             # 自動同步排程（5 分鐘輪詢）
│   │   ├── db.js                        # pg Pool
│   │   └── index.js                     # Express app 入口
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Icons.jsx
│   │   │   ├── VulnDetailModal.jsx      # 弱點詳情 + AI 分析 + 備註
│   │   │   └── ui/                      # Badge, Btn, CvssBar, MiniBarChart…
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx          # JWT + RBAC can()
│   │   │   └── LangContext.jsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DevicesPage.jsx          # 設備列表 + 每設備弱點展開
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SearchPage.jsx           # 弱點搜尋 + 分頁
│   │   │   ├── SettingsPage.jsx         # AI、通知、資料來源設定
│   │   │   └── UsersPage.jsx
│   │   ├── services/
│   │   │   └── api.js                   # authApi / vulnApi / deviceApi /
│   │   │                                #   deviceVulnApi / aiApi / settingsApi…
│   │   ├── styles/
│   │   │   └── tokens.js                # 設計 token（顏色、字型、間距）
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
└── docker-compose.yml
```

---

## API 端點

### 認證
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| POST | `/api/auth/login` | — | 登入，回傳 JWT |
| GET | `/api/auth/me` | ✓ | 當前使用者資訊 |

### 弱點
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/vulnerabilities` | ✓ | 列表＋篩選＋分頁（`page`, `limit`, `q`, `severity`, `status`） |
| GET | `/api/vulnerabilities/:id` | ✓ | 單筆詳情（含 notes、riskAcceptance） |
| PUT | `/api/vulnerabilities/:id/status` | admin+ | 更新全域狀態 |
| POST | `/api/vulnerabilities/:id/notes` | ✓ | 新增備註 |
| POST | `/api/vulnerabilities/:id/risk-acceptance` | admin+ | 設定風險接受 |
| DELETE | `/api/vulnerabilities/:id` | superadmin | 刪除弱點 |

### 設備
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/devices` | ✓ | 列表（含 vuln_count） |
| POST | `/api/devices` | admin+ | 新增設備 |
| PUT | `/api/devices/:id` | admin+ | 更新設備 |
| DELETE | `/api/devices/:id` | admin+ | 刪除設備 |
| POST | `/api/devices/:id/scan` | admin+ | 觸發單台掃描比對 |
| POST | `/api/devices/scan-all` | admin+ | 全設備批次掃描 |

### 每設備弱點
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/devices/:id/vulnerabilities` | ✓ | 設備弱點清單（含 device-level 狀態） |
| PUT | `/api/devices/:id/vulnerabilities/:vid/status` | admin+ | 更新設備弱點狀態 |
| POST | `/api/devices/:id/vulnerabilities/:vid/notes` | ✓ | 新增設備弱點備註 |
| POST | `/api/devices/:id/vulnerabilities/:vid/risk-acceptance` | admin+ | 設備弱點風險接受 |

### AI 分析
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| POST | `/api/ai/analyze` | ✓ | 送出弱點資料，回傳 AI 結構化分析 |

### 使用者
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/users` | admin+ | 使用者列表 |
| POST | `/api/users` | superadmin | 新增使用者 |
| PUT | `/api/users/:id` | superadmin | 更新使用者 |
| DELETE | `/api/users/:id` | superadmin | 刪除使用者 |

### 設定
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/settings` | superadmin | 取得設定（API key 已遮罩） |
| PUT | `/api/settings` | superadmin | 更新設定 |
| POST | `/api/settings/sources/:id/test` | superadmin | 測試資料來源連線 |
| POST | `/api/settings/sources/:id/sync` | superadmin | 手動同步資料來源 |

### 儀表板
| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/api/dashboard/stats` | ✓ | 統計彙總 |
| GET | `/api/dashboard/trend` | ✓ | 月度趨勢資料 |
| GET | `/api/dashboard/reviews` | ✓ | 即將到期的風險接受清單 |

---

## 生產部署（PM2）

```bash
# 後端
cd backend && npm install
pm2 start src/index.js --name secvuln-backend

# 前端（build 後以靜態檔案服務）
cd frontend && npm run build
pm2 start "npx serve dist -l 3000" --name secvuln-frontend

# 執行 migrations
cat backend/migrations/001_schema.sql | sudo -u postgres psql -d secvulndb
# … 依序執行 002–005
```

**Nginx 反向代理建議：**
```nginx
location /api/ { proxy_pass http://localhost:3001; }
location /     { proxy_pass http://localhost:3000; }
```
