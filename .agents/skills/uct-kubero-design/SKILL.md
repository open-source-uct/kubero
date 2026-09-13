---
name: uct-kubero-design
description: Sistema de diseño institucional UCT adaptado para el frontend de Kubero PaaS (Vue 3 / Vuetify 3). Utiliza esta skill cuando necesites diseñar, crear, estilizar o refactorizar vistas, componentes, temas claro/oscuro o elementos visuales en el cliente de Kubero para alinearlos con la identidad visual de la Universidad Católica de Temuco.
version: alpha
platform: Kubero UCT PaaS
framework: Vue 3 + Vuetify 3

colors:
  primary: "#0075B4"
  corp-blue: "#0075B4"
  corp-blue-dark: "#005888"
  corp-blue-light: "#0090DC"
  corp-white: "#FFFFFF"
  corp-gray: "#878787"
  corp-gray-light: "#F4F6F9"
  corp-gray-border: "rgba(135, 135, 135, 0.2)"
  corp-yellow: "#EDC500"
  corp-yellow-dark: "#7A6400"
  corp-dark-bg: "#0E1620"
  corp-dark-card: "#16202D"
  corp-dark-nav: "#0B1119"
  status-success: "#10B981"
  status-warning: "#EDC500"
  status-error: "#EF4444"
  status-info: "#0075B4"

typography:
  fontFamily: "Vista Sans, Roboto, system-ui, sans-serif"
  fontFamilyMono: "Fira Code, SFMono-Regular, Menlo, Consolas, monospace"
  h1:
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  section-title:
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: 0.05em
    textTransform: uppercase
    color: "{colors.corp-blue}"
  label:
    fontSize: 0.75rem
    fontWeight: 500
    letterSpacing: 0.025em
    textTransform: uppercase
    color: "{colors.corp-gray}"
  value:
    fontSize: 0.9375rem
    fontWeight: 500
    color: "#1A1A1A"
  code:
    fontSize: 0.8125rem
    fontFamily: "{typography.fontFamilyMono}"
    fontWeight: 500
  body:
    fontSize: 0.875rem
    fontWeight: 400
  meta:
    fontSize: 0.75rem
    fontWeight: 400
    color: "{colors.corp-gray}"
  badge-label:
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: 0.025em

rounded:
  xs: 4px
  md: 8px
  lg: 12px
  full: 9999px

spacing:
  container: max-w-7xl
  page-x: 1.5rem
  page-y: 1.5rem
  section-padding: 1.5rem
  section-gap: 1.5rem
  grid-col-gap: 1.5rem
  grid-row-gap: 1rem
  label-value-gap: 0.25rem
  pipeline-col-width: 380px
  avatar-size: 2rem

components:
  sidebar:
    backgroundColorLight: "{colors.corp-gray-light}"
    backgroundColorDark: "{colors.corp-dark-nav}"
    activeItemColor: "{colors.corp-blue}"
    textColor: "{colors.corp-white}"
  appbar:
    backgroundColor: "{colors.corp-blue}"
    textColor: "{colors.corp-white}"
    height: 50px
  card:
    backgroundColorLight: "{colors.corp-white}"
    backgroundColorDark: "{colors.corp-dark-card}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.corp-gray-border}"
    padding: "{spacing.section-padding}"
  section-title:
    textColor: "{colors.corp-blue}"
    letterSpacing: 0.05em
    textTransform: uppercase
  badge:
    rounded: "{rounded.xs}"
  badge-git:
    backgroundColor: "{colors.corp-blue}15"
    textColor: "{colors.corp-blue}"
  badge-running:
    backgroundColor: "#10B98115"
    textColor: "#059669"
  badge-building:
    backgroundColor: "{colors.corp-yellow}20"
    textColor: "{colors.corp-yellow-dark}"
  badge-failed:
    backgroundColor: "#EF444415"
    textColor: "#DC2626"
  terminal:
    backgroundColor: "{colors.corp-dark-nav}"
    textColor: "#E2E8F0"
    fontFamily: "{typography.fontFamilyMono}"
    rounded: "{rounded.md}"
  button:
    rounded: "{rounded.md}"
    primaryColor: "{colors.corp-blue}"
    accentColor: "{colors.corp-yellow}"

