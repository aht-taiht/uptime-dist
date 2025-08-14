-- Create monthly_uptime table to store pre-calculated monthly uptime percentages
-- This will improve performance for dashboard monthly uptime display

CREATE TABLE IF NOT EXISTS monthly_uptime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    year_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    total_heartbeats INTEGER NOT NULL DEFAULT 0,
    successful_heartbeats INTEGER NOT NULL DEFAULT 0,
    uptime_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitor(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(monitor_id, year_month)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_uptime_monitor_id ON monthly_uptime(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_uptime_year_month ON monthly_uptime(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_uptime_monitor_month ON monthly_uptime(monitor_id, year_month);

-- Note: Simplified approach without triggers for now
-- We will implement batch processing instead of real-time triggers