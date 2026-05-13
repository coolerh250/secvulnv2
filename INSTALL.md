# SecVuln Tracker v2 — Docker 安裝指南

本指南說明如何在 Ubuntu Linux 上透過 Docker 部署 SecVuln Tracker v2。
完成後可透過 HTTPS（8443 埠）從瀏覽器存取系統。

---

## 系統需求

| 項目 | 最低需求 |
|------|---------|
| 作業系統 | Ubuntu 20.04 LTS 或更新版本 |
| RAM | 2 GB |
| 磁碟空間 | 20 GB 可用空間 |
| 網路 | 可連接網際網路（建置時需下載映像） |

---

## 步驟一：安裝 Docker

執行 Docker 官方安裝腳本（一鍵完成）：

```bash
curl -fsSL https://get.docker.com | sudo sh
```

將目前使用者加入 `docker` 群組（避免每次都需輸入 `sudo`）：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

> **注意：** `newgrp docker` 僅對目前的 Shell 會話生效。若關閉終端後重新登入，群組設定才會完整套用。在套用前，所有 `docker` 指令請加上 `sudo`。

確認安裝成功：

```bash
docker version
```

若看到版本資訊（Client / Server 皆有輸出）即表示安裝完成。

---

## 步驟二：取得程式碼

本系統為私有倉庫，依實際情況選擇以下任一方式取得程式碼：

### 方式 A：使用 GitHub Personal Access Token（PAT）

1. 至 GitHub → Settings → Developer settings → Personal access tokens，產生一組具有 `repo` 讀取權限的 Token。
2. 執行：

```bash
git clone https://<YOUR_TOKEN>@github.com/coolerh250/secvulnv2.git
cd secvulnv2
```

### 方式 B：從已有程式碼的機器以 SCP 傳送（推薦用於內網部署）

在**本機**執行（將程式碼打包後傳至伺服器）：

```bash
# 在本機的專案目錄下執行
tar --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.env' \
    -czf /tmp/secvulnv2.tar.gz .
scp /tmp/secvulnv2.tar.gz <user>@<server-ip>:/home/<user>/secvulnv2.tar.gz
```

在**伺服器**執行：

```bash
mkdir -p ~/secvulnv2
tar -xzf ~/secvulnv2.tar.gz -C ~/secvulnv2
cd secvulnv2
```

---

## 步驟三：設定環境變數

複製範本檔：

```bash
cp .env.example .env
```

編輯 `.env`：

```bash
nano .env
```

**必須修改的項目：**

| 變數 | 說明 | 範例 |
|------|------|------|
| `DB_PASSWORD` | 資料庫密碼（不要使用預設值） | `MySecurePass123` |
| `JWT_SECRET` | JWT 簽署金鑰，請使用長隨機字串 | 見下方指令 |
| `CORS_ORIGIN` | 前端對外 URL（含 https 與埠號） | `https://192.168.1.100:8443` |

產生安全的 JWT_SECRET：

```bash
openssl rand -hex 32
```

將輸出結果貼入 `.env` 的 `JWT_SECRET=` 後方。

**完整 .env 範例（已修改）：**

```env
DB_NAME=secvulndb
DB_USER=secvulnv2
DB_PASSWORD=MySecurePass123
JWT_SECRET=a1b2c3d4e5f6...（openssl rand -hex 32 的輸出）
FRONTEND_PORT=8443
CORS_ORIGIN=https://192.168.1.100:8443
```

存檔後關閉編輯器（`Ctrl+X` → `Y` → `Enter`）。

---

## 步驟四：建置並啟動服務

```bash
sudo docker compose up -d --build
```

> 若已登出並重新登入（群組設定已生效），可省略 `sudo`。

首次執行約需 **3–5 分鐘**（需下載 Node.js、nginx、PostgreSQL 映像並安裝套件）。

建置期間系統會自動：
- 安裝前後端相依套件
- 編譯前端 React 程式碼
- 產生自簽 SSL/TLS 憑證
- 執行資料庫初始化與 migrations

---

## 步驟五：確認服務狀態

```bash
sudo docker compose ps
```

正常輸出應如下（三個服務狀態皆為 `running`）：

```
NAME                STATUS
secvuln_db          running (healthy)
secvuln_backend     running
secvuln_frontend    running
```

若 backend 顯示 `starting`，請等候約 30 秒後再查詢一次（等待資料庫就緒）。

---

## 步驟六：開啟系統

在瀏覽器輸入：

```
https://<伺服器 IP>:8443
```

> **憑證警告（正常現象）：** 因使用自簽憑證，瀏覽器會顯示「您的連線不是私人連線」或類似警告。
> - Chrome / Edge：點擊「進階」→「繼續前往」
> - Firefox：點擊「進階」→「接受風險並繼續」

---

## 預設帳號

> 首次登入後，請立即至「使用者管理」修改密碼，並依需求新增其他使用者。

| 帳號 | 密碼 | 角色 |
|------|------|------|
| `superadmin` | `admin1234` | 超級管理員（全部權限） |

---

## 常用管理指令

### 查看服務狀態

```bash
sudo docker compose ps
```

### 即時查看日誌

```bash
# 查看後端日誌
sudo docker compose logs -f backend

# 查看全部服務日誌
sudo docker compose logs -f
```

### 停止服務

```bash
sudo docker compose down
```

資料庫資料會保留在 Docker volume，下次啟動不會遺失。

### 更新系統版本

```bash
git pull
sudo docker compose up -d --build
```

### 重啟單一服務

```bash
sudo docker compose restart backend
sudo docker compose restart frontend
```

### 資料庫備份

```bash
sudo docker compose exec db pg_dump -U secvulnv2 secvulndb > backup_$(date +%Y%m%d).sql
```

### 資料庫還原

```bash
cat backup_20260513.sql | sudo docker compose exec -T db psql -U secvulnv2 secvulndb
```

---

## 疑難排解

### 查看錯誤訊息

```bash
sudo docker compose logs backend
sudo docker compose logs frontend
sudo docker compose logs db
```

### 進入容器內部排查

```bash
# 後端容器
sudo docker compose exec backend sh

# 資料庫容器
sudo docker compose exec db psql -U secvulnv2 secvulndb
```

### 埠號衝突（8443 已被其他程序使用）

編輯 `.env`，修改 `FRONTEND_PORT`：

```env
FRONTEND_PORT=9443
```

重新啟動：

```bash
sudo docker compose up -d
```

### 後端無法連接資料庫

確認 `.env` 中 `DB_PASSWORD` 與 `DB_USER` 和 `DB_NAME` 設定正確，
然後重新啟動所有服務：

```bash
sudo docker compose down
sudo docker compose up -d --build
```

### 完整重置（清除所有資料重新開始）

> 此操作會刪除所有資料庫資料，無法復原。

```bash
sudo docker compose down -v
sudo docker compose up -d --build
```

---

## 防火牆設定（選用）

若伺服器啟用了 UFW 防火牆，需開放存取埠：

```bash
sudo ufw allow 8443/tcp
sudo ufw reload
```

---

## 安全性建議

1. **修改預設密碼**：首次登入後立即更改所有預設帳號密碼。
2. **JWT_SECRET**：使用 `openssl rand -hex 32` 產生，不可使用預設值。
3. **DB_PASSWORD**：設定強密碼，不可使用 `changeme`。
4. **正式環境憑證**：若對外提供服務，建議使用 Let's Encrypt 簽署的正式憑證取代自簽憑證。
5. **網路存取限制**：建議僅允許管理網段存取 8443 埠。
