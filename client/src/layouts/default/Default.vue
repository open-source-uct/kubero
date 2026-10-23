<template>
  <v-app>
    <app-bar />
    <nav-drawer/>
    <default-view />
  </v-app>
</template>

<script lang="ts" setup>
  import AppBar from './AppBar.vue'
  import NavDrawer from './NavDrawer.vue'
  import DefaultView from './View.vue'
  
</script>

<script lang="ts">

import { useKuberoStore } from '../../stores/kubero'
import { useAuthStore } from '../../stores/auth'
import { useSocketIO } from '../../socket.io';
import { useNotificationStore } from '../../stores/notifications';

const { socket } = useSocketIO();

// Write socket to pinia
const kuberoStore = useKuberoStore();
kuberoStore.kubero.socket = socket;
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

type Message = {
    name: string,
    user: string,
    resource: "system" | "app" | "pipeline" | "phase" | "namespace" | "addon" | "settings" | "user" | "events" | "templates" | "config" | "addons" | "kubernetes" | "unknown",
    action: string,
    severity: "normal" | "info" | "warning" | "critical" | "error" | "unknown",
    message: string,
    phaseName: string,
    pipelineName: string,
    appName: string,
    data?: any
}

socket.on('newApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('updateApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('deleteApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('restartApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('rebuildApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('handleWebhookPush', (message: Message) => {
    triggerToast('App', message);
});
socket.on('deployApp', (message: Message) => {
    triggerToast('App', message);
});
socket.on('newBuild', (message: Message) => {
    triggerToast('App', message);
});

socket.on('newPipeline', (message: Message) => {
    triggerToast('Pipeline', message);
});
socket.on('updatePipeline', (message: Message) => {
    triggerToast('Pipeline', message);
});
socket.on('deletePipeline', (message: Message) => {
    triggerToast('Pipeline', message);
});

socket.on('updateSettings', (message: Message) => {
    triggerToast('Kubero System', message);
});

function triggerToast(resource: string, message: Message) {
  if (message.user && message.user === authStore.username) return;
  notificationStore.success(`${resource} ${message.action}`, message.message ?? '');
}
</script>
