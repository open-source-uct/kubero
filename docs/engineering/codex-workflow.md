# Flujo de trabajo con Codex — Kubero UCT

Esta guía complementa el `AGENTS.md` de la raíz. Aplica a este fork y a su checkout actual: `client/` (Vue/Vuetify), `server/` (NestJS/Prisma) y `services/` (plantillas YAML). El CLI en Go, el operador y los CRDs viven fuera de este repositorio; anota cualquier coordinación necesaria en el issue y el PR.

## Ramas y revisiones

| Trabajo | Base | Rama | Destino del PR |
| --- | --- | --- | --- |
| Funcionalidad | `origin/develop` | `feat/<issue-id>-<slug>` | `develop` |
| Corrección | `origin/develop` | `fix/<issue-id>-<slug>` | `develop` |
| Mantenimiento | `origin/develop` | `chore/<issue-id>-<slug>` | `develop` |
| Incidente urgente | `origin/main` | `hotfix/<issue-id>-<slug>` | `main` |
| Promoción | `develop` | Sin rama adicional | `main` |

Usa identificadores reales de issues; no inventes tickets. Escribe el `slug` en minúsculas, con palabras separadas por guiones y sin acentos. Si una tarea no tiene issue, créalo antes de abrir una rama que deba seguir esta convención. Después de fusionar un hotfix en `main`, abre un PR de `main` hacia `develop` para incorporar la corrección; resuelve conflictos y vuelve a ejecutar las comprobaciones afectadas.

Como paso inicial de adopción, compara `origin/main...origin/develop` y, si `develop` está rezagada, incorpora primero los cambios de `main` mediante PR. En la revisión de este plan, `main` tenía commits que aún no estaban en `develop`.

Para tareas simultáneas, usa un worktree limpio por tarea y selecciona la rama base antes de iniciar Codex. Un worktree administrado puede comenzar en HEAD separado; crea la rama con el nombre acordado antes de confirmar cambios. No cambies de rama ni limpies un checkout con trabajo sin guardar. Codex documenta este [flujo de worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees).

## Commits y PRs

Formato de commit: `type(scope): descripción breve en imperativo`. Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf` y `style`. Usa el scope del componente principal: `client`, `server`, `services`, `github` o `docker`. Para cambios transversales, elige el componente que define el comportamiento y explica los demás en el cuerpo del commit.

Incluye `Refs #ID` en el pie del commit, o `Closes #ID` solo si ese commit cierra el issue. Si hay incompatibilidad, agrega `!` al encabezado y un pie `BREAKING CHANGE: ...` con el efecto y la ruta de actualización. Evita emojis y mensajes genéricos. Ejemplo:

```text
fix(server): limita los logs al equipo autorizado

Refs #104
```

Haz un commit por unidad lógica que pueda revisarse. No mezcles reformateos masivos con cambios de comportamiento. El título del PR sigue `type(scope): descripción breve (#ID)`; el cuerpo usa `.github/pull_request_template.md`. Para la promoción de `develop` a `main`, el título puede ser `chore(release): promueve develop a main` y el cuerpo enumera los cambios incluidos.

## Secuencia diaria

1. **Planificar:** leer el issue y el código relevante; identificar componente, contratos, seguridad, pruebas y archivos que pueden cambiar. Para API o Kubernetes, comprobar el impacto en cliente, CLI, operador y CRDs aunque estos últimos no estén en el checkout.
2. **Implementar:** trabajar en una rama y un worktree limpios; hacer el cambio mínimo que resuelva el issue y conservar modificaciones ajenas.
3. **Verificar:** ejecutar las pruebas del componente y anotar comandos y resultados. Los comandos `lint` de los paquetes corrigen archivos con `--fix`; usar las invocaciones sin `--fix` indicadas en `AGENTS.md`. Ejecutar Playwright solo contra un entorno local descartable. No usar `server:test:e2e` mientras falte su configuración.
4. **Revisar:** inspeccionar `git diff --check`, `git status` y el diff completo; buscar secretos, archivos generados, cambios de contrato y comportamiento no relacionado.
5. **Entregar:** preparar commits lógicos, solicitar revisión de Codex del diff y redactar el PR con pruebas, riesgos, capturas de UI si aplica y plan de reversión.

## Prompts reutilizables

**Rama ordinaria**

> Comprueba que no haya cambios sin guardar. Parte de `origin/develop` en un worktree limpio y crea `feat/<issue-id>-<slug>` (o `fix/` o `chore/`). Muéstrame la base y la rama resultantes antes de editar.

**Hotfix desde `main`**

> Comprueba el estado de Git. Parte de `origin/main` en un worktree limpio y crea `hotfix/<issue-id>-<slug>`. Limita el cambio al incidente, prepara el PR a `main` y señala cómo incorporar después el commit a `develop`.

**Preparar commits**

> Revisa `git diff` y `git status`; separa los cambios en commits lógicos sin incluir archivos ajenos. Usa `type(scope): descripción` y referencia `#<issue-id>` en el pie. Antes de confirmar, enumera los archivos y el mensaje de cada commit.

**Redactar el PR**

> Compara la rama con su destino, revisa el diff y los resultados reales de pruebas. Redacta el cuerpo completo conforme a `.github/pull_request_template.md`; marca lo no verificado como pendiente y explica riesgos, compatibilidad y reversión sin inventar pruebas.

## Protección y seguridad

Configura `develop` y `main` en GitHub para impedir pushes directos y exigir al menos una revisión. Marca como requerida únicamente una comprobación que corra en **todos** los PR hacia la rama correspondiente; un workflow con filtros de rutas no sirve como requisito general. Actualmente `Jest PR Test` se dispara en cada PR, mientras CodeQL está limitado a `main` y Yamllint a cambios en `services/`.

Las instrucciones de `AGENTS.md` no sustituyen permisos del sistema. Mantén secretos fuera de Git, limita accesos del agente al workspace, revisa los cambios antes de confirmar y usa permisos mínimos en GitHub y Kubernetes. No pegues kubeconfigs, tokens ni resultados de `kubero debug` sin depurar en issues o PRs. Para vulnerabilidades sensibles, coordina un canal privado con los mantenedores antes de publicar detalles.
