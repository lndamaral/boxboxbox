# PRD — `BoxBoxBox`

> Sistema de overlays modernos pra iRacing. Substitui RaceLab/SimHub no quesito qualidade visual, sem mensalidade, totalmente customizável.

---

## 1. Contexto e visão

**Problema:** SimHub é a ferramenta dominante de overlays mas tem visual datado (WPF, anos 2015). RaceLab tem visual moderno mas é pago e fechado. Não existe alternativa open-source com qualidade visual à altura.

**Visão:** Um app desktop pra Windows que entrega overlays para iRacing com qualidade visual equivalente ao RaceLab, arquitetura limpa pra adicionar overlays novos em horas (não dias), e zero fricção de uso (instala, abre, posiciona, fecha).

**Usuário-alvo:** Simracers iRacing intermediários a avançados, leagues, streamers. Foco inicial single-monitor (sem VR).

**Princípio norteador:** "Beautiful by default, customizable when needed." Não exigir configuração pra ficar bonito.

### Naming conventions (não confundir)

| Onde | Valor |
|---|---|
| Display name (UI, README, instalador) | `BoxBoxBox` |
| Package name (`package.json` `name`) | `boxboxbox` |
| Product name (`electron-builder` `productName`) | `BoxBoxBox` |
| App ID (`electron-builder` `appId`) | `app.boxboxbox.overlays` |
| Pasta raiz do repo | `boxboxbox` |
| Janela title (control panel) | `BoxBoxBox — Control` |
| Tagline curta (README, futura landing) | "Modern overlays for iRacing" |

---

## 2. Não-objetivos (escopo negativo explícito)

Pra evitar scope creep durante a implementação:

- ❌ **Sem VR.** Sem renderização in-headset, sem integração OpenXR.
- ❌ **Sem outros sims na v1.** Só iRacing. ACC/LMU/GT7 ficam pra v2+.
- ❌ **Sem cloud sync de configurações.** Tudo local.
- ❌ **Sem marketplace de overlays.** Overlays são código, não dados.
- ❌ **Sem servidor backend.** Tudo roda local; zero dependência de rede em runtime.
- ❌ **Sem login / contas / telemetria de uso na v1.**
- ❌ **Sem suporte a multi-monitor coordenado** (overlays funcionam em qualquer monitor, mas sem layout cross-monitor).

---

## 3. Stack e decisões arquiteturais

**Decisões fechadas** (não revisitar sem motivo forte):

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime | Electron 33+ | Janelas transparentes nativas, click-through, alwaysOnTop maduros |
| Telemetria | `node-irsdk-2023` (npm) | Wrapper Node maintained do SDK oficial iRacing |
| Renderer | HTML/CSS/JS vanilla | Zero build pipeline; cada overlay é HTML standalone |
| IPC | Electron `contextBridge` + preload | Padrão seguro, sem `nodeIntegration` no renderer |
| Persistência | JSON local em `app.getPath('userData')` | Suficiente pra posições e configs; sem SQLite na v1 |
| Empacotamento | `electron-builder` (NSIS) | Windows-only, gera `.exe` instalador |

**Tick rate:** 30Hz de telemetria → renderer (iRacing SDK pode 60Hz, mas 30 é mais que suficiente pra overlays e poupa CPU pro sim).

**Janelas:** uma `BrowserWindow` por overlay. `transparent: true`, `frame: false`, `hasShadow: false`, `alwaysOnTop: 'screen-saver'`, `skipTaskbar: true`, `focusable: false`, `backgroundThrottling: false`. Click-through via `setIgnoreMouseEvents(true, { forward: true })`, desligado no modo edit.

**Modo mock:** se `require('node-irsdk-2023')` falhar (Mac/Linux/dev sem iRacing), telemetria cai automaticamente em modo mock com 10 carros sintéticos circulando uma pista. Crítico pra iteração de UI fora do Windows.

---

## 4. Estrutura de arquivos

```
boxboxbox/
├── package.json
├── README.md
├── CLAUDE.md                      # contexto perene pro Claude Code
├── src/
│   ├── main/                      # processo principal Electron (Node)
│   │   ├── main.js                # entrypoint, IPC, atalhos globais
│   │   ├── overlay-manager.js     # ciclo de vida das janelas de overlay
│   │   ├── telemetry.js           # bridge iRacing SDK → eventos
│   │   └── store.js               # persistência JSON
│   ├── preload/
│   │   └── preload.js             # ponte segura main↔renderer
│   └── renderer/
│       ├── control.html           # painel de controle (única janela "normal")
│       ├── styles/
│       │   └── tokens.css         # design tokens compartilhados
│       └── overlays/
│           ├── relative.html
│           ├── relative.css
│           ├── relative.js
│           ├── inputs.html        # (fase 2)
│           ├── inputs.css
│           ├── inputs.js
│           └── ...
└── docs/
    └── adding-an-overlay.md       # tutorial pra futuro contribuidor (você do futuro)
```

**Convenção:** cada overlay é uma tripla `[id].html` + `[id].css` + `[id].js` em `src/renderer/overlays/`. Zero código compartilhado entre overlays além de `tokens.css`. Isso mantém cada overlay independente, hackeável, e deletável sem efeito colateral.

---

## 5. Design system (tokens literais)

Estes valores vão direto pro `src/renderer/styles/tokens.css`. **Não inventar variações sem motivo.**

### Tipografia
```
display: 'Manrope' (400, 500, 600, 700, 800) — texto, nomes
mono:    'JetBrains Mono' (400, 500, 700) — todos os números
```
Carregar via Google Fonts. Numbers sempre com `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1`.

### Cores
```
--surface-bg:        rgba(8, 10, 16, 0.78)   /* glass com backdrop-blur(18px) */
--surface-elev:      rgba(255, 255, 255, 0.04)
--surface-elev-hi:   rgba(255, 255, 255, 0.08)
--surface-player:    rgba(0, 229, 255, 0.06)
--border:            rgba(255, 255, 255, 0.06)
--border-strong:     rgba(255, 255, 255, 0.14)

--text-primary:      rgba(255, 255, 255, 0.94)
--text-secondary:    rgba(255, 255, 255, 0.58)
--text-muted:        rgba(255, 255, 255, 0.34)

--accent:            #00e5ff                  /* cyan elétrico — só pra destacar o player */
--accent-soft:       rgba(0, 229, 255, 0.16)
--accent-glow:       0 0 16px rgba(0, 229, 255, 0.35)

--pos-good:          #4ade80                  /* delta favorável, conexão ativa */
--pos-bad:           #f87171                  /* delta desfavorável */
--pos-fastest:       #d946ef                  /* roxo neon — fastest lap da sessão (convenção motorsport) */
--pit-warn:          #fbbf24                  /* pit road */
--lapped:            #60a5fa                  /* carro em volta diferente */

--lic-pro: #f4a460;  --lic-a: #1e88e5;  --lic-b: #43a047;
--lic-c:   #fdd835;  --lic-d: #fb8c00;  --lic-r: #e53935;
```

