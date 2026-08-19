# Fixes pendientes

Hallazgos de un review del estado del código contra `mission.md`/`SPEC.md` (2026-08-19). Ninguno bloqueaba la entrega — los 5 milestones están cumplidos y los tests pasan. Los 4 items quedaron resueltos el 2026-08-19.

## Bugs de código

### 1. (Resuelto) Self-XSS en el historial local (`public/index.html:112`)

`esUrlValida` (en `server.js`) valida la URL parseándola con `new URL()`, pero el servidor persiste el **string original** que mandó el cliente, no la versión normalizada de `new URL().toString()`. Un valor como:

```
https://x.com/"><img src=x onerror=alert(1)>
```

pasa la validación (protocolo `https:` válido) y se guarda tal cual. `public/index.html:112` lo inyecta en el DOM del historial vía `innerHTML` sin escapar:

```js
li.innerHTML = `
  ...
  <span class="historial-url" title="${item.url}">${item.url}</span>
  ...
`;
```

Impacto acotado: el historial vive en el `localStorage` del propio navegador de quien creó el link, así que es self-XSS (afecta solo a quien pegó la URL maliciosa), no a terceros — `stats.html` expone el mismo `url` pero vía `.textContent` (línea 81), que sí es seguro.

**Fix aplicado:** el `<li>` del historial ahora se arma con `createElement`/`textContent` (`historial-codigo`, `historial-url`, `historial-fecha`, `historial-stats` como nodos separados) en vez de interpolar `item.url` en un template string, igual que ya hacía `stats.html`.

### 2. (Resuelto) El frontend no muestra el error real de `POST /api/links` (`public/index.html:145`)

Cuando el backend responde `400` con `{ error: "Falta la url" }` o `{ error: "URL inválida" }`, el frontend descartaba ese body y mostraba un toast genérico ("No se pudo acortar ese link"), sin decirle al usuario qué está mal.

**Fix aplicado:** ahora se lee `(await res.json().catch(() => ({}))).error` y se pasa a `mostrarToast(...)`, con el string genérico como fallback si la respuesta no trae `error` (o no es JSON válido).

## Documentación / extras de `mission.md`

### 3. (Resuelto) Falta la skill `/collect-memory`

`mission.md` (sección "Extra: la memoria del agente") pedía una skill que, invocada al cerrar cada sesión, actualice `CLAUDE.md`/memoria con avances y preferencias del equipo. No existía en `.claude/skills/` — solo estaba `reporte-cambios` (el otro extra, de trabajo en equipo).

**Fix aplicado:** se agregó `.claude/skills/collect-memory/SKILL.md`, siguiendo la misma convención de `reporte-cambios` (frontmatter con `tools` explícitos, pasos numerados, notas al final). Revisa la conversación en curso y actualiza `CLAUDE.md` con avances y preferencias del equipo expresadas en la charla, sin reescribir el archivo desde cero.

### 4. (Resuelto en este mismo review) `CLAUDE.md` describía el estado original del proyecto

`CLAUDE.md` seguía documentando los bugs de Milestone 3 (sin redirect real, sin chequeo de colisión de códigos) y la ausencia de `.gitignore` como si fueran el estado actual, cuando ya estaban corregidos desde hace varios commits. Se actualizó junto con este archivo — dejar la nota acá como recordatorio de que sin `/collect-memory` (punto 3) este tipo de desfase puede repetirse.
