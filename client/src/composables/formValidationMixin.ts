import { defineComponent } from 'vue'
import { createFormValidation, validationRowId, type FormValidation, type ValidationFieldDefinition } from './useFormValidation'

// Options API forms use the same controller as Composition API forms.
export default defineComponent({
  data: () => ({ validation: null as unknown as FormValidation, validationSaving: false }),
  created() {
    this.validation = createFormValidation(() => (this as unknown as { validationFields: ValidationFieldDefinition[] }).validationFields)
  },
  methods: { validationRowId },
})