notes:
  color-inline-values:
    text-primary-light: "#1A1A1A"
    text-primary-dark: "#E2E8F0"
    badge-building-text: "#7A6400"
    terminal-bg: "#0B1119"
  unpublished:
    - "iconColor: corp-blue (reemplaza el morado kubero `#684888` en iconos de git, docker, kubernetes y pods)"
    - "vuetify-theme-sync: tokens sincronizados con client/src/plugins/vuetify.ts"
    - "brand-identity: Fac. de Ingeniería / Universidad Católica de Temuco integrada en login, appbar y sidebar"
---

# Skill: UCT Kubero Design System

Esta skill define la especificación visual y el manual de implementación de diseño para el fork de **Kubero PaaS de la Universidad Católica de Temuco (UCT)**. 

El diseño adapta la paleta institucional de la UCT a la arquitectura de interfaz de Kubero basada en **Vue 3** y **Vuetify 3**.

---

## 1. Overview

Plataforma de despliegues y gestión de contenedores PaaS de la Universidad Católica de Temuco basada en Kubero.

- **Filosofía de diseño:** Sobrio, institucional, centrado en la legibilidad de métricas, estados de pods, pipelines y registros de despliegue.
- **Soporte de temas:** A diferencia del portal académico estático, Kubero es una herramienta de operaciones y desarrollo (DevOps), por lo que cuenta con soporte tanto para **Modo Claro (Light)** como para **Modo Oscuro (Dark)**, ambos con acentos institucionales UCT.

---

## 2. Colors & Vuetify Theme Mapping

La paleta institucional se compone de los colores corporativos UCT, adaptados para su uso en Vuetify 3 (`client/src/plugins/vuetify.ts`):

- **primary / corp-blue (`#0075B4`):** Azul institucional UCT. Color principal para botones primarios, enlaces, títulos de etapas (`section-title`), tabs activos y el color identificador de Kubero UCT (reemplazando el morado `#684888` original).
- **primary-darken1 (`#005888`):** Variante más profunda para estados hover y degradados sutiles.
- **primary-light (`#0090DC`):** Azul UCT de alto contraste optimizado para el tema oscuro.
- **corp-yellow (`#EDC500`):** Amarillo institucional UCT de acento. Utilizado en badges de compilación/pending, avisos destacados y botones de acción secundaria.
- **corp-gray (`#878787`):** Gris secundario para metadatos, labels técnicos (commit hashes, URLs de git), bordes de cards y divisores.
- **corp-white (`#FFFFFF`):** Fondo de cards y superficies en modo claro.

### Mapeo con el tema de Vuetify (`client/src/plugins/vuetify.ts`):

```typescript
themes: {
  light: {
    colors: {
      "on-background": "#1A1A1A",
      primary: "#0075B4",
      "primary-darken1": "#005888",
      secondary: "#EAEFF5",
      cardBackground: "#FFFFFF",
      "on-cardBackground": "#1A1A1A",
      navBG: "#F7F9FC",
      kubero: "#0075B4",
      accent: "#EDC500",
      error: "#EF4444",
      info: "#0075B4",
      success: "#10B981",
      warning: "#EDC500",
      focusbg: "#E2E8F0"
    }
  },
  dark: {
    colors: {
      "on-background": "#E2E8F0",
      primary: "#0090DC",
      "primary-darken1": "#0075B4",
      secondary: "#1B2430",
      cardBackground: "#16202D",
      "on-cardBackground": "#E2E8F0",
      navBG: "#0B1119",
      kubero: "#0090DC",
      accent: "#EDC500",
      error: "#EF4444",
      info: "#0090DC",
      success: "#10B981",
      warning: "#EDC500",
      focusbg: "#2A374A"
    }
  }
}
```

---

## 3. Typography