### Spacing & radius
```
--s-1: 2px;  --s-2: 4px;  --s-3: 6px;  --s-4: 8px;  --s-5: 12px;  --s-6: 16px;
--r-sm: 4px; --r-md: 6px; --r-lg: 10px;
```

### Regras visuais não-negociáveis

- **Toda janela de overlay** tem `border-radius: var(--r-lg)`, `border: 1px solid var(--border)`, `backdrop-filter: blur(18px) saturate(140%)`, e o triple box-shadow do `relative.css` (inset highlight + outer ring + drop).
- **Player highlight** sempre via `--accent` com stripe de 3px à esquerda + tint sutil de fundo + glow no stripe.
- **Class stripe** de 3px à esquerda de cada linha (multiclass), cor vinda de `CarClassColor` do iRacing.
- **License badge** com a cor da letra da licença, fonte mono, 10px.
- **Sem emojis. Sem ícones genéricos.** Tipografia + cor + spacing carregam a comunicação.
- **Modo edit:** body recebe classe `.edit-mode`, card ganha `-webkit-app-region: drag` + outline tracejado cyan.

---

## 6. Fluxos críticos

### 6.1 Boot
1. App start → `OverlayManager` lê posições salvas de `overlay-bounds.json`
2. Janelas habilitadas são criadas com bounds salvos (ou defaults)
3. `TelemetryBridge.start()` — tenta `require('node-irsdk-2023')`, cai em mock se falhar
4. `controlWindow` abre como única janela "normal" (visível na taskbar)
5. Atalhos globais `F9` (edit) e `F10` (hide) registrados

### 6.2 Telemetria
```
iRacing SDK
  → TelemetryBridge (slim) — filtra só campos usados
    → OverlayManager.broadcast('telemetry', payload)
      → cada overlay window recebe via preload bridge
        → renderer faz throttle e renderiza
```
Evento `connectionState` propaga pra todos overlays + control window (indicador de conexão).

### 6.3 Edit mode
- `F9` ou botão no control → `OverlayManager.toggleEditMode()`
- Pra cada janela: `setIgnoreMouseEvents(false)` + `setFocusable(true)` + envia `editMode: true` pro renderer
- Renderer adiciona classe `.edit-mode` no body → CSS ativa drag region + outline visual
- Usuário arrasta/redimensiona → eventos `moved`/`resized` persistem bounds
- `F9` de novo → reverte

---

## 7. Roadmap de overlays (faseado)

Cada fase é um ciclo fechado: implementar → testar → commit → próxima.

### Fase 1 — Foundation + Relative ⭐
**Entregável:** scaffold rodando + overlay Relative funcional, com awareness básica de session type.

Inclui: estrutura de arquivos completa, `main.js`, `telemetry.js` com mock, `overlay-manager.js`, `store.js`, `preload.js`, `tokens.css`, `control.html` funcional com toggle/edit/reset, e o overlay `relative.*` completo.

**Control panel (control.html) — comportamento:**

- Lista todos os overlays disponíveis (lidos do `OVERLAY_REGISTRY` em `main.js`)
- Cada item da lista tem **checkbox custom-styled** (cyan accent quando marcado, seguindo design tokens)
- Clique no checkbox OU clique no nome do overlay = toggle de visibilidade
- Marcado = overlay criado e visível (BrowserWindow ativa)
- Desmarcado = overlay destruído (BrowserWindow fechada); posição/tamanho **preservados em disco** pra próxima vez que marcar
- Cada item mostra também dimensões do overlay (ex: `420×320`) em fonte mono pequena à direita
- Estado dos checkboxes sincroniza em tempo real: atalhos globais (F10 hide all) refletem visualmente
- Indicador de conexão no topo (verde = iRacing conectado, com nome da pista/carro quando disponível)
- Botões "Edit positions" e "Reset positions" embaixo da lista

**Comportamento por session type** (detectado via `SessionInfo.Sessions[currentSession].SessionType`):

| Session type | Coluna DELTA mostra | Coluna LAST mostra |
|---|---|---|
| `Race` | Gap de tempo até carro próximo (método LapDistPct × lapTime) | Last lap time |
| `Qualifying` / `Lone Qualifying` / `Open Qualify` | Delta de **best lap** vs player best (`+0.234` / `−0.512`) | Last lap time |
| `Practice` / `Open Practice` / `Offline Testing` | Delta de **best lap** vs player best | Last lap time |
| Outros / desconhecido | Default = race behavior (sem crashar) | Last lap time |

O header do overlay mostra o session type abreviado (já planejado: "RACE", "QUALY", "PRAC").

A escolha de modo é encapsulada em uma função `pickDeltaMode(sessionType)` em `relative.js` — fácil de testar e estender. O **layout não muda** entre modos; só a interpretação da coluna delta e o que o JS calcula pra preencher ela.

**Fora do escopo da Fase 1** (documentar como limitação conhecida no README):
- Multiclass — Relative na v1 mostra posição overall apenas, lista única misturando todas as classes. Stripe de classe (cor) já está presente. Na v1.1 evolui pra **layout agrupado por classe**: cada classe ganha header próprio, sua classe (GTD/LMP/etc) recebe mais carros próximos (5+), outras classes mostram apenas os 2 mais próximos a você em delta. Coluna `CLS` (posição na classe) também entra junto.

### Fase 2 — Inputs trace
**Entregável:** overlay 360×140 com gráfico Canvas dos últimos 5s de throttle (verde), brake (vermelho), clutch (azul) + barra de steering.

Dados: `Throttle`, `Brake`, `Clutch`, `SteeringWheelAngle` (já no `_slim()`).

**Sem legenda visual** (THR/BRK/CLT). Convenção de cores é universal no sim racing — adicionar legenda só polui o overlay denso. Quem usa overlay já reconhece verde/vermelho/azul como throttle/brake/clutch.

