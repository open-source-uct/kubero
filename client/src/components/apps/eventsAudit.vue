<template>
    <div class="app-audit-wrap">
        <v-card
        class="app-audit uct-card"
        color="cardBackground"
        elevation="0"
        v-if="auditEvents.length >0">
            <v-card-title class="app-audit__header">
                <v-icon icon="mdi-history" color="primary" size="20"></v-icon>
                <h2>{{ $t('app.audit.title') }}</h2>
            </v-card-title>
            <v-card-text class="app-audit__body">
                <v-row class="ma-0">
                    <v-timeline align-top truncate-line="start" side="end" class="app-audit__timeline">
                        <v-timeline-item
                            v-for="event in auditEvents" :key="event.id"
                            :color=event.color
                            :icon=getIcon(event.action)
                            dot-color="var(--v-primary-base)"
                            fill-dot>
                            <div class="app-audit__event">
                                <!--<strong class="me-4">{{ event.metadata.creationTimestamp }}</strong>-->
                                <div>
                                    <strong>{{ event.users.username }}: </strong> {{ event.action }} {{ event.resource }}
                                    <div class="text-caption">
                                        {{ event.timestamp }} · v{{ event.id }} · {{ event.message }}
                                    </div>
                                </div>
                            </div>
                            <v-divider v-if="event !== auditEvents[auditEvents.length - 1]" ></v-divider>
                        </v-timeline-item>

                    </v-timeline>
                </v-row>
            </v-card-text>
        </v-card>

        <v-alert
            class="app-audit__empty"
            type="info"
            variant="tonal"
            v-if="auditEvents.length <1">
            <h3>{{ $t('app.audit.emptyTitle') }}</h3>
            {{ $t('app.audit.emptyMessage') }}

        </v-alert>
    </div>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent } from 'vue'

type AuditEvent = {
    id: string,
    timestamp: string,
    user: string,
    action: string,
    namespace: string,
    phase: string,
    app: string,
    pipeline: string,
    resource: string,
    message: string,
    severity: string,
    color: string,
    icon: string,
    users: {
        id?: string,
        username: string,
        email?: string,
        firstName?: string,
        lastName?: string,
    },
}


export default defineComponent({
    props: {
        pipeline: {
            type: String,
            default: "MISSING"
        },
        phase: {
            type: String,
            default: "MISSING"
        },
        app: {
            type: String,
            default: "new"
        }
    },
    data () {
        return {
            auditEvents: [] as AuditEvent[],
            limit: 10,
            count: 0,
        }
    },
    mounted() {
        this.loadAudit();
    },
    components: {
        
    },
    methods: {
        getIcon(action: string) {
            if (action === "create") return "mdi-creation";
            if (action === "update") return "mdi-pencil";
            if (action === "delete") return "mdi-delete";
            if (action === "start") return "mdi-play";
            if (action === "stop") return "mdi-stop";
            if (action === "restart") return "mdi-restart";
            if (action === "scale") return "mdi-arrow-expand-vertical";
            if (action === "rollback") return "mdi-history";
            if (action === "promote") return "mdi-arrow-up-bold";
            if (action === "demote") return "mdi-arrow-down-bold";
            if (action === "approve") return "mdi-check";
            if (action === "reject") return "mdi-close";
            if (action === "pause") return "mdi-pause";
            if (action === "resume") return "mdi-play";
            if (action === "deploy") return "mdi-rocket";
            if (action === "undeploy") return "mdi-rocket";
            if (action === "release") return "mdi-rocket";
            if (action === "rollback") return "mdi-rocket";
            return "mdi-rocket";
        },
        loadAudit() {
            axios.get(`/api/audit/app/${this.pipeline}/${this.phase}/${this.app}`, { params: { limit: this.limit } }).then(response => {
                this.auditEvents = response.data.audit;
                this.count = response.data.count;
            });
        },
    }
});
</script>

<style lang="scss" scoped>
.app-audit-wrap {
    min-width: 0;
}

.app-audit {
    overflow: hidden;
}

.app-audit__header {
    display: flex;
    min-height: 64px;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    border-bottom: 1px solid var(--uct-corp-gray-border);
    background: rgba(var(--v-theme-secondary), 0.38);
}

.app-audit__header h2 {
    margin: 0;
    color: rgb(var(--v-theme-on-cardBackground));
    font-size: 0.875rem;
    font-weight: 650;
}

.app-audit__body {
    padding: 20px 18px 12px;
}

.app-audit__timeline {
    width: 100%;
    margin: 0;
}

.app-audit__timeline :deep(.v-timeline-item__body) {
    min-width: 0;
    padding-bottom: 18px;
}

.app-audit__event {
    color: rgb(var(--v-theme-on-cardBackground));
    font-size: 0.8125rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
}

.app-audit__event .text-caption {
    margin-top: 4px;
    opacity: 0.72;
}

.app-audit__empty {
    border-radius: 12px;
}
</style>
