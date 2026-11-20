// Textos de la auditoría en el idioma de la interfaz. El servidor guarda la
// acción y el recurso como palabras internas ("update", "app") y un mensaje en
// inglés ("Updated app backend"). Se traduce lo conocido a partir de esos
// campos; lo demás se muestra tal cual, así no se pierde nada de lo guardado.

export interface AuditEntry {
  action?: string
  resource?: string
  message?: string
  pipeline?: string
  app?: string
}

// el servidor usa a veces el participio ("created", "deleted")
const ALIASES: Record<string, string> = { created: 'create', deleted: 'delete', updated: 'update' }

export function normalizeAction(action = ''): string {
  return ALIASES[action] ?? action
}

// qué nombre necesita cada recurso para describirlo (null: ninguno)
const SUBJECT: Record<string, 'app' | 'pipeline' | null> = { app: 'app', build: 'app', pipeline: 'pipeline', config: null }

export interface AuditDescription {
  key: string
  params: { app: string; pipeline: string }
}

// clave de traducción de la descripción, o null si el recurso no se conoce o
// falta el nombre al que se refiere (entonces se usa el mensaje del servidor)
export function auditDescription(entry: AuditEntry): AuditDescription | null {
  const resource = entry.resource ?? ''
  if (!(resource in SUBJECT)) return null
  const subject = SUBJECT[resource]
  if (subject && !entry[subject]) return null
  return {
    key: `activity.describe.${resource}.${normalizeAction(entry.action)}`,
    params: { app: entry.app ?? '', pipeline: entry.pipeline ?? '' },
  }
}
