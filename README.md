# SecVuln v2

Security vulnerability management platform with bilingual (zh/en) UI, RBAC, device management, and risk acceptance workflow.

**Stack:** React + Vite · Node.js + Express · PostgreSQL

---

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Configure backend environment

```bash
cp backend/.env.example backend/.env
```

The defaults match the `docker-compose.yml` config — no edits needed for local dev.

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run database migrations + seed

```bash
cd backend
npm run migrate
```

### 5. Start both servers

Open two terminals:

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Demo Accounts

| Role       | Username          | Password   |
|------------|-------------------|------------|
| superadmin | admin@example.com | admin123   |
| admin      | mgr@example.com   | admin123   |
| user       | analyst@example.com | admin123 |
| user       | viewer@example.com  | admin123 |

---

## Project Structure

```
secvulnv2/
├── backend/
│   ├── migrations/          # SQL schema + seed files
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # auth, errorHandler
│   │   ├── routes/          # Express routers
│   │   ├── db.js            # pg Pool
│   │   └── index.js         # Express app entry
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Sidebar, Header, ui/, Icons
│   │   ├── contexts/        # AuthContext, LangContext
│   │   ├── pages/           # Dashboard, Search, Devices, Users, Settings, Login
│   │   ├── services/        # api.js (Axios + interceptors)
│   │   ├── styles/          # tokens.js (design system)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
└── docker-compose.yml
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/vulnerabilities` | ✓ | List + filter vulns |
| PATCH | `/api/vulnerabilities/:id/status` | admin+ | Update status |
| POST | `/api/vulnerabilities/:id/notes` | ✓ | Add note |
| POST | `/api/vulnerabilities/:id/risk-acceptance` | admin+ | Set risk acceptance |
| GET | `/api/devices` | ✓ | List devices |
| POST | `/api/devices` | admin+ | Create device |
| PUT | `/api/devices/:id` | admin+ | Update device |
| DELETE | `/api/devices/:id` | admin+ | Delete device |
| POST | `/api/devices/:id/scan` | admin+ | Trigger scan |
| GET | `/api/users` | admin+ | List users |
| POST | `/api/users` | admin+ | Create user |
| PUT | `/api/users/:id` | admin+ | Update user |
| DELETE | `/api/users/:id` | admin+ | Delete user |
| GET | `/api/settings` | ✓ | Get settings |
| PUT | `/api/settings` | superadmin | Update settings |
| GET | `/api/dashboard/stats` | ✓ | Aggregate stats |
| GET | `/api/dashboard/trend` | ✓ | Monthly trend data |
| GET | `/api/dashboard/reviews` | ✓ | Upcoming risk reviews |
