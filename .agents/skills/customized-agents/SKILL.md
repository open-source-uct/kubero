---
name: customized-agents
description: >-
  Guía completa, referencia y procedimiento para crear, configurar e invocar Agentes Personalizados (Custom Agents) en Google Antigravity.
  Utiliza esta skill cuando necesites crear o modificar definiciones de agentes en .agents/agents/, configurar sus campos (name, description,
  model, mainAgent, subagent, tools, skills, permissionMode, commandExecutionPolicy), o diseñar prompts especializados y flujos de delegación.
---

# Skill: Customized Agents (Agentes Personalizados en Antigravity)

Esta skill documenta la especificación técnica oficial, mejores prácticas y procedimientos paso a paso para crear y utilizar **Agentes Personalizados (Custom Agents)** en Google Antigravity, según la arquitectura introducida en Antigravity 2.0.

---

## 1. ¿Qué es un Custom Agent?

Un **Custom Agent** es un asistente especializado configurado mediante un único archivo Markdown (`.md`) que combina:
1. **Metadatos y políticas en YAML frontmatter:** Controlan el modelo de lenguaje, permisos, herramientas asignadas, skills importadas y modos de ejecución.
2. **System Prompt en el cuerpo Markdown:** Instrucciones operativas específicas que dictan la personalidad, objetivos y procedimientos del agente.

Los Custom Agents permiten encapsular roles repetitivos (ej. revisor de PRs, diseñador frontend, refactorizador de código, depurador de pruebas) con los privilegios mínimos necesarios para evitar saturación de tokens y minimizar riesgos.

---

## 2. Ubicación de Almacenamiento (Storage Locations)

Los agentes personalizados se definen como archivos `.md` en dos niveles:

| Nivel | Ruta de Directorio | Alcance | Uso recomendado |
| :--- | :--- | :--- | :--- |
| **Workspace (Proyecto)** | `.agents/agents/<agent-name>.md` | Específico del repositorio | **Recomendado:** Versionado en Git, compartido automáticamente con todo el equipo del proyecto. |
| **Global (Usuario)** | `~/.gemini/config/agents/<agent-name>.md` | Toda la máquina | Herramientas personales del desarrollador disponibles en cualquier proyecto local. |

> [!IMPORTANT]
> Para este proyecto, todos los agentes deben crearse en la carpeta local:
> `c:\Users\J0tae\OneDrive\Desktop\kubero\.agents\agents\`

---

## 3. Formato del Archivo y Campos de Configuración

Cada agente es un archivo `.md` estructurado en dos partes:

```markdown
---
name: <nombre-del-agente>
description: <descripcion-breve-y-clara>
model: <flash | pro>
mainAgent: <true | false>
subagent: <true | false>
permissionMode: <acceptEdits | bypassPermissions>
commandExecutionPolicy: <auto>
tools:
  - <herramienta_1>
  - <herramienta_2>
skills:
  - <ruta/a/skill_1>
---

# Core Instructions
[Instrucciones del sistema en Markdown para el agente]
```

### Detalle de Campos del Frontmatter

* **`name`** *(string, obligatorio)*: Identificador único en minúsculas y separado por guiones (ej. `dependency-modernizer`, `frontend-designer`).
* **`description`** *(string, obligatorio)*: Explicación concisa de las capacidades y especialidad del agente. Los agentes coordinadores la utilizan para enrutar tareas y delegar subagentes de forma inteligente.
* **`model`** *(string, opcional)*: Modelo de lenguaje asignado (ej. `flash` para rapidez y bajo costo en tareas iterativas; `pro` para razonamiento arquitectónico profundo).
* **`mainAgent`** *(boolean, opcional, por defecto `false`)*: Si es `true`, el agente aparece en el menú desplegable de la UI y puede iniciarse como sesión de conversación interactiva principal.
* **`subagent`** *(boolean, opcional, por defecto `false`)*: Si es `true`, permite que el agente coordinador lo invoque dinámicamente como subagente para resolver subtareas.
* **`permissionMode`** *(string, opcional)*:
  * `acceptEdits`: Acepta automáticamente cambios de edición de archivos seguros.
  * `bypassPermissions`: Omite confirmaciones interactivas estándar (usar con precaución).
* **`commandExecutionPolicy`** *(string, opcional)*:
  * `auto`: Permite la ejecución autónoma en segundo plano de comandos no destructivos (ej. `npm test`, `yarn build`, linters) sin solicitar confirmación constante al usuario, reservando las alertas solo para operaciones destructivas.
* **`tools`** *(lista de strings, opcional)*: Conjunto exacto de herramientas que el agente tiene permitido invocar. Limitar las herramientas reduce el consumo de contexto y evita confusiones del modelo:
  * Herramientas comunes: `view_file`, `replace_file_content`, `multi_replace_file_content`, `write_to_file`, `run_command`, `manage_task`, `list_dir`, `grep_search`, `browser_subagent`.
* **`skills`** *(lista de strings, opcional)*: Lista de skills locales que el agente debe precargar o tener acceso directo (ej. `skills/uct-kubero-design`).
* **Cuerpo Markdown (`# Core Instructions`)**: Se compila directamente como el system prompt del agente.