### Fase 3 — Fuel calculator
**Entregável:** overlay 280×180 mostrando: fuel level atual, consumo médio últimas 3 voltas, voltas restantes na sessão, fuel alvo pra terminar, delta vs fuel alvo.

Dados: `FuelLevel`, `FuelUsePerHour`, `LapLastLapTime`, `SessionTimeRemain`, `Lap`. Lógica de "fuel alvo" em `src/main/calculators/fuel.js` (testável isoladamente).

### Fase 4 — Tires (pressão + temperatura)
**Entregável:** overlay 280×160 com 4 quadrantes (LF, RF, LR, RR). Cada quadrante mostra:

- **Pressão hot atual** em destaque (número grande, fonte mono, atualização contínua ~30Hz)
- **Temperatura carcaça em 3 zonas** (inner / middle / outer) como tira fina segmentada abaixo da pressão, com gradiente de cor (azul fria → verde ideal → laranja alta → vermelho crítica) e número pequeno em cada zona
- **Labels `I M O` discretos** acima da tira de temperatura em cada pneu, em ordem **espelhada geometricamente**:
  - **LF e LR** (pneus esquerdos): `O M I` da esquerda pra direita (lado externo do pneu fica na borda externa do overlay)
  - **RF e RR** (pneus direitos): `I M O` da esquerda pra direita
  - Bate com a vista de cima do carro — externo dos pneus sempre na borda externa do overlay
  - Labels em mono 8px, peso 700, cor `--text-muted` (sutis, sem competir com os números)
- **Badge "L{n}"** sutil indicando que a temperatura é snapshot da última volta finalizada (não live)

Dados a adicionar no `_slim()`: `LFpressure`, `LFtempCL`, `LFtempCM`, `LFtempCR` e equivalentes pra RF/LR/RR (8 + 12 = 20 campos novos).

**Thresholds de cor — auto-calibração por carro:**

Carros diferentes têm faixas operacionais radicalmente diferentes (Porsche Cup ~140 kPa, GT3 ~175 kPa, F4 ~120 kPa). Thresholds fixos não funcionam pra todos. Solução: **auto-calibração persistida por carro**.

Como funciona:
1. Primeira vez no carro X: overlay coleta amostras de pressão/temp por ~10 min em pista
2. Calcula percentis das amostras: p10 = "baixo/frio", p50 = "ideal", p90 = "alto/quente"
3. Salva em `userData/tire-calibration/{carPath}.json`
4. Próxima sessão naquele carro: thresholds carregados desde o tick zero
5. Continua refinando (média móvel) a cada nova sessão

**Comportamento durante calibração:**
- Badge sutil `CAL` no header do overlay (substitui o indicador de conexão)
- Cores semânticas desligadas — todos os valores em cinza neutro
- Após threshold de samples (~10 min em pista contínua), calibração estabiliza, cores ativam, badge some

**Implementação:** calculadora em `src/main/calculators/tire-calibration.js`:

```js
// Assinatura
function calibrate(samples) => { p10, p50, p90, sampleCount }
function getColorBand(value, calibration) => 'cold' | 'cool' | 'ideal' | 'warm' | 'hot' | 'crit'
```

Identificação do carro: `WeekendInfo.CarUsed` ou `DriverInfo.Drivers[playerCarIdx].CarPath`.

**Escopo negativo explícito desta fase:**
- ❌ Sem wear (decisão consciente — irrelevante em sprints de 25-40min; ver Fase 4.5)
- ❌ Sem pressão cold (só relevante em garagem, não em corrida)
- ❌ Sem temperatura de superfície (`LFtempL/M/R`) — só carcaça, mais estável

### Fase 4.5 — Tires wear (parking lot, opcional)
**Quando ativar:** se/quando Leonardo começar a rodar enduros (LMU 2-4h, iRacing 24h, séries de duração).

**Entregável previsto:** overlay separado `tires-wear.*` (não atrapalha o `tires` da Fase 4), 4 quadrantes com wear% em 3 zonas + barra horizontal + delta de wear/lap.

Dados a adicionar quando ativar: `LFwearL`, `LFwearM`, `LFwearR` (+ RF/LR/RR).

Fica fora do escopo da v1.0. Documentado aqui só pra não esquecer que o `_slim()` e o overlay-manager precisam aceitar essa adição sem refatoração.

### Fase 5 — Track map (self-building)
**Entregável:** overlay 360×260 com SVG do traçado da pista construído dinamicamente + bolinhas numeradas de todos os carros, atualizadas em tempo real via `CarIdxLapDistPct`.

**Self-building map — como funciona:**

1. **Primeira volta numa pista nova:** overlay grava `Yaw`, `VelocityX`, `VelocityY` a 30Hz
2. Integra os vetores no tempo → constrói trajetória (X, Y) ao longo da volta
3. Normaliza pra um viewBox SVG centralizado, suaviza com Catmull-Rom ou Bezier (curva continua)
4. Salva como `userData/tracks/{trackName}_{config}.svg`
5. **Sessões futuras nessa pista:** carrega SVG salvo, traçado pronto desde o tick zero
6. Funciona pra **qualquer pista** (oficial, paid content, AI session, qualquer config)
7. Zero manutenção — biblioteca de pistas cresce sozinha conforme o player roda

**Comportamento durante a primeira volta (enquanto constrói):**
- Header mostra badge sutil `MAPPING` (similar ao `CAL` dos pneus)
- Placeholder visual: oval genérico simples (reusa código baratíssimo) com bolinhas posicionadas por `LapDistPct`
- Após cross da linha da primeira volta válida (não pit-out), substitui placeholder pelo SVG construído com transição suave
- Se sessão acabar antes de completar a primeira volta, descarta amostras (não salva traçado parcial)

**Validação anti-corrupção:**
- Volta inválida (pit road, off-track, reset) descarta gravação e tenta de novo
- Tamanho mínimo de samples (ex: 1500 pontos = ~50s de volta) pra evitar mapas curtos demais
- Sanity check: traçado deve fechar (último ponto próximo do primeiro) com tolerância de ~5% do bbox

**Implementação:** módulo `src/main/calculators/map-builder.js`:

```js
function buildPath(samples) => { svgPathD, viewBox, length } | null
function validatePath(samples) => boolean
function loadOrBuild(trackKey) => Promise<{ svg, isFresh }>
```

