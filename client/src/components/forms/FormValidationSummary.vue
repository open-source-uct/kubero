<template>
  <div v-if="validation.issues.length || reason" class="validation-summary" role="status" aria-live="polite" aria-atomic="true">
    <p><span aria-hidden="true">* </span>{{ reason || $t('validation.complete') }}</p>
    <ul v-if="!reason">
      <li v-for="issue in validation.issues" :key="issue.field">
        <button type="button" @click="validation.focus(issue.field)">{{ issue.label }}: {{ $t('validation.' + issue.key, issue.params || {}) }}</button>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import type { FormValidation } from '../../composables/useFormValidation'
defineProps<{ validation: FormValidation; reason?: string }>()
</script>
<style scoped>
.validation-summary { flex-basis: 100%; width: 100%; color: rgb(var(--v-theme-validation-error)); font-size: .875rem; line-height: 1.5; margin-block: 8px; }
.validation-summary p { margin: 0; }
.validation-summary ul { margin: 4px 0 0; padding-inline-start: 20px; }
.validation-summary button { text-align: start; text-decoration: underline; text-underline-offset: 3px; }
.validation-summary button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>