- **Fuente principal:** `Vista Sans, Roboto, system-ui, sans-serif`. Si `Vista Sans` no está instalada en el sistema, `Roboto` (cargada por `unplugin-fonts`) asegura consistencia visual.
- **Fuente monoespaciada:** `Fira Code, SFMono-Regular, Menlo, Consolas, monospace` para logs de pods, terminal xterm y hashes de git.
- **Jerarquía tipográfica:**
  - **h1:** Títulos de vistas principales (Pipelines, Apps, Podsizes). `1.25rem` (20px), `font-weight: 600`.
  - **section-title:** Encabezados de fases de pipeline (Review, Staging, Production). `0.75rem` (12px), `font-weight: 600`, `letter-spacing: 0.05em`, `text-transform: uppercase`, color `corp-blue`.
  - **label:** Etiquetas de campos, metadata de instancias y branches. `0.75rem` (12px), `font-weight: 500`, uppercase, color `corp-gray`.
  - **value:** Valores de configuración, endpoints, nombres de repositorios. `0.875rem` - `0.9375rem` (14-15px), `font-weight: 500`.
  - **code:** Hashes de commit, comandos CLI, nombres de variables de entorno. `0.8125rem` (13px), tipografía mono.

---

## 4. Layout & Estructura de Kubero

1. **Navigation Drawer (`NavDrawer.vue`):**
   - Lateral izquierdo persistente con modo colapsable (`rail`).
   - Perfil de usuario con avatar circular en la parte superior.
   - Enlaces de navegación con iconos MDI y color activo `corp-blue` (`#0075B4`).
2. **App Bar (`AppBar.vue`):**
   - Barra superior para mensajes globales del clúster o notificaciones de mantenimiento institucional.
3. **Pipeline Board (`views/Pipeline.vue`):**
   - Distribución horizontal por fases (`Review`, `Staging`, `Production`).
   - Cada fase se presenta como una columna estructurada de ancho fijo (`~380px`) encabezada por `section-title`.
4. **App Cards (`components/pipelines/appcard.vue`):**
   - Tarjetas con bordes redondeados (`rounded-md` / `8px`), sombra suave o borde sutil (`corp-gray-border`), fondo `cardBackground`.

---

## 5. Components & Variantes

- **`v-card`:**
  - Bordes `rounded-md` (8px), fondo `cardBackground`, borde sutil `1px solid rgba(135,135,135,0.2)`.
- **`v-chip` (Badges de estado y Git):**
  - Esquinas `rounded-xs` (4px) o `label`.
  - **Git Branch / Commit:** Fondo `{colors.corp-blue}15`, texto `{colors.corp-blue}`.
  - **Status Running:** Fondo `#10B98115`, texto `#059669`.
  - **Status Building / Pending:** Fondo `{colors.corp-yellow}20`, texto `#7A6400`.
  - **Status Crashed / Failed:** Fondo `#EF444415`, texto `#DC2626`.
- **Terminal & Logs (`xterm`):**
  - Contenedor oscuro con fondo `#0B1119`, texto `#E2E8F0`, bordes redondeados `8px`.
- **Botones (`v-btn`):**
  - Primario: Fondo `primary` (`#0075B4`), texto blanco, `elevation-0` o `elevation-1`, `rounded-md`.
  - Secundario / Acento: Fondo `accent` (`#EDC500`), texto `#7A6400`.

---

## 6. Instrucciones para el Agente / Desarrollador

Al implementar o modificar componentes en `client/`:
1. Consulta siempre los tokens visuales y la especificación definidos en este archivo antes de crear nuevos estilos.
2. Utiliza las clases y variables semánticas de Vuetify (`color="primary"`, `color="cardBackground"`, `color="kubero"`) en lugar de colores hexadecimales duros en los estilos inline.
3. Asegura compatibilidad tanto en modo claro como en modo oscuro utilizando las variables CSS `rgb(var(--v-theme-primary))` y `rgb(var(--v-theme-cardBackground))`.
4. Mantén la jerarquía tipográfica entre `label` (`text-caption text-uppercase text-medium-emphasis`) y `value` (`text-body-2 font-weight-medium`).
