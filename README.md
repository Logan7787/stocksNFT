# ⚡ NIFTY 50 Option Chain Analytics — Real-Time Pro Terminal

A production-ready, zero-lag, real-time **NIFTY 50 Option Chain Analytics Web Application** built with **React 18 + TypeScript + Tailwind CSS + Supabase**.

---

## 🚀 Key Features

### 1. Zero-Lag Real-Time Engine
- **Sub-Second Tick Processing:** Highly optimized state updates with `React.memo` row memoization to prevent unnecessary table re-renders.
- **Dual Streaming Modes:**
  - **Live Simulated High-Frequency Engine (Default):** Realistic Brownian motion spot micro-drift around 22,620.45 with dynamic volatility and volume accretion.
  - **Live Broker / NSE Proxy REST & WebSocket Feed:** Configurable in the Admin Settings modal for Upstox, Dhan HQ, AngelOne SmartAPI, or custom proxies.

### 2. Custom Mathematical Business Logic
For every strike price (in steps of 50: e.g. 22000, 22050, 22100... 23200), calculates:
1. **Call Premium Formula:**
   $$\text{Call Premium} = \frac{\text{Call Low} + \text{Put High}}{2}$$
2. **Put Premium Formula:**
   $$\text{Put Premium} = \frac{\text{Put Low} + \text{Call High}}{2}$$
3. **Average Price (AVG) Formula:**
   $$\text{AVG} = \frac{\text{Call Close} + \text{Put Close}}{2}$$
*(All calculated values are rounded to 2 decimal places).*

---

### 3. Option Chain Table Layout & Automatic Highlights

**Exact Side-by-Side Column Ordering:**
- **CALL Section (Left):** `VOLUME` | `PREMIUM` | `AVG` | `CLOSE`
- **CENTER Section:** `STRIKE`
- **PUT Section (Right):** `CLOSE` | `AVG` | `PREMIUM` | `VOLUME`

**Conditional Color Highlighting Rules:**
- 🟧 **Orange Highlight (`STRIKE` Column):** At-The-Money (ATM) Strike price closest to the live `Spot Close` (`#f97316`, white bold text).
- 🟩 **Light Green Highlight (`AVG` Column):** Minimum (lowest) `AVG` value cell(s) across the visible chain (`#86efac`, bold dark text).
- 🟦 **Light Blue Highlight (`PREMIUM` Column):**
  - Minimum `Call PREMIUM` cell (`#7dd3fc`, bold dark text).
  - Minimum `Put PREMIUM` cell (`#7dd3fc`, bold dark text).
- 🟨 **Light Yellow / Gold Highlight (`VOLUME` Column):** Top 2 highest `Call VOLUME` and Top 2 highest `Put VOLUME` strikes (`#fde047`, bold dark text).

---

### 4. Admin Authentication & Route Protection
- **Supabase Email & Password Authentication** with session persistence.
- **Instant One-Click Demo Admin Login** for quick testing and zero-friction evaluation.
- **Top Navigation Bar:**
  - App Title with live glow badge.
  - Live `Spot Close` with tick pulse indicators and delta percentage.
  - Date & Hourly Interval selector (`LIVE` stream or saved historical database slots).
  - Connection status badge (`Live Simulated` / `Broker Active` / `Supabase Synced`).
  - Fast actions: `Save Snapshot Now`, `Pause/Resume`, `Snapshot Archive`, `Formulas Guide`, `Settings Modal`, `Admin Logout`.

---

### 5. Supabase PostgreSQL Storage & Hourly Auto-Snapshots
- **Automatic 1-Hour Snapshot Countdown:** Automatically stores market state every hour during market hours (09:15 to 15:30 IST).
- **Manual "Save Snapshot Now" Button:** Instantly records option chain rows into the database.
- **Historical Snapshot Archive:** Filter by date and hour slot (`09:15`, `10:15`, `11:15`, `12:15`, `13:15`, `14:15`, `15:30`) to replay snapshots with original highlights.
- **CSV Export:** Download full option chain snapshots to CSV.

---

### 6. Mobile Responsive & Compact Views
- **Desktop:** Full side-by-side terminal view.
- **Mobile:** Sticky center strike column with smooth horizontal scrolling, PLUS a toggleable tabbed view (`CALLS (CE)`, `COMBINED`, `PUTS (PE)`, `METRICS`).

---

## 🗄️ Database Setup (Supabase)

To connect your Supabase project:
1. Open your [Supabase Dashboard](https://app.supabase.com) -> **SQL Editor**.
2. Run the SQL script located at `supabase/schema.sql`.
3. In the application UI, click the **Settings** (⚙️) icon on the top bar and enter your **Supabase URL** and **Anon Key** (or add them to `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build
```
