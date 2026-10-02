-- ============================================================================
-- NIFTY 50 Option Chain Analytics - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================================

-- 1. Create table for Market Snapshots (Hourly intervals: 09:15, 10:15, 11:15, 12:15, 13:15, 14:15, 15:30)
CREATE TABLE IF NOT EXISTS public.market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hour_slot VARCHAR(20) NOT NULL, -- e.g. "09:15", "10:15", "11:15", "12:15", "13:15", "14:15", "15:30", "MANUAL"
    spot_close NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_date_hour_slot UNIQUE (snapshot_date, hour_slot)
);

-- 2. Create table for Option Chain Strike Data per Snapshot
CREATE TABLE IF NOT EXISTS public.option_chain_hourly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES public.market_snapshots(id) ON DELETE CASCADE,
    strike NUMERIC(10, 2) NOT NULL,
    
    -- Call side raw and calculated metrics
    call_low NUMERIC(10, 2) NOT NULL DEFAULT 0,
    call_high NUMERIC(10, 2) NOT NULL DEFAULT 0,
    call_close NUMERIC(10, 2) NOT NULL DEFAULT 0,
    call_volume BIGINT NOT NULL DEFAULT 0,
    call_avg NUMERIC(10, 2) NOT NULL DEFAULT 0,     -- Calculated: (Call Close + Put Close) / 2
    call_premium NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Calculated: (Call Low + Put High) / 2
    
    -- Put side raw and calculated metrics
    put_low NUMERIC(10, 2) NOT NULL DEFAULT 0,
    put_high NUMERIC(10, 2) NOT NULL DEFAULT 0,
    put_close NUMERIC(10, 2) NOT NULL DEFAULT 0,
    put_volume BIGINT NOT NULL DEFAULT 0,
    put_avg NUMERIC(10, 2) NOT NULL DEFAULT 0,      -- Calculated: (Call Close + Put Close) / 2
    put_premium NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- Calculated: (Put Low + Call High) / 2
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for ultrafast querying
CREATE INDEX IF NOT EXISTS idx_market_snapshots_date_slot ON public.market_snapshots(snapshot_date, hour_slot);
CREATE INDEX IF NOT EXISTS idx_option_chain_snapshot_id ON public.option_chain_hourly_data(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_option_chain_strike ON public.option_chain_hourly_data(strike);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_chain_hourly_data ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Allow authenticated users full CRUD, allow anon read-only (or full if configured for app access)
CREATE POLICY "Allow public read access for market_snapshots"
    ON public.market_snapshots FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert/update on market_snapshots"
    ON public.market_snapshots FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read access for option_chain_hourly_data"
    ON public.option_chain_hourly_data FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert/update on option_chain_hourly_data"
    ON public.option_chain_hourly_data FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- (Optional fallback policy for anonymous demo writes if auth is bypassed in development)
CREATE POLICY "Allow anon insert for demo snapshots"
    ON public.market_snapshots FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anon insert for demo option rows"
    ON public.option_chain_hourly_data FOR INSERT
    TO anon
    WITH CHECK (true);

-- 6. Enable Realtime Publications for live sync across connected terminals
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.option_chain_hourly_data;

-- ============================================================================
-- SUCCESS: Schema ready for NIFTY 50 Option Chain Analytics
-- ============================================================================
