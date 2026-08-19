---
name: collect-memory
description: Revisa la conversación en curso y actualiza CLAUDE.md con los avances de la sesión (milestones hechos, qué quedó a medias, decisiones tomadas) y las preferencias del equipo que se expresaron en la charla (convenciones, reglas, gustos). Es el extra "memoria del agente" de mission.md — se invoca a mano al cerrar cada sesión de trabajo.
tools: Read, Edit, Bash
---

# Recolectar memoria de la sesión

Implementa el extra "la memoria del agente" de `mission.md`: al cerrar una sesión de trabajo, esta skill relee la conversación y deja `CLAUDE.md` al día, para que la sesión siguiente arranque con el contrato correcto sin que nadie tenga que repetirlo a mano.

Esta skill edita **solo `CLAUDE.md`** (no hace commit ni push por su cuenta — eso queda a criterio de quien la invoca, igual que cualquier otro cambio de la sesión).

## Pasos

1. **Leer `CLAUDE.md` tal como está ahora** — es la base sobre la que se edita, no se reescribe desde cero.
2. **Repasar la conversación en curso** buscando dos cosas distintas:
   - **Avances**: milestones o tareas que se completaron, que quedaron a medio hacer, o decisiones técnicas que se tomaron (y por qué — no alcanza con "qué", el "por qué" es lo que evita repetir una discusión ya cerrada).
   - **Preferencias del equipo**: convenciones, reglas o gustos que la persona haya expresado explícitamente en la charla (estilo de commits, idioma, cómo prefiere que se le pregunte antes de una acción, etc.) — no inventar preferencias que no se dijeron.
3. **Chequear contra el estado real del repo** antes de escribir nada: si la sesión tocó código, correr `git status`/`git log -3` (y `npm test` si se tocaron `server.js`, `storage.js` o `utils.js`) para confirmar que lo que se va a anotar coincide con lo que realmente quedó en el repo, no con lo que se planeó al principio de la sesión.
4. **Editar `CLAUDE.md`** con esos dos tipos de información, respetando su estructura existente:
   - Progreso de milestones o fixes → sección "Estado" o "Pendiente" (mover de "Pendiente" a "Estado" lo que se cerró en esta sesión; agregar a "Pendiente" lo que quedó a medias).
   - Decisiones de arquitectura o contexto no obvio leyendo el código → sección "Decisiones y contexto que no salen de leer el código".
   - Preferencias del equipo → la misma sección de decisiones, o una entrada nueva si no encajan en ninguna existente.
   - No duplicar información que ya está — si algo ya estaba anotado y sigue vigente, dejarlo como está; si quedó obsoleto (ej. un bug que ya se corrigió), actualizarlo en vez de dejar las dos versiones.
5. **Mostrar en la conversación un resumen breve** de qué se agregó/cambió en `CLAUDE.md` (no hace falta pegar el diff completo, alcanza con las líneas nuevas o modificadas más relevantes).

## Notas

- Si la sesión no dejó ningún avance ni preferencia nueva digna de anotar, decirlo y no tocar `CLAUDE.md` — no generar ediciones cosméticas solo para justificar la invocación.
- El historial de git de `CLAUDE.md` es la prueba de que esta skill se usó de verdad (criterio de éxito de `mission.md`): por eso cada edición tiene que ser un cambio real y legible, no un reemplazo completo del archivo.
- Si en la conversación se tomó una decisión que contradice algo ya anotado en `CLAUDE.md`, la versión nueva gana — pero vale la pena dejar una nota de qué cambió y por qué, no solo pisar el texto viejo en silencio.
