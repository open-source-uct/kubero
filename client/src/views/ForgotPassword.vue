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
                <div class="uct-section-title mb-1">{{ $t('user.forgotPasswordTitle') }}</div>
            </div>

            <template v-if="sent">
                <v-alert type="success" variant="tonal" density="compact" class="mb-4">
                    {{ $t('user.forgotPasswordSent') }}
                </v-alert>
                <v-btn block variant="text" color="primary" to="/login">
                    {{ $t('user.backToLogin') }}
                </v-btn>
            </template>

            <template v-else>
                <p class="text-body-2 text-medium-emphasis mb-4">{{ $t('user.forgotPasswordHint') }}</p>

                <v-alert
                    v-if="error"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                >
                    {{ error }}
                </v-alert>

                <v-form @submit.prevent="submit">
                    <ValidationField as="v-text-field" :validation="validation.field('email')"
                        v-model="email"
                        :label="$t('user.email')"
                        type="email"
                        name="email"
                        variant="outlined"
                        density="comfortable"
                        color="primary"
                        prepend-inner-icon="mdi-email-outline"
                        required
                        class="mb-4"
                    ></ValidationField>

                    <FormValidationSummary :validation="validation" />
                    <v-btn
                        block
                        color="primary"
                        size="large"
                        type="submit"
                        elevation="1"
                        class="font-weight-bold mb-2"
                        :loading="loading" :disabled="!validation.valid || loading"
                    >
                        {{ $t('user.forgotPasswordSend') }}
                    </v-btn>
                    <v-btn block variant="text" color="primary" to="/login">
                        {{ $t('user.backToLogin') }}
                    </v-btn>
                </v-form>
            </template>
        </v-card>
    </div>
</template>

<script lang="ts">
import formValidationMixin from "../composables/formValidationMixin";
import { rules } from "../utils/validationRules";
import type { ValidationFieldDefinition } from "../composables/useFormValidation";

import axios from 'axios'
import { defineComponent } from 'vue'
import i18n from '@/plugins/i18n'

export default defineComponent({
    mixins: [formValidationMixin],
    name: 'ForgotPassword',
    data: () => ({
        email: '',
        loading: false,
        sent: false,
        error: '',
    }),
    computed: { validationFields(): ValidationFieldDefinition[] { return [{ id: 'email', label: this.$t('user.email'), value: this.email, rules: [rules.required, rules.email] }] } },
    methods: {
        submit() {
            if (this.loading || !this.validation.validate()) return
            this.loading = true
            this.error = ''
            axios.post('/api/auth/forgot-password', { email: this.email })
                .then(() => {
                    // Siempre se muestra como éxito, exista o no la cuenta
                    // (el backend responde igual en ambos casos).
                    this.sent = true
                })
                .catch((err) => {
                    if (err?.response?.status === 429) {
                        this.error = String(i18n.global.t('feedback.apiReasons.rateLimited'))
                    } else {
                        // No revelar detalles del error: mismo mensaje que el éxito,
                        // para no filtrar si el correo existe o no.
                        this.sent = true
                    }
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