---

## 4. Métodos de Invocación (How to Invoke)

Los Custom Agents se pueden invocar de tres formas según su configuración:

### A. Selector de la Interfaz Gráfica (Desktop App / IDE)
Si `mainAgent: true`, el agente aparecerá en el menú desplegable de agentes en la barra de prompts de Antigravity. El usuario puede seleccionarlo directamente para interactuar con él.

### B. Línea de Comandos (CLI)
Si `mainAgent: true`, se puede iniciar una sesión con el agente usando el flag `--agent`:
```bash
agy --agent <agent-name>
# Ejemplo:
agy --agent dependency-modernizer
```

### C. Delegación Autónoma (Subagentes)
Si `subagent: true`, el agente coordinador principal puede invocar al agente como subagente automáticamente cuando la tarea del usuario coincida con la `description` y herramientas del agente personalizado.

---

## 5. Simetría de Ejecución (Execution Symmetry)

Una de las características más potentes de Antigravity es la **simetría de ejecución**: un mismo agente puede actuar como sesión interactiva primaria y como trabajador secundario delegado si se activan ambas banderas:

```yaml
mainAgent: true
subagent: true
```

* Como **Main Agent**, el usuario conversa directamente con él para resolver un problema de principio a fin.
* Como **Subagent**, otro agente puede delegarle una subtarea específica (ej. "Ejecuta los tests y soluciona errores de tipado").

---

## 6. Ejemplos de Definición

### Ejemplo 1: Dependency Modernizer (Oficial de Antigravity)

Ubicación: `.agents/agents/dependency-modernizer.md`

```markdown
---
name: dependency-modernizer
description: Helps upgrade local packages and verify that project tests pass.
model: flash
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
tools:
  - view_file
  - replace_file_content
  - manage_task
  - run_command
skills:
  - skills/package-upgrade-rules
---

# Core Instructions
You are a dependency modernizer. Your job is to check configuration files,
update target dependencies, run test suites, and verify the build passes.
```

---

### Ejemplo 2: Agente Diseñador Frontend UCT para Kubero

Ubicación: `.agents/agents/uct-frontend-designer.md`

```markdown
---
name: uct-frontend-designer
description: Especialista en diseño e implementación de componentes Vue 3 / Vuetify 3 siguiendo la identidad institucional de la Universidad Católica de Temuco (UCT).
model: flash
mainAgent: true
subagent: true
permissionMode: acceptEdits
tools:
  - view_file
  - replace_file_content
  - multi_replace_file_content
  - write_to_file
  - list_dir
  - grep_search
skills:
  - skills/uct-kubero-design
---

# Core Instructions
Eres el Diseñador Frontend Especialista de Kubero UCT.
Tu objetivo es diseñar, adaptar y estilizar vistas y componentes en `client/src/` aplicando rigurosamente la skill `uct-kubero-design`.

Reglas clave:
1. Aplica la paleta institucional (#0075B4 azul corporativo, #EDC500 amarillo acento, #878787 gris neutro).
2. Asegura compatibilidad con temas claro y oscuro de Vuetify.
3. Respeta la jerarquía tipográfica institucional.
```

---

## 7. Procedimiento para Crear un Nuevo Agente en este Proyecto

Para crear un nuevo agente personalizado en este repositorio, sigue estos pasos:

1. **Crear el archivo:** Crea `.agents/agents/<nombre-del-agente>.md`.
2. **Definir YAML frontmatter:**
   * Especifica `name` con identificador único en minúsculas.
   * Redacta una `description` precisa para que el coordinador sepa cuándo delegarle trabajo.
   * Asigna `mainAgent: true` si el usuario debe poder seleccionarlo en la interfaz.
   * Asigna `subagent: true` si debe poder ser llamado como subagente.
   * Limita `tools` a solo las herramientas estrictamente necesarias.
   * Vincula las `skills` pertinentes (ej. `skills/uct-kubero-design`).
3. **Escribir las Core Instructions:**
   * Define el rol, pasos a seguir, restricciones de seguridad y formato de salida.
4. **Verificación:**
   * Comprueba que el archivo esté guardado en `.agents/agents/`.
   * Verifica que no contenga errores de sintaxis YAML en el bloque inicial.
