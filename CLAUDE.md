# BoxBoxBox

> Modern overlays for iRacing. Single-monitor. No subscription.

This is the perennial context for Claude Code working on this repo.

## Antes de qualquer mudança

1. Leia `docs/PRD.md` por inteiro na primeira vez que entrar no projeto.
2. Em sessões subsequentes, leia ao menos a fase atual e a seção de anti-padrões.
3. Se for adicionar dependência fora do `package.json` original — **pergunte primeiro**.

## Regras imutáveis (sem motivo explícito pra mudar)

- **Stack:** Electron + `node-irsdk-2023` + HTML/CSS/JS vanilla. Sem React, sem Tailwind, sem build pipeline.
- **Design tokens:** definidos em `src/renderer/styles/tokens.css`. Cor, tipografia, spacing — vêm dessa fonte. Não criar variações ad-hoc.
- **Estrutura de arquivos:** definida na seção 4 do PRD. Cada overlay = `[id].html` + `[id].css` + `[id].js` em `src/renderer/overlays/`. Zero código compartilhado entre overlays além de `tokens.css`.
- **Segurança:** renderer não usa `require`/`fs`/`net`. Toda comunicação main↔renderer passa pelo `preload.js` via `contextBridge`.

## Forma de trabalhar

- **Uma fase por vez.** Critérios de aceitação da fase atual (PRD §8) devem todos passar antes de avançar.
- **Stop and ask.** Ao terminar uma fase, pare e chame pra revisão. Não comece a próxima fase sem aval explícito.
- **Commits granulares.** Um commit por arquivo significativo ou por sub-tarefa coerente. Mensagens em inglês, presente do indicativo ("add fuel calculator module", "fix relative gap wrap").
- **Sem migração preventiva.** Se algo funciona, não refatora "pra ficar melhor". Refatora só quando dois usos genuínos justificarem extração.

## Anti-padrões (PRD §9, repetidos aqui pra não esquecer)

- ❌ React/Vue/Svelte/Tailwind
- ❌ Gradientes, drop-shadows complexas, animações pulsantes (único glow permitido: stripe do player)
- ❌ Campos não usados no `_slim()` da telemetria
- ❌ Lógica compartilhada entre overlays (questionar duplicação antes de extrair)
- ❌ `setInterval` no renderer pra animar (usar `requestAnimationFrame`)
- ❌ Overlay configurável em runtime na v1 (customização = editar código)

## Mock mode

Se `require('node-irsdk-2023')` falhar (Mac/Linux/dev sem iRacing), `TelemetryBridge` cai automaticamente em modo mock: 10 carros sintéticos em Okayama, 30Hz. Isso é feature, não bug — permite iterar visual fora do Windows.

## QA mindset

O dono do projeto é QA. Critérios de aceitação importam. Antes de marcar uma fase como "pronta":

1. Roda o checklist da fase no PRD §8 sozinho
2. Lista o que passou e o que não passou explicitamente
3. Se algo não passou, conserta antes de chamar revisão

## Comandos úteis

```bash
npm install         # instala deps (node-irsdk-2023 precisa de compile na Windows)
npm start           # roda em dev
npm run dev         # roda com logs verbose
npm run build:win   # empacota .exe (só na v1.0)
```