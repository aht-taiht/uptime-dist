const { log } = require("../../src/util");
const { Settings } = require("../settings");
const { sendInfo } = require("../client");
const { checkLogin } = require("../util-server");
const GameResolver = require("gamedig/lib/GameResolver");
const { testChrome } = require("../monitor-types/real-browser-monitor-type");
const { R } = require("redbean-node");

let gameResolver = new GameResolver();
let gameList = null;

/**
 * Get a game list via GameDig
 * @returns {Object[]} list of games supported by GameDig
 */
function getGameList() {
    if (gameList == null) {
        gameList = gameResolver._readGames().games.sort((a, b) => {
            if ( a.pretty < b.pretty ) {
                return -1;
            }
            if ( a.pretty > b.pretty ) {
                return 1;
            }
            return 0;
        });
    }
    return gameList;
}

module.exports.generalSocketHandler = (socket, server) => {

    socket.on("initServerTimezone", async (timezone) => {
        try {
            checkLogin(socket);
            log.debug("generalSocketHandler", "Timezone: " + timezone);
            await Settings.set("initServerTimezone", true);
            await server.setTimezone(timezone);
            await sendInfo(socket);
        } catch (e) {
            log.warn("initServerTimezone", e.message);
        }
    });

    socket.on("getGameList", async (callback) => {
        try {
            checkLogin(socket);
            callback({
                ok: true,
                gameList: getGameList(),
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("testChrome", (executable, callback) => {
        try {
            checkLogin(socket);
            // Just noticed that await call could block the whole socket.io server!!! Use pure promise instead.
            testChrome(executable).then((version) => {
                callback({
                    ok: true,
                    msg: "Found Chromium/Chrome. Version: " + version,
                });
            }).catch((e) => {
                callback({
                    ok: false,
                    msg: e.message,
                });
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Disconnect all other socket clients of the user
    socket.on("disconnectOtherSocketClients", async () => {
        try {
            checkLogin(socket);
            server.disconnectAllSocketClients(socket.userID, socket.id);
        } catch (e) {
            log.warn("disconnectAllSocketClients", e.message);
        }
    });

    // Get monthly uptime data for dashboard
    socket.on("getMonthlyUptimeData", async (callback) => {
        try {
            checkLogin(socket);

            // Get the last 12 months data
            const monthlyUptimeData = await R.getAll(`
                SELECT 
                    mu.monitor_id,
                    mu.year_month,
                    mu.uptime_percentage,
                    m.name as monitor_name
                FROM monthly_uptime mu
                JOIN monitor m ON mu.monitor_id = m.id
                WHERE m.user_id = ? 
                AND mu.year_month >= date('now', '-12 months', 'start of month')
                ORDER BY mu.monitor_id, mu.year_month
            `, [ socket.userID ]);

            // Group data by monitor
            const groupedData = {};
            for (const row of monthlyUptimeData) {
                if (!groupedData[row.monitor_id]) {
                    groupedData[row.monitor_id] = {
                        id: row.monitor_id,
                        name: row.monitor_name,
                        uptime: {}
                    };
                }
                groupedData[row.monitor_id].uptime[row.year_month] = row.uptime_percentage;
            }

            callback({
                ok: true,
                data: Object.values(groupedData)
            });
        } catch (e) {
            log.error("getMonthlyUptimeData", e.message);
            callback({
                ok: false,
                msg: e.message
            });
        }
    });
};
