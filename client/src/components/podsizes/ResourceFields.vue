<template>
  <div class="podsize-resources">
    <p class="podsize-resources__hint">{{ $t('podsizes.form.resourcesHint') }}</p>
    <div class="podsize-resources__grid">
      <v-select
        :model-value="modelValue.requests.cpu"
        :items="cpuOptions(modelValue.requests.cpu)"
        :label="$t('podsizes.form.cpuRequest')"
        :rules="[required]"
        @update:model-value="update('requests', 'cpu', $event)"
      ></v-select>
      <v-select
        :model-value="modelValue.limits.cpu"
        :items="cpuOptions(modelValue.limits.cpu)"
        :label="$t('podsizes.form.cpuLimit')"
        :rules="[required]"
        :error-messages="above.cpu ? $t('podsizes.errors.requestAboveLimit') : []"
        @update:model-value="update('limits', 'cpu', $event)"
      ></v-select>
      <v-select
        :model-value="modelValue.requests.memory"
        :items="memoryOptions(modelValue.requests.memory)"
        :label="$t('podsizes.form.memoryRequest')"
        :rules="[required]"
        @update:model-value="update('requests', 'memory', $event)"
      ></v-select>
      <v-select
        :model-value="modelValue.limits.memory"
        :items="memoryOptions(modelValue.limits.memory)"
        :label="$t('podsizes.form.memoryLimit')"
        :rules="[required]"
        :error-messages="above.memory ? $t('podsizes.errors.requestAboveLimit') : []"
        @update:model-value="update('limits', 'memory', $event)"
      ></v-select>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  cpuOptions,
  memoryOptions,
  PodsizeResources,
  requestAboveLimit,
} from '../../utils/podsizeOptions'

export default defineComponent({
  name: 'PodsizeResourceFields',
  props: {
    modelValue: {
      type: Object as PropType<PodsizeResources>,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const above = computed(() => requestAboveLimit(props.modelValue))
    const required = (value: string) => !!value || t('podsizes.errors.required')
    const update = (kind: 'requests' | 'limits', key: 'cpu' | 'memory', value: string) => {
      emit('update:modelValue', {
        ...props.modelValue,
        [kind]: { ...props.modelValue[kind], [key]: value },
      })
    }
    return { above, cpuOptions, memoryOptions, required, update }
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
