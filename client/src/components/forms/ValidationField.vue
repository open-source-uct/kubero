<template>
  <label v-if="outlined" :id="validation.id + '-label'" :for="validation.id" class="validation-field-label" :class="{ 'validation-error': validation.touched && failures.length > 0 }">
    <slot name="label">{{ validation.label || $attrs.label }}</slot><span v-if="validation.required" class="validation-error ms-1" aria-hidden="true">*</span>
  </label>
  <component
    :is="control" v-bind="$attrs" class="validated-field" :id="validation.id" :rules="[]" :hide-details="false"
    :style="{ '--v-theme-error': 'var(--v-theme-validation-error)' }"
    :label="outlined ? undefined : $attrs.label"
    :error="validation.touched && failures.length > 0"
    :error-messages="errorMessages"
    :aria-required="validation.required || undefined"
    :aria-labelledby="validation.id + '-label'"
    :aria-expanded="selection ? String(menu) : undefined"
    :aria-controls="selection ? validation.id + '-menu' : undefined"
    :menu-props="selection ? menuProps : undefined"
    :aria-invalid="validation.touched && failures.length > 0 || undefined"
    :aria-describedby="requirements.length ? validation.id + '-requirements' : undefined"
    @focusin="focused = true" @focusout="focused = false; validation.touch()"
    @update:menu="menu = $event"
  >
    <template v-for="(_, slot) in forwardedSlots" #[slot]="slotProps"><slot :name="slot" v-bind="slotProps || {}" /></template>
    <template v-if="!outlined" #label="slotProps">
      <slot name="label" v-bind="slotProps || {}">{{ validation.label || $attrs.label }}</slot>
      <span v-if="validation.required" class="validation-error ms-1" aria-hidden="true">*</span>
    </template>
    <template #details>
      <ul v-if="requirements.length" :id="validation.id + '-requirements'" class="validation-requirements" :class="{ 'validation-requirements--visible': focused || validation.touched }">
        <li v-for="(requirement, index) in requirements" :key="index" :class="{ 'validation-error': !requirement.valid }">
          <v-icon :icon="requirement.valid ? 'mdi-check-circle-outline' : 'mdi-circle-outline'" size="14" aria-hidden="true" />
          <span class="validation-sr-only">{{ $t(requirement.valid ? 'validation.met' : 'validation.pending') }}:</span>
          {{ requirementMessage(requirement) }}
        </li>
      </ul>
      <slot name="details" />
    </template>
  </component>
  <span v-if="!outlined" :id="validation.id + '-label'" class="validation-sr-only">{{ validation.label || $attrs.label }}</span>
</template>
<script setup lang="ts">
import { computed, ref, useSlots, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { VTextField, VSelect, VCombobox, VTextarea, VFileInput, VAutocomplete, VSlider, VRangeSlider } from 'vuetify/components'
import type { FieldFeedback, Requirement } from '../../composables/useFormValidation'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ validation: FieldFeedback; as?: string }>()
const controls = { 'v-text-field': VTextField, 'v-select': VSelect, 'v-combobox': VCombobox, 'v-textarea': VTextarea, 'v-file-input': VFileInput, 'v-autocomplete': VAutocomplete, VSlider, VRangeSlider }
const control = computed(() => controls[props.as as keyof typeof controls] || VTextField)
const focused = ref(false)
const menu = ref(false)
const attrs = useAttrs()
const outlined = computed(() => attrs.variant === 'outlined')
const selection = computed(() => ['v-select', 'v-combobox', 'v-autocomplete'].includes(props.as || ''))
const menuProps = computed(() => ({ ...(typeof attrs['menu-props'] === 'object' ? attrs['menu-props'] : {}), id: props.validation.id + '-menu', eager: true }))
const slots = useSlots()
const forwardedSlots = computed(() => Object.fromEntries(Object.entries(slots).filter(([name]) => name !== 'details' && name !== 'label')))
const failures = computed(() => props.validation.requirements.filter(requirement => !requirement.valid))
const requirements = computed(() => props.validation.requirements.filter(requirement => requirement.key !== 'required'))
const { t, te } = useI18n()
const message = (requirement: Requirement) => t('validation.' + requirement.key, requirement.params || {})
// The label's asterisk and aria-required already communicate mandatory fields.
const errorMessages = computed(() => {
  const failure = failures.value[0]
  return props.validation.touched && failure && failure.key !== 'required' ? [message(failure)] : []
})
const requirementMessage = (requirement: Requirement) => te('validation.requirement_' + requirement.key)
  ? t('validation.requirement_' + requirement.key, requirement.params || {}) : message(requirement)
</script>
<style>
.validation-error { color: rgb(var(--v-theme-validation-error)) !important; }
.validation-field-label { display: block; margin-block-end: 6px; font-size: .8125rem; font-weight: 500; line-height: 1.4; color: rgb(var(--v-theme-on-background)); }
.validated-field .v-field { --v-theme-error: var(--v-theme-validation-error); }
.validated-field .v-field-label { color: rgb(var(--v-theme-on-background)); opacity: .85; }
.validated-field .v-field--error .v-field-label { color: rgb(var(--v-theme-validation-error)) !important; opacity: 1; }
.validation-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.validation-requirements { display: none; list-style: none; padding: 0; margin: 4px 0 0; width: 100%; font-size: .8125rem; line-height: 1.5; color: rgb(var(--v-theme-on-background)); }
.validation-requirements--visible { display: grid; gap: 2px; }
.validation-requirements li { display: flex; gap: 6px; align-items: baseline; }
.validation-requirements .v-icon { flex-shrink: 0; align-self: center; }
.validated-field .v-messages { color: rgb(var(--v-theme-on-background)); opacity: .85; }
.validated-field .v-counter { color: rgb(var(--v-theme-on-background)); opacity: .85; }
.validated-field.v-input--error .v-messages { color: rgb(var(--v-theme-validation-error)) !important; opacity: 1; }
.v-input:has(.validation-requirements) .v-input__details { flex-wrap: wrap; }
.v-dialog .v-overlay__content > .v-form { display: flex; min-height: 0; max-height: calc(100dvh - 48px); }
.v-dialog .v-overlay__content > .v-form > .v-card { width: 100%; max-height: inherit; overflow-y: auto; }
</style>
