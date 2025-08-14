<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="mb-3">
                {{ $t("Quick Stats") }}
            </h1>

            <div class="shadow-box big-padding text-center mb-4">
                <div class="row">
                    <div class="col">
                        <h3>{{ $t("Up") }}</h3>
                        <span class="num">{{ $root.stats.up }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Down") }}</h3>
                        <span class="num text-danger">{{ $root.stats.down }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Maintenance") }}</h3>
                        <span class="num text-maintenance">{{ $root.stats.maintenance }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Unknown") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.unknown }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("pauseDashboardHome") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.pause }}</span>
                    </div>
                </div>
            </div>

            <!-- Monthly Uptime Table -->
            <div class="shadow-box table-shadow-box mb-4">
                <h3 class="mb-3">{{ $t("Monthly Uptime") }} ({{ $t("Last 12 Months") }})</h3>
                <div class="table-responsive">
                    <table class="table table-borderless table-hover uptime-table">
                        <thead>
                            <tr>
                                <th>{{ $t("Monitor") }}</th>
                                <th v-for="month in last12Months" :key="month.key" class="text-center month-header">
                                    {{ month.label }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="monitor in monitorUptimeData" :key="monitor.id">
                                <td class="monitor-name">
                                    <router-link :to="`/dashboard/${monitor.id}`">
                                        {{ monitor.name }}
                                    </router-link>
                                </td>
                                <td v-for="month in last12Months" :key="month.key" class="text-center uptime-cell">
                                    <span
                                        :class="getUptimeClass(monitor.uptime[month.key])"
                                        class="uptime-badge"
                                    >
                                        {{ formatUptimePercentage(monitor.uptime[month.key]) }}
                                    </span>
                                </td>
                            </tr>
                            <tr v-if="Object.keys($root.monitorList).length === 0">
                                <td :colspan="last12Months.length + 1" class="text-center text-muted">
                                    {{ $t("No monitors") }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="shadow-box table-shadow-box" style="overflow-x: hidden;">
                <table class="table table-borderless table-hover">
                    <thead>
                        <tr>
                            <th>{{ $t("Name") }}</th>
                            <th>{{ $t("Status") }}</th>
                            <th>{{ $t("DateTime") }}</th>
                            <th>{{ $t("Message") }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(beat, index) in displayedRecords" :key="index" :class="{ 'shadow-box': $root.windowWidth <= 550}">
                            <td><router-link :to="`/dashboard/${beat.monitorID}`">{{ beat.name }}</router-link></td>
                            <td><Status :status="beat.status" /></td>
                            <td :class="{ 'border-0':! beat.msg}"><Datetime :value="beat.time" /></td>
                            <td class="border-0">{{ beat.msg }}</td>
                        </tr>

                        <tr v-if="importantHeartBeatList.length === 0">
                            <td colspan="4">
                                {{ $t("No important events") }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="d-flex justify-content-center kuma_pagination">
                    <pagination
                        v-model="page"
                        :records="importantHeartBeatList.length"
                        :per-page="perPage"
                        :options="paginationConfig"
                    />
                </div>
            </div>
        </div>
    </transition>
    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import Pagination from "v-pagination-3";
import dayjs from "dayjs";

export default {
    components: {
        Datetime,
        Status,
        Pagination,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0
        }
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            heartBeatList: [],
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            monthlyUptimeData: [],
            monthlyUptimeLoaded: false,
        };
    },
    computed: {
        last12Months() {
            const months = [];
            for (let i = 0; i <= 11; i++) {
                const date = dayjs().subtract(i, "month");
                months.push({
                    key: date.format("YYYY-MM"),
                    label: date.format("MMM YYYY")
                });
            }
            return months;
        },

        monitorUptimeData() {
            if (!this.monthlyUptimeLoaded || this.monthlyUptimeData.length === 0) {
                return [];
            }

            // Create a map from the API data
            const apiDataMap = {};
            this.monthlyUptimeData.forEach(monitor => {
                apiDataMap[monitor.id] = monitor;
            });

            const monitors = [];
            for (let id in this.$root.monitorList) {
                const monitor = this.$root.monitorList[id];
                const uptimeData = {};

                // Use API data if available, fallback to calculation if not
                if (apiDataMap[id]) {
                    this.last12Months.forEach(month => {
                        uptimeData[month.key] = apiDataMap[id].uptime[month.key] || null;
                    });
                } else {
                    // Fallback to original calculation
                    this.last12Months.forEach(month => {
                        uptimeData[month.key] = this.calculateMonthlyUptime(id, month.key);
                    });
                }

                monitors.push({
                    id: monitor.id,
                    name: monitor.name,
                    uptime: uptimeData
                });
            }

            return monitors.sort((a, b) => a.name.localeCompare(b.name));
        },

        importantHeartBeatList() {
            let result = [];

            for (let monitorID in this.$root.importantHeartbeatList) {
                let list = this.$root.importantHeartbeatList[monitorID];
                result = result.concat(list);
            }

            for (let beat of result) {
                let monitor = this.$root.monitorList[beat.monitorID];

                if (monitor) {
                    beat.name = monitor.name;
                }
            }

            result.sort((a, b) => {
                if (a.time > b.time) {
                    return -1;
                }

                if (a.time < b.time) {
                    return 1;
                }

                return 0;
            });

            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            this.heartBeatList = result;

            return result;
        },

        displayedRecords() {
            const startIndex = this.perPage * (this.page - 1);
            const endIndex = startIndex + this.perPage;
            return this.heartBeatList.slice(startIndex, endIndex);
        },
    },
    watch: {
        importantHeartBeatList() {
            this.$nextTick(() => {
                this.updatePerPage();
            });
        },
    },
    mounted() {
        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();
        this.loadMonthlyUptimeData();
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.updatePerPage);
    },
    methods: {
        calculateMonthlyUptime(monitorId, monthKey) {
            // Get heartbeat data for the specific monitor
            const heartbeatList = this.$root.heartbeatList[monitorId];
            if (!heartbeatList || heartbeatList.length === 0) {
                return null;
            }

            const startOfMonth = dayjs(monthKey).startOf("month");
            const endOfMonth = dayjs(monthKey).endOf("month");

            // Filter heartbeats for the specific month
            const monthHeartbeats = heartbeatList.filter(beat => {
                const beatTime = dayjs(beat.time);
                return beatTime.isAfter(startOfMonth) && beatTime.isBefore(endOfMonth);
            });

            if (monthHeartbeats.length === 0) {
                return null;
            }

            // Calculate uptime percentage
            const upHeartbeats = monthHeartbeats.filter(beat => beat.status === 1);
            return (upHeartbeats.length / monthHeartbeats.length) * 100;
        },

        formatUptimePercentage(percentage) {
            if (percentage === null || percentage === undefined) {
                return "-";
            }
            return percentage.toFixed(1) + "%";
        },

        getUptimeClass(percentage) {
            if (percentage === null || percentage === undefined) {
                return "uptime-no-data";
            }
            if (percentage >= 99) {
                return "uptime-excellent";
            } else if (percentage >= 95) {
                return "uptime-good";
            } else if (percentage >= 90) {
                return "uptime-warning";
            } else {
                return "uptime-danger";
            }
        },

        loadMonthlyUptimeData() {
            this.$root.getSocket().emit("getMonthlyUptimeData", (res) => {
                if (res.ok) {
                    this.monthlyUptimeData = res.data;
                    this.monthlyUptimeLoaded = true;
                } else {
                    console.error("Failed to load monthly uptime data:", res.msg);
                    this.monthlyUptimeLoaded = true; // Still set to true to allow fallback
                }
            });
        },

        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.num {
    font-size: 30px;
    color: $primary;
    font-weight: bold;
    display: block;
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

.uptime-table {
    .month-header {
        font-weight: 600;
        font-size: 12px;
        min-width: 80px;
    }

    .monitor-name {
        font-weight: 500;
        min-width: 150px;
    }

    .uptime-cell {
        padding: 0.5rem 0.25rem;
    }

    .uptime-badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 600;
        min-width: 50px;
    }

    .uptime-excellent {
        background-color: #d1f7c4;
        color: #22c55e;
    }

    .uptime-good {
        background-color: #fef3c7;
        color: #f59e0b;
    }

    .uptime-warning {
        background-color: #fed7aa;
        color: #ea580c;
    }

    .uptime-danger {
        background-color: #fecaca;
        color: #dc2626;
    }

    .uptime-no-data {
        background-color: #f3f4f6;
        color: #6b7280;
    }
}

@media (max-width: 768px) {
    .uptime-table {
        .month-header {
            font-size: 10px;
            min-width: 60px;
        }

        .uptime-badge {
            font-size: 0.6rem;
            padding: 0.2rem 0.3rem;
            min-width: 40px;
        }
    }
}
</style>