**Como cada bolinha é posicionada** (técnica padrão, qualquer forma de traçado):

```js
const path = svgRoot.querySelector('#track-path');
const totalLength = path.getTotalLength();

for (const car of cars) {
  const point = path.getPointAtLength(totalLength * car.lapDistPct);
  circle.setAttribute('cx', point.x);
  circle.setAttribute('cy', point.y);
}
```

`path.getPointAtLength()` é API nativa do SVG — funciona pra qualquer forma de traçado (oval placeholder, traçado real construído, qualquer SVG futuro). Zero matemática manual.

**Conteúdo de cada bolinha:**
- Raio 8-10px
- Fundo: cor da classe do carro (`CarClassColor` do iRacing); player em cyan
- Número centralizado: **posição na corrida** do carro (P1, P2, ...P15)
- Fonte mono, peso 700, branco em fundo escuro / preto em fundo claro (cyan do player, amarelo do License C)
- Player ganha halo cyan ao redor (animado em pulso lento 2s)

**Forma da pista por versão:**
- v1: oval genérico (suficiente pra entender posição relativa, qualquer pista)
- v2: traçado real (parsing do arquivo `.lyt` do iRacing, ou SVGs desenhados manualmente das pistas mais comuns)

### Fase 6 — Standings (full)
**Entregável:** leaderboard completo da sessão com awareness de session type e multiclass.

**Três modos de renderização**, escolhidos via `SessionType`:

| Modo | Ordenação | Colunas | Visual destacado |
|---|---|---|---|
| **Race** | Posição (cross da linha) | POS · CAR · DRIVER · iR · GAP LÍDER · GAP À FRENTE · LAST · BEST | Gap em "+1 LAP" / "+2 LAPS" quando aplicável |
| **Qualifying** | Best lap time (ascendente) | POS · CAR · DRIVER · iR · BEST · DELTA P1 · LAST · STATUS | Status: "OUT LAP" / "IN LAP" / "FLYING" (detectado via `CarIdxOnPitRoad` + lap delta) |
| **Practice** | Best lap time (ascendente) | POS · CAR · DRIVER · iR · BEST · DELTA P1 · LAST · LAPS DONE | Similar a Qualy mas com contagem de voltas |

Implementação: cada modo é uma função `renderRace()` / `renderQualy()` / `renderPractice()` no mesmo `standings.js`. Layout/CSS é compartilhado (grid flexível com columns dinâmicas). Smart switch quando session muda (ex: practice → qualy → race numa session do iRacing).

**Multiclass** (detectado via `WeekendInfo.NumCarClasses > 1`):

- **Layout agrupado por classe** (não lista misturada). Cada classe ganha header próprio com nome da classe + contagem de carros + indicador "YOUR CLASS" quando aplicável
- Ordem dos grupos: classe mais rápida no topo (LMDh > LMP2 > GTD em IMSA, por exemplo). Identificável via `CarClassEstLapTime` (menor = mais rápida)
- Coluna **CLS** (posição na classe) aparece à direita de POS, formatada como `3/8`
- Linha do player ganha **duplo destaque** (stripe cyan + stripe de classe ambos visíveis)
- Opção de **filtro por classe** via clique no class stripe (Fase 6.5 se sobrar tempo; v1.1 caso contrário)
- Multiclass é **transversal aos 3 modos** acima — qualquer um deles renderiza com agrupamento + coluna CLS quando aplicável

**Tamanho:** 460×500 (com scroll interno se field grande).

**Fastest lap (purple lap):**

Convenção motorsport — o tempo da volta mais rápida da sessão (qualquer piloto) é renderizado em **roxo neon** (`--pos-fastest: #d946ef`) na coluna BEST. Mesmo padrão das broadcasts F1/IndyCar/IMSA.

- Detecção: linha cujo BEST é igual ao `min(BEST)` de todos os carros na sessão (na classe do player, se multiclass)
- Aplica em todos os 3 modos (Race, Qualy, Practice)
- Apenas um piloto por classe tem purple por vez
- Fonte ganha leve text-shadow no roxo pra reforçar o "neon" sem virar Las Vegas
- v1.1 backlog: destacar também o LAST quando esse foi o purple lap recém-feito (efeito "novo recorde")

**iRating estimator (race mode only):**

Header do Standings em race mode mostra estimativa de iRating gain/loss baseado na posição atual, se a corrida terminasse agora.

- Posição visual: bloco proeminente no header do Standings, à direita do session label, formatado `~+24` (verde) / `~−12` (vermelho) / `~+0` (cinza)
- Prefixo `~` é obrigatório — comunica claramente que é estimativa
- Label `iR EST` abaixo do número, fonte pequena
- Atualiza a cada mudança de posição (não precisa atualizar mais frequente que isso — render a 1Hz é suficiente)
- **Aparece apenas em `SessionType == 'Race'`**. Em quali/practice o número não faz sentido, então o bloco some inteiro
- **Multiclass:** calcula iR delta na classe do player, não overall. Detectável via `CarClassID` do player + filtrar drivers da mesma classe

**Implementação:** calculadora pura em `src/main/calculators/irating.js`, testável em isolamento.

```js
// Assinatura esperada
estimateIRChange({
  drivers,          // [{ carIdx, iRating, position, carClassId }]
  playerCarIdx,
  multiclass        // boolean — se true, restringe cálculo à classe do player
}) => { delta: number, confidence: 'estimate' }
```

Fórmula community-derived (variação ELO/Glickman):
```
B = 1600 / ln(2)  ≈  2308.55
Expected(player) = Σ 1 / (1 + exp((iR_j - iR_player) / B))  para j != player
Actual(player)   = N - position(player)
ΔiR = round(K × (Actual - Expected))
```
Constante K calibrada empiricamente. Documentar a fonte da calibração em comentário do código.

**Caveats que precisam estar no comportamento e/ou no README:**
- Hosted leagues (sem split de SOF oficial) não geram iR. Não há como detectar isso pelo SDK com confiabilidade total — assumir "race oficial" e deixar o usuário ignorar quando não for. Sem disclaimer de tela (polui a UI).
- Estimativa assume todos terminam. DNFs distorcem. Não tratar na v1.
- Precisão típica esperada: ±5 a 10 iR points vs. resultado real do iRacing.

### Fase 6.5 — Multiclass filter (parking lot, opcional)
**Quando ativar:** se você começar a rodar Special Events / IMSA / NEC / endurance multiclass com frequência.

