<template>
    <div class="shadow-box">
        <h3 class="mb-3">{{ $t("Monthly Downtime Statistics") }}</h3>
        
        <div class="row mb-3">
            <div class="col-md-6">
                <label class="form-label">{{ $t("Select Month") }}</label>
                <select v-model="selectedMonth" class="form-select" @change="loadDowntimeEvents">
                    <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                        {{ month.label }}
                    </option>
                </select>
            </div>
            <div class="col-md-6">
                <label class="form-label">{{ $t("Filter by Duration") }}</label>
                <div class="duration-filters">
                    <div class="form-check">
                        <input 
                            id="duration-all" 
                            v-model="selectedDurationFilter" 
                            class="form-check-input" 
                            type="radio" 
                            value="all" 
                            @change="applyFilters"
                        >
                        <label class="form-check-label" for="duration-all">
                            {{ $t("All durations") }}
                        </label>
                    </div>
                    <div class="form-check">
                        <input 
                            id="duration-under5min" 
                            v-model="selectedDurationFilter" 
                            class="form-check-input" 
                            type="radio" 
                            value="under5min" 
                            @change="applyFilters"
                        >
                        <label class="form-check-label" for="duration-under5min">
                            {{ $t("Less than 5 minutes") }}
                        </label>
                    </div>
                    <div class="form-check">
                        <input 
                            id="duration-5to30min" 
                            v-model="selectedDurationFilter" 
                            class="form-check-input" 
                            type="radio" 
                            value="5to30min" 
                            @change="applyFilters"
                        >
                        <label class="form-check-label" for="duration-5to30min">
                            {{ $t("5 - 30 minutes") }}
                        </label>
                    </div>
                    <div class="form-check">
                        <input 
                            id="duration-over30min" 
                            v-model="selectedDurationFilter" 
                            class="form-check-input" 
                            type="radio" 
                            value="over30min" 
                            @change="applyFilters"
                        >
                        <label class="form-check-label" for="duration-over30min">
                            {{ $t("More than 30 minutes") }}
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="text-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">{{ $t("Loading") }}...</span>
            </div>
        </div>

        <div v-else class="table-responsive">
            <div v-if="totalDowntimeEvents > 0" class="mt-3">
                <div class="row">
                    <div class="col-md-6">
                        <p class="text-muted mb-0">
                            {{ $t("Total downtime events") }}: <strong>{{ totalDowntimeEvents }}</strong>
                            <span v-if="selectedDurationFilter !== 'all'" class="badge bg-info ms-2">
                                {{ $t("Filtered") }}
                            </span>
                        </p>
                    </div>
                    <div class="col-md-6">
                        <p class="text-muted mb-0">
                            {{ $t("Total downtime duration") }}: <strong>{{ formatTotalDuration(totalDowntimeDuration) }}</strong>
                        </p>
                    </div>
                </div>
                <div v-if="selectedDurationFilter !== 'all'" class="row mt-2">
                    <div class="col-12">
                        <p class="text-info small mb-0">
                            <i class="fas fa-filter"></i>
                            {{ $t("Showing only") }}: {{ getDurationFilterLabel() }}
                        </p>
                    </div>
                </div>
            </div>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th style="width: 80px;">{{ $t("No.") }}</th>
                        <th style="width: 150px;">{{ $t("DateTime") }}</th>
                        <th style="width: 120px;">{{ $t("Duration") }}</th>
                        <th>{{ $t("Message") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(event, index) in groupedDowntimeEvents" :key="event.id">
                        <td class="text-center">{{ index + 1 }}</td>
                        <td>
                            <div>
                                <strong>{{ $t("Start") }}:</strong> <Datetime :value="event.startTime" />
                            </div>
                            <div v-if="event.endTime" class="text-muted">
                                <strong>{{ $t("End") }}:</strong> <Datetime :value="event.endTime" />
                            </div>
                            <div v-else class="text-warning">
                                <strong>{{ $t("Status") }}:</strong> {{ $t("Ongoing downtime") }}
                            </div>
                        </td>
                        <td>
                            <span v-if="event.totalDuration > 0" class="badge bg-danger">
                                {{ formatDuration(event.totalDuration) }}
                            </span>
                            <span v-else-if="!event.endTime" class="badge bg-warning">
                                {{ $t("Ongoing") }}
                            </span>
                            <span v-else class="text-muted">-</span>
                        </td>
                        <td>
                            <span v-if="event.messages && event.messages.length > 0" :title="event.messages.join('; ')">
                                {{ event.messages.join('; ').length > 50 ? event.messages.join('; ').substring(0, 50) + '...' : event.messages.join('; ') }}
                            </span>
                            <span v-else class="text-muted">{{ $t("No message") }}</span>
                            <div v-if="event.eventCount > 1" class="text-muted small">
                                {{ event.eventCount }} {{ $t("events") }}
                            </div>
                        </td>
                    </tr>
                    <tr v-if="groupedDowntimeEvents.length === 0 && !loading">
                        <td colspan="4" class="text-center text-muted py-4">
                            {{ $t("No downtime events in this month") }}
                        </td>
                    </tr>
                </tbody>
            </table>

        </div>
    </div>
</template>

<script>
import Datetime from "./Datetime.vue";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export default {
    name: "DowntimeMonthlyTable",
    components: {
        Datetime,
    },
    props: {
        monitorId: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {
            downtimeEvents: [],
            allEvents: [], // Store all events (downtime + uptime) for grouping
            selectedMonth: dayjs().format("YYYY-MM"),
            selectedDurationFilter: "all",
            monthOptions: [],
            loading: false,
            totalDowntimeEvents: 0,
            totalDowntimeDuration: 0,
        };
    },
    computed: {
        /**
         * Group consecutive downtime events together
         * @returns {Array} Grouped downtime events
         */
        groupedDowntimeEvents() {
            if (!this.allEvents || this.allEvents.length === 0) {
                return [];
            }

            const groupedEvents = this.groupConsecutiveEvents(this.allEvents);
            return this.filterByDuration(groupedEvents);
        },
    },
    mounted() {
        this.generateMonthOptions();
        this.loadDowntimeEvents();

        // Listen for new heartbeat events
        // this.$root.emitter.on("newImportantHeartbeat", this.onNewHeartbeat);
    },
    methods: {
        /**
         * Generate month options for the last 12 months
         */
        generateMonthOptions() {
            this.monthOptions = [];
            for (let i = 0; i < 12; i++) {
                const date = dayjs().subtract(i, "month");
                this.monthOptions.push({
                    value: date.format("YYYY-MM"),
                    label: date.format("MMMM YYYY"),
                });
            }
        },

        /**
         * Group consecutive downtime events into periods
         * @param {Array} allEvents Array of all heartbeat events (status 0 and 1)
         * @returns {Array} Grouped downtime periods
         */
        groupConsecutiveEvents(allEvents) {
            if (!allEvents || allEvents.length === 0) return [];

            // Sort events by time (oldest first)
            const sortedEvents = [...allEvents].sort((a, b) => new Date(a.time) - new Date(b.time));
            
            const downtimePeriods = [];
            let currentDowntimePeriod = null;

            for (let i = 0; i < sortedEvents.length; i++) {
                const event = sortedEvents[i];

                if (event.status === 0) { // Downtime event
                    if (!currentDowntimePeriod) {
                        // Start new downtime period
                        currentDowntimePeriod = {
                            id: event.id,
                            startTime: event.time,
                            endTime: null,
                            totalDuration: 0,
                            messages: event.msg ? [event.msg] : [],
                            eventCount: 1,
                            downtimeEvents: [event]
                        };
                    } else {
                        // Continue existing downtime period
                        currentDowntimePeriod.eventCount++;
                        currentDowntimePeriod.downtimeEvents.push(event);
                        if (event.msg && !currentDowntimePeriod.messages.includes(event.msg)) {
                            currentDowntimePeriod.messages.push(event.msg);
                        }
                    }
                } else if (event.status === 1 && currentDowntimePeriod) { // Uptime event after downtime
                    // End the current downtime period
                    currentDowntimePeriod.endTime = event.time;
                    
                    // Calculate actual duration (end time - start time)
                    const startTime = dayjs(currentDowntimePeriod.startTime);
                    const endTime = dayjs(currentDowntimePeriod.endTime);
                    currentDowntimePeriod.totalDuration = endTime.diff(startTime, 'seconds');
                    
                    // Add to periods and reset
                    downtimePeriods.push(currentDowntimePeriod);
                    currentDowntimePeriod = null;
                }
            }

            // Handle case where downtime period hasn't ended yet (no uptime event found)
            if (currentDowntimePeriod) {
                // If no end time found, leave endTime as null (ongoing downtime)
                currentDowntimePeriod.endTime = null;
                currentDowntimePeriod.totalDuration = 0; // Cannot calculate without end time
                downtimePeriods.push(currentDowntimePeriod);
            }

            return downtimePeriods.reverse(); // Return newest first for display
        },

        /**
         * Filter events by duration based on selected filter
         * @param {Array} events Array of grouped downtime events
         * @returns {Array} Filtered events
         */
        filterByDuration(events) {
            if (this.selectedDurationFilter === "all") {
                return events;
            }

            return events.filter(event => {
                // Skip filtering for ongoing downtime events (no end time)
                if (!event.endTime || event.totalDuration <= 0) {
                    return this.selectedDurationFilter === "over30min"; // Show ongoing events in "over 30 min" category
                }

                const durationMinutes = event.totalDuration / 60; // Convert seconds to minutes

                switch (this.selectedDurationFilter) {
                    case "under5min":
                        return durationMinutes < 5;
                    case "5to30min":
                        return durationMinutes >= 5 && durationMinutes <= 30;
                    case "over30min":
                        return durationMinutes > 30;
                    default:
                        return true;
                }
            });
        },

        /**
         * Apply filters and recalculate statistics
         */
        applyFilters() {
            // The computed property will automatically recalculate
            // Update statistics based on filtered events
            const filteredEvents = this.groupedDowntimeEvents;
            this.totalDowntimeEvents = filteredEvents.length;
            this.totalDowntimeDuration = filteredEvents.reduce((total, group) => total + (group.totalDuration || 0), 0);
        },

        /**
         * Load downtime events for the selected month
         */
        loadDowntimeEvents() {
            this.loading = true;
            try {
                const startOfMonth = dayjs(this.selectedMonth).startOf("month");
                const endOfMonth = dayjs(this.selectedMonth).endOf("month");

                // Get all important heartbeats from importantHeartbeatList for this monitor
                const importantHeartbeats = this.$root.importantHeartbeatList[this.monitorId] || [];
                
                // Filter events for the selected month
                const allEvents = importantHeartbeats.filter(event => {
                    const eventDate = dayjs(event.time);
                    return eventDate.isAfter(startOfMonth.subtract(1, 'day')) && 
                           eventDate.isBefore(endOfMonth.add(1, 'day'));
                });
                
                // Store all events for grouping and filter downtime events for reference
                this.allEvents = allEvents;
                this.downtimeEvents = allEvents.filter(event => event.status === 0);
                
                // Apply filters and calculate statistics
                this.applyFilters();
            } catch (error) {
                console.error("Error loading downtime events:", error);
                this.allEvents = [];
                this.downtimeEvents = [];
                this.totalDowntimeEvents = 0;
                this.totalDowntimeDuration = 0;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Handle new heartbeat events
         * @param {object} heartbeat New heartbeat data
         */
        onNewHeartbeat(heartbeat) {
            if (heartbeat.monitorID === this.monitorId) {
                const heartbeatMonth = dayjs(heartbeat.time).format("YYYY-MM");
                if (heartbeatMonth === this.selectedMonth) {
                    // Refresh data if it's for the currently selected month
                    this.loadDowntimeEvents();
                }
            }
        },

        /**
         * Format duration in seconds to human readable format
         * @param {number} seconds Duration in seconds
         * @returns {string} Formatted duration
         */
        formatDuration(seconds) {
            if (!seconds || seconds < 0) return "0s";

            const d = dayjs.duration(seconds, "seconds");
            const hours = Math.floor(d.asHours());
            const minutes = d.minutes();
            const secs = d.seconds();

            if (hours > 0) {
                return `${hours}h ${minutes}m ${secs}s`;
            } else if (minutes > 0) {
                return `${minutes}m ${secs}s`;
            } else {
                return `${secs}s`;
            }
        },

        /**
         * Format total duration for summary
         * @param {number} totalSeconds Total duration in seconds
         * @returns {string} Formatted total duration
         */
        formatTotalDuration(totalSeconds) {
            if (!totalSeconds || totalSeconds < 0) return "0s";

            const d = dayjs.duration(totalSeconds, "seconds");
            const days = Math.floor(d.asDays());
            const hours = d.hours();
            const minutes = d.minutes();
            
            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            
            return parts.length > 0 ? parts.join(" ") : "< 1m";
        },

        /**
         * Get label for current duration filter
         * @returns {string} Filter label
         */
        getDurationFilterLabel() {
            switch (this.selectedDurationFilter) {
                case "under5min":
                    return this.$t("Less than 5 minutes");
                case "5to30min":
                    return this.$t("5 - 30 minutes");
                case "over30min":
                    return this.$t("More than 30 minutes");
                default:
                    return this.$t("All durations");
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.table-responsive {
    max-height: 500px;
    overflow-y: auto;
}

.badge {
    font-size: 11px;
}

.spinner-border {
    width: 2rem;
    height: 2rem;
}

.duration-filters {
    .form-check {
        margin-bottom: 0.5rem;
    }
    
    .form-check-label {
        font-size: 14px;
        cursor: pointer;
    }
    
    .form-check-input {
        cursor: pointer;
    }
}

@media (max-width: 768px) {
    .table th,
    .table td {
        font-size: 12px;
        padding: 6px 8px;
    }
    
    .badge {
        font-size: 10px;
    }
    
    .duration-filters {
        .form-check {
            margin-bottom: 0.3rem;
        }
        
        .form-check-label {
            font-size: 13px;
        }
    }
}
</style>
