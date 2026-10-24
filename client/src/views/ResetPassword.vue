<template>
    <div class="login-wrapper">
        <v-card
            elevation="4"
            width="100%"
            max-width="440px"
            color="cardBackground"
            class="pa-6 uct-card mx-4"
        >
            <div class="text-center mb-6">
                <v-img
                    src="@/assets/logouct-header.png"
                    max-height="75"
                    max-width="260"
                    class="mx-auto mb-3"
                    alt="Universidad Católica de Temuco"
                ></v-img>
                <div class="uct-section-title mb-1">{{ $t('user.resetPasswordTitle') }}</div>
            </div>

            <template v-if="!token">
                <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
                    {{ $t('user.resetPasswordInvalid') }}
                </v-alert>
                <v-btn block variant="text" color="primary" to="/forgot-password">
                    {{ $t('user.forgotPassword') }}
                </v-btn>
            </template>

            <template v-else-if="success">
                <v-alert type="success" variant="tonal" density="compact" class="mb-4">
                    {{ $t('user.resetPasswordSuccess') }}
                </v-alert>
                <v-btn block color="primary" to="/login">
                    {{ $t('global.login') }}
                </v-btn>
            </template>

            <template v-else>
                <v-alert
                    v-if="error"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                >
                    {{ error }}
                </v-alert>

                <form @submit.prevent="submit">
                    <v-text-field
                        v-model="newPassword"
                        :label="$t('user.newPassword')"
                        type="password"
                        variant="outlined"
                        density="comfortable"
                        color="primary"
                        prepend-inner-icon="mdi-lock-outline"
                        :rules="[(v: string) => (!!v && v.length >= 8) || $t('user.errors.passwordMinLength')]"
                        required
                        class="mb-2"
                    ></v-text-field>

                    <v-text-field
                        v-model="confirmPassword"
                        :label="$t('user.confirmPassword')"
                        type="password"
                        variant="outlined"
                        density="comfortable"
                        color="primary"
                        prepend-inner-icon="mdi-lock-check-outline"
                        :rules="[(v: string) => v === newPassword || $t('user.errors.passwordMismatch')]"
                        required
                        class="mb-4"
                    ></v-text-field>

                    <v-btn
                        block
                        color="primary"
                        size="large"
                        type="submit"
                        elevation="1"
                        class="font-weight-bold"
                        :loading="loading"
                        :disabled="!newPassword || newPassword.length < 8 || newPassword !== confirmPassword"
                    >
                        {{ $t('user.resetPasswordSubmit') }}
                    </v-btn>
                </form>
            </template>
        </v-card>
    </div>
</template>

<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'
import i18n from '@/plugins/i18n'

export default defineComponent({
    name: 'ResetPassword',
    data: () => ({
        token: '',
        newPassword: '',
        confirmPassword: '',
        loading: false,
        success: false,
        error: '',
    }),
    mounted() {
        this.token = String(this.$route.query.token || '')
    },
    methods: {
        submit() {
            if (this.newPassword !== this.confirmPassword || this.newPassword.length < 8) {
                return
            }
            this.loading = true
            this.error = ''
            axios.post('/api/auth/reset-password', {
                token: this.token,
                newPassword: this.newPassword,
            })
                .then(() => {
                    this.success = true
                })
                .catch((err) => {
                    this.error = err?.response?.data?.message
                        || String(i18n.global.t('user.resetPasswordInvalid'))
                })
                .finally(() => {
                    this.loading = false
                })
        },
    },
})
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(var(--v-theme-navBG));
  padding: 1rem;
}
</style>
