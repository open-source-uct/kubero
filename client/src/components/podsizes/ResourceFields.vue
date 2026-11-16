<template>
  <div class="podsize-resources">
    <p class="podsize-resources__hint">{{ $t('podsizes.form.resourcesHint') }}</p>
    <div class="podsize-resources__grid">
      <ValidationField as="v-select" :validation="validation.field('requests-cpu')"
        :model-value="modelValue.requests.cpu"
        :items="cpuOptions(modelValue.requests.cpu)"
        :label="$t('podsizes.form.cpuRequest')"
        @update:model-value="update('requests', 'cpu', $event)"
      ></ValidationField>
      <ValidationField as="v-select" :validation="validation.field('limits-cpu')"
        :model-value="modelValue.limits.cpu"
        :items="cpuOptions(modelValue.limits.cpu)"
        :label="$t('podsizes.form.cpuLimit')"
        @update:model-value="update('limits', 'cpu', $event)"
      ></ValidationField>
      <ValidationField as="v-select" :validation="validation.field('requests-memory')"
        :model-value="modelValue.requests.memory"
        :items="memoryOptions(modelValue.requests.memory)"
        :label="$t('podsizes.form.memoryRequest')"
        @update:model-value="update('requests', 'memory', $event)"
      ></ValidationField>
      <ValidationField as="v-select" :validation="validation.field('limits-memory')"
        :model-value="modelValue.limits.memory"
        :items="memoryOptions(modelValue.limits.memory)"
        :label="$t('podsizes.form.memoryLimit')"
        @update:model-value="update('limits', 'memory', $event)"
      ></ValidationField>
    </div>
  </div>
</template>

<script lang="ts">
import type { FormValidation } from '../../composables/useFormValidation'
import { defineComponent, PropType } from 'vue'
import {
  cpuOptions,
  memoryOptions,
  PodsizeResources,
} from '../../utils/podsizeOptions'

export default defineComponent({
  name: 'PodsizeResourceFields',
  props: {
    validation: { type: Object as PropType<FormValidation>, required: true },
    modelValue: {
      type: Object as PropType<PodsizeResources>,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const update = (kind: 'requests' | 'limits', key: 'cpu' | 'memory', value: string) => {
      emit('update:modelValue', {
        ...props.modelValue,
        [kind]: { ...props.modelValue[kind], [key]: value },
      })
    }
    return { cpuOptions, memoryOptions, update }
  },
})
</script>

<style scoped>
.podsize-resources__hint {
  margin: 4px 0 12px;
  color: rgb(var(--v-theme-on-cardBackground));
  font-size: .8125rem;
  opacity: .7;
}
.podsize-resources__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
@media (max-width: 600px) {
  .podsize-resources__grid { grid-template-columns: 1fr; }
}
</style>