**Entregável previsto:** clique no class stripe filtra Standings pra mostrar só essa classe. Toggle volta pra overall. Pequeno indicador no header mostra filtro ativo.

Fica fora do escopo da v1.0. Documentado pra não esquecer.

### Fase 7 — Spotter visual posicional
**Entregável:** overlay 220×240 com vista top-down mostrando seu carro no centro e posição angular dos adversários próximos ao redor.

**Visual:**
- Seu carro: retângulo cyan vertical no centro (~14×32px) com seta sutil indicando direção
- Adversários: retângulos posicionados em 8 slots angulares ao redor (N, NE, E, SE, S, SW, W, NW)
- Cor por proximidade:
  - **Cinza translúcido** = visível mas longe (5-15m)
  - **Amarelo** = atenção (3-5m, aproximando)
  - **Vermelho** = lado-a-lado (&lt;3m, contato iminente se mal calculado)
- Anéis concêntricos sutis no fundo (15m, 5m, 3m) — referência visual sem chamar atenção
- Speed do player no header (canto direito)
- Atualização em tempo real a 30Hz

**Comportamento show/hide (importante):**

O overlay **só aparece quando há adversário a <15m**. Pista limpa = overlay totalmente invisível, zero pixels desenhados.

| Trigger | Comportamento |
|---|---|
| Adversário entra em <15m | **Fade-in instantâneo** (150ms) — você precisa ver agora |
| Todos saem de >15m | **Aguarda 2s, depois fade-out** (400ms) |

O debounce de 2s na saída evita o overlay piscar quando alguém passa rapidinho perto (ex: você passando reto enquanto adversário pita, lap-out de carro mais lento, etc).

**Exceção:** modo edit (F9) mantém o overlay sempre visível pra você posicionar onde quiser, independente de ter tráfego.

**Fonte de dados (tudo direto do SDK, sem dependência do map):**

- `CarIdxLapDistPct[i]` — posição linear de cada carro no traçado
- `TrackLength` — comprimento total da pista
- `CarLeftRight` — quantos carros têm em cada lado (1 número agregado)
- `CarIdxTrackSurface[i]` — filtro pra ignorar carros em garagem/DNF

**Cálculo de posicionamento (categórico, 8 slots):**

```js
// Pra cada adversário em pista
let delta = otherLapDistPct - playerLapDistPct;
if (delta > 0.5) delta -= 1.0;       // wrap
if (delta < -0.5) delta += 1.0;

const distance = Math.abs(delta) * trackLength;  // em metros
if (distance > 15) continue;                      // fora do raio relevante

const isAhead = delta > 0;
// Lateralidade vem do CarLeftRight — atribuída aos N carros mais próximos
```

**Lógica de atribuição lateral:**

`CarLeftRight` diz quantos carros tem em cada lado mas não quais. Solução: pega os adversários mais próximos (<5m) e atribui lado conforme o estado:

| `CarLeftRight` | Atribuição |
|---|---|
| 2 (LRCarLeft) | Adversário mais próximo → esquerda |
| 3 (LRCarRight) | Adversário mais próximo → direita |
| 4 (LRCarLeftRight) | 2 mais próximos → 1 esquerda + 1 direita |
| 5 (LR2CarsLeft) | 2 mais próximos → ambos esquerda |
| 6 (LR2CarsRight) | 2 mais próximos → ambos direita |

Adversários **médios** (5-15m) vão direto pra "frente" ou "trás" pelo sinal do delta — sem lateralidade (porque o `CarLeftRight` só reporta carros muito próximos).

**Por que não dependemos do self-building map da Fase 5:**

A precisão angular fica "categórica" (8 slots discretos) ao invés de contínua. Pra um spotter visual isso é **mais que suficiente** — ninguém olha pro spotter pensando "ele tá a 47° vs 52°". Quer saber: tá do lado? perto? frente ou atrás? Tudo isso é entregue sem o map. Versão de ângulos contínuos via XY do traçado fica como melhoria v1.1.

**Dados a adicionar no `_slim()`:** `CarLeftRight`, `TrackLength` (1-2 campos novos; o resto já existe).

**Implementação:** calculadora pura em `src/main/calculators/spotter.js`:

```js
function getNearbyAdversaries({ telemetry, playerCarIdx, maxDistance = 15 })
  => Array<{ carIdx, distance, isAhead, side: 'left'|'right'|'front'|'back' }>
```

---

## 8. Critérios de aceitação (DoD por fase)

> **Importante:** todos os critérios são verificáveis a olho ou via script. Sem subjetividade.

### Fase 1 (Foundation + Relative)
- [ ] `npm install && npm start` em mock mode (Mac/Linux ou Win sem iRacing) abre o Control Panel + janela do Relative com 10 carros fictícios circulando
- [ ] `npm start` no Windows com iRacing aberto: indicador de conexão vira verde dentro de 5s da entrada num carro
- [ ] Relative atualiza posições dos carros em tempo real (a olho: ordem dos carros muda conforme posições no track)
- [ ] Linha do player tem stripe cyan visível + tint de fundo + número de posição em cyan
- [ ] Deltas mostram sinal correto: positivo (carro à frente) em vermelho, negativo (atrás) em verde
- [ ] `F9` ativa modo edit: outline tracejado cyan aparece, posso arrastar a janela
- [ ] `F9` desativa: outline some, janela volta a ser click-through
- [ ] Fecho o app, abro de novo: janela do Relative reabre na última posição/tamanho
- [ ] `F10` esconde todos overlays; `F10` mostra de novo
- [ ] Click-through verificado: clico "dentro" da janela do Relative → click vai pro app de trás (sim ou desktop)
- [ ] License badges aparecem com cores corretas por letra (A azul, B verde, C amarelo, D laranja, R vermelho)
- [ ] Renderer NÃO usa `require()` nem acessa `fs`/`net` (segurança); só `window.overlayAPI.*`
- [ ] **Control panel:** lista overlays com checkbox custom-styled (cyan quando marcado, cinza vazio quando desmarcado)
- [ ] **Control panel:** clique no checkbox OU no nome do overlay alterna visibilidade
- [ ] **Control panel:** desmarcar overlay destrói a janela; marcar de novo recria na **mesma posição/tamanho** persistidos
- [ ] **Control panel:** cada item mostra dimensões do overlay em mono pequeno à direita (ex: `420×320`)
- [ ] **Control panel:** indicador de conexão no topo mostra "Connected to iRacing · {track} · {car}" quando ligado
- [ ] **Control panel:** estado dos checkboxes reflete a realidade — se atalho global criar/destruir janela, checkbox correspondente atualiza visualmente
- [ ] **Session type detection:** header mostra "RACE" / "QUALY" / "PRAC" conforme `SessionType` atual; troca ao vivo se sessão mudar (ex: practice → qualy)
- [ ] **Modo Race:** coluna DELTA mostra gap de tempo até carros próximos (comportamento original)
- [ ] **Modo Qualy/Practice:** coluna DELTA mostra delta de **best lap** vs player best — número fica `0.000` enquanto player não tiver best lap registrado
- [ ] Função `pickDeltaMode(sessionType)` em `relative.js` tem teste unitário cobrindo: `Race`, `Qualifying`, `Lone Qualifying`, `Open Qualify`, `Practice`, `Open Practice`, `Offline Testing`, valor desconhecido (default Race)
- [ ] Mock mode gera dados de pelo menos 2 session types (race + qualy) alternando, pra validar transição visual durante dev sem precisar de iRacing

