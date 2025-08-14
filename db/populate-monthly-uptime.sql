-- Populate monthly_uptime table with existing heartbeat data
-- This script should be run once after creating the monthly_uptime table

INSERT OR REPLACE INTO monthly_uptime (monitor_id, year_month, total_heartbeats, successful_heartbeats, uptime_percentage, created_date, updated_date)
SELECT 
    h.monitor_id,
    strftime('%Y-%m', h.time) as year_month,
    COUNT(*) as total_heartbeats,
    SUM(CASE WHEN h.status = 1 THEN 1 ELSE 0 END) as successful_heartbeats,
    ROUND(SUM(CASE WHEN h.status = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as uptime_percentage,
    MIN(h.time) as created_date,
    MAX(h.time) as updated_date
FROM heartbeat h
JOIN monitor m ON h.monitor_id = m.id
WHERE m.active = 1  -- Only calculate for active monitors
GROUP BY h.monitor_id, strftime('%Y-%m', h.time)
ORDER BY h.monitor_id, year_month;