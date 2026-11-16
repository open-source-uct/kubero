import { computed, markRaw, nextTick, reactive, ref } from 'vue'
import type { ValidationRule } from '../utils/validationRules'
import { empty } from '../utils/validationRules'

export interface ValidationFieldDefinition {
  id: string
  label: string
  value: unknown
  rules: ValidationRule[]
  active?: boolean
  reveal?: () => void
}
export interface Requirement { key: string; params?: ValidationRule['params']; valid: boolean }
export interface FieldFeedback {
  id: string
  label: string
  required: boolean
  touched: boolean
  requirements: Requirement[]
  touch: () => void
}
export interface ValidationIssue extends Requirement { field: string; label: string }

let sequence = 0
const rowIds = new WeakMap<object, string>()
export function validationRowId(row: object): string {
  if (!rowIds.has(row)) rowIds.set(row, `row-${++sequence}`)
  return rowIds.get(row)!
}

// Copy only the edited branch and keep field identities stable across immutable updates.
export function updateModelPath<T>(model: T, path: string, value: unknown): T {
  const keys = path.split('.')
  if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) return model
  const copy = (current: unknown, index: number): unknown => {
    if (index === keys.length) return value
    const source = current && typeof current === 'object' ? current as Record<string, unknown> : {}
    const next = Object.assign(Array.isArray(current) ? [] : {}, source) as Record<string, unknown>
    rowIds.set(next, validationRowId(source))
    next[keys[index]] = copy(source[keys[index]], index + 1)
    return next
  }
  return copy(model, 0) as T
}

export function createFormValidation(definitions: () => ValidationFieldDefinition[]) {
  const prefix = `validation-${++sequence}-`
  const touched = reactive(new Set<string>())
  const attempted = ref(false)
  const fields = computed(() => definitions().filter(field => field.active !== false))
  const evaluate = (field: ValidationFieldDefinition): Requirement[] => field.rules.map(rule => ({ key: rule.key, params: rule.params,
    valid: !(field.rules.some(check => check.required) && empty(field.value)) && rule.test(field.value) }))
  const issues = computed<ValidationIssue[]>(() => fields.value.flatMap(field => {
    const failure = evaluate(field).find(requirement => !requirement.valid)
    return failure ? [{ ...failure, field: field.id, label: field.label }] : []
  }))
  return markRaw({
    get valid() { return issues.value.length === 0 },
    get issues() { return issues.value },
    field(id: string): FieldFeedback {
      const definition = fields.value.find(field => field.id === id)
      return { id: prefix + id, label: definition?.label ?? '', required: definition?.rules.some(rule => rule.required) ?? false,
        touched: attempted.value || touched.has(id), requirements: definition ? evaluate(definition) : [], touch: () => touched.add(id) }
    },
    validate(): boolean { attempted.value = true; return issues.value.length === 0 },
    reset() { touched.clear(); attempted.value = false },
    async focus(id: string) {
      fields.value.find(field => field.id === id)?.reveal?.()
      touched.add(id)
      await nextTick()
      // Expansion panels animate their lazy content; focus after the DOM has mounted.
      const focus = () => {
        const element = document.getElementById(prefix + id)
        element?.focus()
        element?.scrollIntoView({ block: 'center', behavior: 'auto' })
        return !!element
      }
      if (!focus()) requestAnimationFrame(focus)
    },
  })
}
export type FormValidation = ReturnType<typeof createFormValidation>