### Fase 2 (Inputs trace)
- [ ] Janela 360×140 abre via control panel
- [ ] Canvas redesenha a 30Hz sem flicker
- [ ] Throttle (verde), brake (vermelho), clutch (azul) sobrepostos, últimos 5s rolando da direita pra esquerda
- [ ] Barra de steering no rodapé: centro=neutro, esquerda/direita proporcional ao `SteeringWheelAngle`
- [ ] Performance: uso de CPU adicional do app fica abaixo de 5% num i5/i7 moderno

### Fase 3 (Fuel)
- [ ] Lógica de fuel em `src/main/calculators/fuel.js` com testes unitários (jest ou node:test)
- [ ] Testes cobrem: consumo médio com 0/1/2/3+ voltas, voltas restantes em sessão por tempo vs por voltas, fuel alvo positivo/negativo
- [ ] Overlay mostra valores coerentes em sessão real (validação manual contra app "iRacing Fuel Calculator")

### Fase 4 (Tires)
- [ ] Overlay 280×160 abre via control panel
- [ ] 4 quadrantes posicionados corretamente (LF top-left, RF top-right, LR bottom-left, RR bottom-right)
- [ ] Pressão hot é o elemento de maior peso visual em cada quadrante, atualiza em tempo real (a olho: número muda continuamente em pista, estabiliza no pit)
- [ ] Temperatura em 3 zonas renderizada como tira segmentada abaixo da pressão, com labels `I M O` espelhados: LF/LR mostram `O M I`, RF/RR mostram `I M O` (lado externo do pneu sempre na borda externa do overlay)
- [ ] Labels em mono 8px peso 700 cor muted (sutis, não competem visualmente com os números de temperatura)
- [ ] Temperatura atualiza apenas no cross da linha (snapshot por volta) — verificável: anotar valor, fazer 1 volta inteira sem mudar, confirmar que só muda após cross
- [ ] Badge "L{n}" visível em cada quadrante indica número da última volta da qual a temp veio
- [ ] **Auto-calibração:** calculadora `src/main/calculators/tire-calibration.js` com testes unitários cobrindo: (a) <10min de samples → retorna `null` ou flag de não-calibrado; (b) samples uniformes → percentis batem; (c) carregamento de calibração persistida ao iniciar overlay
- [ ] **Auto-calibração:** primeira vez num carro novo, badge `CAL` aparece no header; valores em cinza neutro (sem cores semânticas)
- [ ] **Auto-calibração:** após ~10min de samples contínuos em pista, badge some, cores ativam
- [ ] **Auto-calibração:** calibração salva em `userData/tire-calibration/{carPath}.json`; arquivo reaparece em sessão futura
- [ ] **Auto-calibração:** testado com pelo menos 2 carros diferentes (ex: Porsche Cup + Ferrari GT3) — faixas de cor são diferentes pra cada
- [ ] Nenhum elemento de wear presente (escopo negativo explícito)
- [ ] `_slim()` não inclui campos de wear nem de pressão cold nem de surface temp

### Fase 5 (Track map self-building)
- [ ] **Self-building:** primeira volta numa pista nova grava samples e constrói SVG ao cruzar a linha
- [ ] **Self-building:** badge `MAPPING` visível no header durante construção; some após primeira volta válida
- [ ] **Self-building:** SVG salvo em `userData/tracks/{trackName}_{config}.svg` e reaparece em sessão futura
- [ ] **Self-building:** placeholder oval mostrado durante a primeira volta com bolinhas posicionadas por `LapDistPct`
- [ ] **Self-building:** volta inválida (pit, off-track, reset) descarta gravação e reinicia tentativa
- [ ] **Self-building:** validação anti-corrupção — sample count mínimo (1500) + traçado deve fechar com tolerância de 5%
- [ ] **Self-building:** módulo `src/main/calculators/map-builder.js` com testes unitários cobrindo: build válido, build inválido descartado, load de pista persistida
- [ ] Posicionamento usa `path.getPointAtLength()` — sem cálculo manual de coordenadas
- [ ] Bolinhas dos carros aparecem na posição correta proporcional ao `CarIdxLapDistPct`
- [ ] Cada bolinha mostra a **posição da corrida** centralizada (P1, P2, ..., P20+)
- [ ] Cor da bolinha = cor da classe; player em cyan com halo pulsante (2s)
- [ ] Texto dentro da bolinha legível em 1080p — fonte mono, peso 700, contraste correto
- [ ] Carros no pit aparecem com opacidade ~0.4 + indicador "P" sutil ao lado
- [ ] Bolinha do player não pisca/teleporta entre frames (renderer estável)

