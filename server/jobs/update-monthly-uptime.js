const { R } = require("redbean-node");
const { log } = require("../../src/util");

/**
 * Background job to update monthly uptime statistics
 * This job runs periodically to calculate and update monthly uptime data
 */
class UpdateMonthlyUptimeJob {

    /**
     * Update monthly uptime data for all monitors
     */
    static async updateMonthlyUptime() {
        try {
            log.debug("UpdateMonthlyUptimeJob", "Starting monthly uptime update job");

            // Get all monitors
            const monitors = await R.findAll("monitor");
            
            for (const monitor of monitors) {
                await this.updateMonitorMonthlyUptime(monitor.id);
            }

            log.debug("UpdateMonthlyUptimeJob", `Updated monthly uptime for ${monitors.length} monitors`);
        } catch (error) {
            log.error("UpdateMonthlyUptimeJob", `Error updating monthly uptime: ${error.message}`);
        }
    }

    /**
     * Update monthly uptime data for a specific monitor
     * @param {number} monitorId - Monitor ID
     */
    static async updateMonitorMonthlyUptime(monitorId) {
        try {
            // Get heartbeat data for the last 12 months
            const monthlyData = await R.getAll(`
                SELECT 
                    strftime('%Y-%m', time) as year_month,
                    COUNT(*) as total_heartbeats,
                    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as successful_heartbeats,
                    MIN(time) as first_heartbeat,
                    MAX(time) as last_heartbeat
                FROM heartbeat 
                WHERE monitor_id = ? 
                AND time >= date('now', '-12 months', 'start of month')
                GROUP BY strftime('%Y-%m', time)
            `, [ monitorId ]);

            for (const data of monthlyData) {
                const uptimePercentage = data.total_heartbeats > 0 
                    ? Math.round((data.successful_heartbeats / data.total_heartbeats) * 10000) / 100
                    : 0;

                // Insert or update monthly uptime record
                await R.exec(`
                    INSERT OR REPLACE INTO monthly_uptime (
                        monitor_id, 
                        year_month, 
                        total_heartbeats, 
                        successful_heartbeats, 
                        uptime_percentage,
                        created_date,
                        updated_date
                    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    monitorId,
                    data.year_month,
                    data.total_heartbeats,
                    data.successful_heartbeats,
                    uptimePercentage,
                    data.first_heartbeat || new Date().toISOString()
                ]);
            }

        } catch (error) {
            log.error("UpdateMonthlyUptimeJob", `Error updating monthly uptime for monitor ${monitorId}: ${error.message}`);
        }
    }

    /**
     * Update monthly uptime for current month when new heartbeat arrives
     * @param {number} monitorId - Monitor ID
     * @param {string} time - Heartbeat timestamp
     * @param {number} status - Heartbeat status (1 = up, 0 = down)
     */
    static async updateCurrentMonthUptime(monitorId, time, status) {
        try {
            const yearMonth = new Date(time).toISOString().substring(0, 7); // YYYY-MM format

            // Get current month data
            const currentData = await R.getRow(`
                SELECT * FROM monthly_uptime 
                WHERE monitor_id = ? AND year_month = ?
            `, [ monitorId, yearMonth ]);

            if (currentData) {
                // Update existing record
                const newTotalHeartbeats = currentData.total_heartbeats + 1;
                const newSuccessfulHeartbeats = currentData.successful_heartbeats + (status === 1 ? 1 : 0);
                const newUptimePercentage = Math.round((newSuccessfulHeartbeats / newTotalHeartbeats) * 10000) / 100;

                await R.exec(`
                    UPDATE monthly_uptime 
                    SET 
                        total_heartbeats = ?,
                        successful_heartbeats = ?,
                        uptime_percentage = ?,
                        updated_date = CURRENT_TIMESTAMP
                    WHERE monitor_id = ? AND year_month = ?
                `, [
                    newTotalHeartbeats,
                    newSuccessfulHeartbeats,
                    newUptimePercentage,
                    monitorId,
                    yearMonth
                ]);
            } else {
                // Create new record for this month
                const uptimePercentage = status === 1 ? 100 : 0;
                
                await R.exec(`
                    INSERT INTO monthly_uptime (
                        monitor_id, 
                        year_month, 
                        total_heartbeats, 
                        successful_heartbeats, 
                        uptime_percentage,
                        created_date,
                        updated_date
                    ) VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [
                    monitorId,
                    yearMonth,
                    status === 1 ? 1 : 0,
                    uptimePercentage
                ]);
            }

        } catch (error) {
            log.error("UpdateMonthlyUptimeJob", `Error updating current month uptime: ${error.message}`);
        }
    }
}

module.exports = UpdateMonthlyUptimeJob;