### Fase 6 (Standings)
- [ ] Overlay 460×500 abre via control panel, com scroll interno se field > altura visível
- [ ] **Modo Race:** colunas POS · CAR · DRIVER · iR · GAP LÍDER · GAP À FRENTE · LAST · BEST; ordenação por posição; gap mostra "+N LAPS" quando car_idx_lap diverge
- [ ] **Modo Qualy:** colunas POS · CAR · DRIVER · iR · BEST · DELTA P1 · LAST · STATUS; ordenação por best lap ascendente; status calculado corretamente (OUT LAP / IN LAP / FLYING)
- [ ] **Modo Practice:** colunas POS · CAR · DRIVER · iR · BEST · DELTA P1 · LAST · LAPS DONE; ordenação por best lap ascendente
- [ ] Smart switch entre modos quando `SessionType` muda mid-session (testável em mock alternando entre práctica → quali → race)
- [ ] Funções `renderRace()`, `renderQualy()`, `renderPractice()` separadas no `standings.js`, cada uma com responsabilidade única
- [ ] **Multiclass:** layout agrupado por classe (não lista misturada). Cada classe tem header com nome + contagem + indicador "YOUR CLASS" na classe do player
- [ ] **Multiclass:** ordem dos grupos é da classe mais rápida pra mais lenta (via `CarClassEstLapTime`)
- [ ] **Multiclass:** coluna CLS aparece automaticamente, formatada `N/total`
- [ ] **Multiclass:** linha do player tem stripe cyan + stripe de classe simultâneos visualmente legíveis
- [ ] **Single class:** coluna CLS NÃO aparece, headers de grupo NÃO aparecem (zero overhead visual quando não relevante)
- [ ] Mock mode tem opção de simular field multiclass (3 classes, 12 carros total) pra validar visual sem iRacing
- [ ] **Fastest lap (purple):** BEST do piloto com menor tempo na sessão é renderizado em `--pos-fastest` (#d946ef) com text-shadow sutil
- [ ] **Fastest lap (purple):** funciona em todos os 3 modos (Race, Qualy, Practice)
- [ ] **Fastest lap (purple) multiclass:** quando `NumCarClasses > 1`, há um purple por classe (purple do líder LMDh ≠ purple do líder GTD)
- [ ] **Fastest lap (purple):** se vários pilotos têm exatamente o mesmo BEST, só o primeiro na ordenação ganha purple (caso raro mas determinístico)
- [ ] **iR estimator:** calculadora `src/main/calculators/irating.js` com testes unitários cobrindo: (a) field homogêneo 8 pilotos, player no meio → ΔiR ≈ 0; (b) underdog vence (player iR muito abaixo da média, finaliza P1) → ΔiR fortemente positivo; (c) favorito perde (player iR muito acima, finaliza último) → ΔiR fortemente negativo; (d) multiclass com player em LMP3 e outras classes ignoradas
- [ ] **iR estimator:** bloco visível no header do Standings APENAS em `SessionType == 'Race'`; some inteiro em quali/practice
- [ ] **iR estimator:** prefixo `~` sempre presente; cor verde se positivo, vermelha se negativo, cinza se zero; label "iR EST" abaixo
- [ ] **iR estimator:** valor atualiza ao mudar posição (no mock: a cada 30s o mock muda artificialmente a posição do player e o número deve refletir)
- [ ] **iR estimator multiclass:** quando `NumCarClasses > 1`, cálculo restringe ao field da classe do player (validável no mock multiclass)

### Fase 7 (Spotter visual posicional)
- [ ] Overlay 220×240 abre via control panel
- [ ] Seu carro renderizado como retângulo cyan no centro (~14×32px) com seta de direção
- [ ] Adversários filtrados por distância (apenas <15m visíveis)
- [ ] 8 slots angulares possíveis (N, NE, E, SE, S, SW, W, NW); adversários posicionados conforme `isAhead` × `side`
- [ ] Cor por proximidade: cinza translúcido (5-15m), amarelo (3-5m), vermelho (&lt;3m)
- [ ] Atualização em tempo real a 30Hz
- [ ] **Atribuição lateral usa `CarLeftRight`** combinado com lista dos N adversários mais próximos (lógica documentada na spec)
- [ ] Adversários médios (5-15m) sem lateralidade — vão pra "frente" ou "trás" pelo sinal do delta
- [ ] Anéis concêntricos de referência (15m, 5m, 3m) visíveis mas sutis
- [ ] Speed atual do player no header
- [ ] Mock mode cicla por 4 cenários (limpo / lado-a-lado esquerda / three wide / tráfego misto) a cada 4s
- [ ] `_slim()` adiciona `CarLeftRight` e `TrackLength` (campos únicos pra essa fase; resto já existe)
- [ ] Calculadora `src/main/calculators/spotter.js` com testes unitários cobrindo:
  - (a) adversário com delta positivo é classificado como `isAhead: true`
  - (b) wrap correto na linha de chegada (carro 0.05 LapDist vs player 0.95 = adversário 5m à frente)
  - (c) `CarLeftRight = 4` (three wide) com 2 adversários próximos → 1 ganha lado esquerda, outro direita
  - (d) `CarLeftRight = 5` (2 cars left) com 3 adversários próximos → 2 mais próximos ganham esquerda, terceiro vira frente/trás
  - (e) adversário >15m é filtrado fora
- [ ] Funciona desde o tick zero em qualquer pista — **sem dependência do map self-building**
- [ ] **Show/hide:** overlay invisível (zero pixels) quando nenhum adversário a <15m
- [ ] **Show/hide:** fade-in instantâneo (150ms) quando primeiro adversário entra em <15m
- [ ] **Show/hide:** fade-out só após debounce de 2s + transição 400ms (testável: cria mock que coloca adversário próximo por 1s e depois afasta — overlay NÃO some imediatamente)
- [ ] **Show/hide:** modo edit (F9) ignora o debounce e mantém overlay sempre visível pra posicionamento

---

## 9. Anti-padrões (não fazer)

- ❌ **Não usar React/Vue/Svelte na v1.** Vanilla JS é suficiente; build pipeline atrapalha mais que ajuda nesse escopo.
- ❌ **Não usar Tailwind.** Tokens em CSS vars são a fonte da verdade — Tailwind ofusca isso.
- ❌ **Não adicionar gradientes, drop-shadows complexas, animações pulsantes.** O design é refinado, não chamativo. Único glow permitido: o do stripe do player.
- ❌ **Não polluir `_slim()` com campos não usados.** Cada campo adicionado tem destino certo num overlay específico.
- ❌ **Não compartilhar lógica entre overlays.** Se aparecer duplicação, primeiro questiona se os overlays não deveriam ser um só. Só extrai pra módulo comum se a duplicação for genuína e estável (raro).
- ❌ **Não usar `setInterval` no renderer pra animar.** Usa `requestAnimationFrame` quando precisar animar fora do tick de telemetria.
- ❌ **Não bloquear a thread principal com cálculos pesados** (parsing de YAML grande, etc.) — sempre dentro de handlers async.
- ❌ **Não fazer overlay "configurável" em runtime na v1.** Customização é editar o código. Reduz UI surface, mantém foco.

---

## 10. Plano de testes (você é QA, então atenção)

### Testes manuais por release
Checklist em `docs/test-checklist.md`, executado antes de cada tag:
1. Boot em mock mode (Mac): control + Relative aparecem
2. Boot em Windows sem iRacing: indicador cinza, overlays vazios sem erro
3. Boot em Windows com iRacing em garagem: indicador verde, overlays prontos
4. Sessão de prática: dados atualizam, sem freeze
5. Voltar pro garagem: overlays continuam vivos
6. Sair do iRacing: indicador vira cinza, app não crasha
7. Atalhos: F9/F10 em sequência rápida (10x cada) sem efeito colateral
8. Resize manual: arrasta canto → bounds persistem após restart

### Testes unitários
Onde fazer sentido — preferencialmente em calculadoras puras (`fuel.js`, math de gap relativo, etc.). Não testar layout/CSS.

### Testes de performance
- Memória do app < 200MB com 4 overlays abertos
- CPU adicional < 8% num i7 moderno com 4 overlays
- FPS do iRacing não degrada >2fps com app rodando (medir com built-in F shortcut do iRacing)

---

## 11. Entregáveis finais (v1.0)

- [ ] App empacotado como `.exe` instalador via `electron-builder` (não bloqueante pra dev — feito ao final)
- [ ] README com screenshots, atalhos, link de download
- [ ] `docs/adding-an-overlay.md` com passo a passo
- [ ] CHANGELOG.md
- [ ] Repo público no GitHub com tag v1.0.0

---

## Apêndice A — Como usar este PRD com Claude Code

1. Inicia o projeto com `npx create-electron-app@latest boxboxbox` (ou do zero — Claude Code resolve)
2. Cria `CLAUDE.md` no root com:
   ```
   Leia o PRD em ./docs/PRD.md antes de qualquer mudança.
   Stack, tokens e regras visuais são imutáveis sem motivo explícito.
   Trabalhe uma fase de cada vez. Critérios de aceitação da fase atual
   devem todos passar antes de avançar.
   ```
3. Move este arquivo pra `docs/PRD.md`
4. Primeira instrução: "Implemente a Fase 1 do PRD. Quando todos os critérios
   de aceitação da Fase 1 estiverem cumpridos, pare e me chame pra revisão."

---

## Apêndice B — Decisões deixadas em aberto (decidir antes da Fase 5)

- Forma do traçado no Track Map v1: linear stretched ou retângulo arredondado?
- Persistir layout completo (multi-overlay) como "preset" nomeado? (provavelmente sim, na v1.1)

## Apêndice C — Backlog v1.1 (consciente, fora da v1.0)

Itens decididamente fora da v1.0 mas que devem ser endereçados depois. Documentados pra não virem como "surpresa" no roadmap:

- **Multiclass position-in-class no Relative** — atualmente Relative só mostra posição overall. Stripe de classe (cor) já comunica a classe, mas adicionar coluna `CLS` (posição na classe) ajuda em IMSA/NEC/Special Events. Layout evolui pra agrupado por classe (mesma estratégia da Fase 6).
- **Multiclass filter no Standings** (= Fase 6.5) — clique no class stripe filtra leaderboard pela classe
- **Tires wear** (= Fase 4.5) — overlay separado pra enduros
- **Presets de layout** — salvar/carregar configurações nomeadas (ex: "Sprint", "Enduro", "Stream")
- **Tire calibration: thresholds editáveis pelo usuário** — UI no control panel pra ajustar p10/p50/p90 manualmente caso auto-calibração não agrade
- **Standalone "iR Delta" overlay** — janela minúscula (~180×80) só com o número de iR estimator, sempre visível em race sem precisar abrir Standings. Reutiliza `calculators/irating.js`
- **iR estimator com per-position table** — tooltip mostrando "se finalizar P1: ~+30, P2: ~+22..." Útil pra estratégia de fim de corrida
- **Spotter posicional com ângulos contínuos** — atualmente os adversários aparecem em 8 slots discretos (N, NE, E, SE...). Na v1.1 evolui pra ângulos contínuos usando XY do traçado real (`path.getPointAtLength()` do map self-building da Fase 5) + rotação pelo `Yaw` do player. Visualmente mais bonito e preciso, mas ganho prático marginal vs slots discretos.
- **SR (Safety Rating) estimator** — paralelo ao iR estimator no header do Standings. Fórmula community-derived:

  ```js
  // src/main/calculators/sr.js
  function estimateSRChange({ incidents, cornersCompleted, threshold = 0.10 }) {
    if (cornersCompleted < 20) return { delta: 0, confidence: 'low', ipc: 0 };
    const ipc = incidents / cornersCompleted;     // incidents per corner
    const margin = threshold - ipc;               // + = abaixo do threshold (bom)
    let delta;
    if (margin >= 0.05)      delta = 0.20 + margin * 0.5;   // muito limpo
    else if (margin >= 0)    delta = 0.05 + margin * 3.0;   // borderline
    else                     delta = margin * 4.0;          // acima do threshold
    return { delta: Math.round(delta * 100) / 100, ipc, confidence: cornersCompleted < 60 ? 'low' : 'estimate' };
  }
  ```

  **Frequência de atualização: por volta completada** (no cross da linha). Razões: não exige detecção de corners em runtime, resultados estáveis (sem oscilação visual), match com snapshot por volta que já é o padrão do overlay de pneus. Numerador (`PlayerCarMyIncidentCount`) atualiza em tempo real; denominador (`cornersCompleted = lapsCompleted × cornersPerLap`) só evolui no cross.

  **Corners por volta:** valor fixo de 17 (média road) na v1.1. Na v1.2 substitui por detecção dinâmica (corner = mudança de heading > 30° num intervalo curto), aprendida durante a primeira volta do player na pista.

  **Threshold:** 0.10 (Road). Categorias diferentes usam thresholds diferentes (Oval ~0.06, Dirt outras escalas) — detectar via session info na v1.2.

  Display: `~+0.18 SR` (verde) / `~−0.32 SR` (vermelho), ao lado do iR estimator. DNF aplica penalidade fixa (~−0.30) que a fórmula não modela — caveat documentado.