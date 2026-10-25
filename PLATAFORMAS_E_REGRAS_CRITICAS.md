# 📱🖥️📺 GUIA DEFINITIVO DE ARQUITETURA, PLATAFORMAS E REGRAS CRÍTICAS (BAT TV)

> ⚠️ **AVISO OBRIGATÓRIO PARA QUALQUER DESENVOLVEDOR OU AGENTE DE IA**:
> Este aplicativo é uma solução unificada (Vite + React 19 + Capacitor + Electron) que roda em **5 plataformas diferentes**.
> **NUNCA** altere as regras específicas de uma plataforma ao trabalhar em outra. O que é solução para o iPhone/PWA quebra o Fire Stick, e o que é solução para TV quebra a Web. Siga este manual à risca.

---

## 📑 Índice de Plataformas
1. [Fire TV Stick / Android TV / Smart TV (APK Nativo)](#1-fire-tv-stick--android-tv--smart-tv-apk-nativo)
2. [PWA iPhone / iOS Safari (Standalone)](#2-pwa-iphone--ios-safari-standalone)
3. [Navegador Mobile Vertical (Celular Web - Safari / Chrome)](#3-navegador-mobile-vertical-celular-web---safari--chrome)
4. [Desktop Instalável Windows (.exe / Electron)](#4-desktop-instalável-windows-exe--electron)
5. [Navegador PC Desktop (Web / Vercel no Computador)](#5-navegador-pc-desktop-web--vercel-no-computador)

---

## 1. Fire TV Stick / Android TV / Smart TV (APK Nativo)

### 📌 Como funciona
- Empacotado com **Capacitor Android** rodando `MainActivity.java`.
- O player de vídeo é o **ExoPlayer (AndroidX Media3)** através do plugin nativo `NativePlayerPlugin.java`, posicionado **por trás** da WebView do Capacitor.
- A WebView fica com `Color.TRANSPARENT`, permitindo que o vídeo nativo apareça enquanto a interface React (controles, barra de tempo, títulos) flutua por cima.

### 🚫 REGRAS CRÍTICAS E O QUE NUNCA FAZER NA TV:
1. **NUNCA usar `surface_view` no layout do player**:
   - Arquivo: `android/app/src/main/res/layout/player_texture_view.xml`.
   - **OBRIGATÓRIO**: `app:surface_type="texture_view"`.
   - *Por quê?* No Fire OS (chips MediaTek e Amlogic), a `SurfaceView` não consegue perfurar o canal alfa da WebView sobreposta, causando o famoso bug de **TELA PRETA com áudio tocando ao fundo**. A `TextureView` renderiza na mesma árvore de views OpenGL e nunca dá tela preta.
2. **NUNCA colocar `transform: translateZ(0)` ou `will-change: transform` na raiz `html` ou `body`**:
   - Arquivo: `src/index.css` (classe `html.tv-perf-mode`).
   - *Por quê?* No Chromium WebView do Android, qualquer `transform` na tag `<html>` isola a janela em um buffer offscreen não-transparente, transformando a transparência em fundo preto sólido cobrindo o vídeo.
3. **NUNCA ativar `setOffscreenPreRaster(true)` no WebView**:
   - Arquivo: `MainActivity.java`.
   - *Por quê?* Força rasterização offscreen num buffer opaco e quebra a transparência da janela sobreposta.
4. **NUNCA exibir botão/pop-up de "Toque para ativar o som" ou "Toque para Assistir" na TV**:
   - Arquivos: `Player.tsx` e `PwaPlayer.tsx`.
   - **OBRIGATÓRIO**: Usar `{!isNative && needsUnmute && ...}` e `{!isNative && needsUserGesture && ...}`.
   - *Por quê?* No Android nativo / TV não existe restrição de autoplay de navegador. O ExoPlayer inicia tocando com áudio 100% imediatamente.
5. **NUNCA deixar o clique de toque da TV tentar controlar `<video>` HTML5**:
   - Na função `toggleControlsViaTap`: se `isNative === true`, **apenas alterne a visibilidade dos controles** (`setShowControls`), nunca tente dar `videoRef.current.play()` nem alterar estado de mute.
6. **Proteção do Botão Físico "Voltar" (Back Button do Controle Remoto)**:
   - Configurado no `MainActivity.java`: fecha modais ou players ativos primeiro; se estiver na tela inicial, exige dois cliques em menos de 2.5s com Toast de aviso para evitar sair do app sem querer.
7. **Modo TV Ultra Fluidez (Estilo Prime Video)**:
   - Foco D-pad ultra ágil com transição de **50ms** (`transition: transform 50ms`).
   - Sem sombras pesadas (`box-shadow: none !important`), mantendo 60 FPS cravados.

---

## 2. PWA iPhone / iOS Safari (Standalone)

### 📌 Como funciona
- Adicionado à Tela de Início do iPhone via Safari iOS.
- Renderiza o componente especializado `PwaPlayer.tsx`.

### 🚫 REGRAS CRÍTICAS E O QUE NUNCA FAZER NO PWA IPHONE:
1. **Obrigatório suporte a autoplay mutado inicial**:
   - A política de segurança do WebKit (Apple) **bloqueia** reprodução com áudio se não houver um toque físico prévio na tela.
   - O PWA **precisa** iniciar o elemento `<video>` em mute (`v.muted = true`) e exibir o botão flutuante `"Toque para ativar o som"`.
2. **NUNCA chamar `requestFullscreen()` nativo do QuickTime**:
   - No iOS, chamar tela cheia nativa delega para o player fechado da Apple, destruindo a troca de canais, proporção de tela, legendas e o mini-guia.
   - O app usa o modo inteligente de **rotação virtual em 90 graus** quando o celular está na vertical e o usuário quer tela cheia horizontal.
3. **Detecção Estrita do PWA**:
   - Arquivo: `src/context/PlaybackContext.tsx`.
   - Só é PWA se: `!Capacitor.isNativePlatform() && !window.__IS_ANDROID_TV__ && ((navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches)`.
   - **NUNCA** incluir `matchMedia('(display-mode: fullscreen)').matches` na checagem de PWA, pois Smart TVs rodam em fullscreen e eram detectadas erroneamente como iPhone!

---

## 3. Navegador Mobile Vertical (Celular Web - Safari / Chrome)

### 📌 Como funciona
- Acessado pelo link da Vercel no celular em orientação vertical (retrato).
- Detectado dinamicamente por `useIsMobile(768)` e renderiza `MobileShell.tsx` com `MobileHome.tsx`.

### 🚫 REGRAS CRÍTICAS E O QUE NUNCA FAZER NO MOBILE VERTICAL:
1. **Layout e Proporções Compactas**:
   - A tela vertical tem entre 360px e 430px de largura. Nunca use grades largas ou carrosséis com cards maiores que `w-44` para continuar assistindo ou `w-28` para pôsteres.
2. **Seção "Continuar assistindo"**:
   - Fica logo abaixo do Hero Banner vertical.
   - Mostra thumbnail 16:9, botão de Play central translúcido, subtítulo do episódio ou tempo restante e **barra de progresso vermelha** na base.
   - Ao tocar, aciona `play(item, { fromStart: false })` retomando do ponto salvo.
3. **Seção "Top 10 no Brasil" com 5 Streamings**:
   - Inicia por padrão na **Netflix** (`STREAMING_PROVIDERS[0]`).
   - Possui barra seletora horizontal compacta com logos oficiais em SVG das 5 plataformas: **Netflix**, **Prime Video**, **Max**, **Disney+** e **Globoplay**.
   - Cards com números gigantes de 1 a 10 estilizados (`text-6xl` com stroke) e pôsteres verticais compactos.
4. **Proxy CORS**:
   - No navegador web mobile, conexões de IPTV HTTP precisam do proxy (`buildProxyUrl`) para contornar bloqueio de Mixed Content (HTTPS -> HTTP) e restrições de CORS.

---

## 4. Desktop Instalável Windows (.exe / Electron)

### 📌 Como funciona
- Aplicativo nativo empacotado via **Electron** e **electron-builder**.
- Main process em `electron/main.cjs`, gera instalador NSIS `BAT-TV-Setup-0.1.2.exe`.

### 🚫 REGRAS CRÍTICAS E O QUE NUNCA FAZER NO DESKTOP INSTALÁVEL:
1. **Conexão Direta de Vídeo (Sem Proxy)**:
   - No Electron, o `webSecurity` é ajustado para permitir streaming direto no protocolo HTTP/HTTPS sem passar por proxies intermediários.
   - Isso garante carregamento instantâneo de canais ao vivo e filmes 4K com buffer mínimo.
2. **Ícones Multi-Resolução**:
   - O ícone do Windows `build/icon.ico` contém camadas embutidas de 16x16 até 256x256 geradas pelo script `scripts/build_ico.cjs`. Nunca substitua por um `.ico` simples de 1 camada.

---

## 5. Navegador PC Desktop (Web / Vercel no Computador)

### 📌 Como funciona
- Interface widescreen completa em `Shell.tsx` com `Home.tsx`.
- Utiliza `hls.js` para decodificar streams HLS na tag `<video>`.

### 🚫 REGRAS CRÍTICAS E O QUE NUNCA FAZER NA WEB DESKTOP:
1. **Mini-Tela Expandida no Hover (Estilo Netflix)**:
   - Exclusiva para mouse no PC desktop (`!Capacitor.isNativePlatform() && isExpanded`).
   - Carrega prévia do trailer após 800ms de hover com som controlado.
2. **Setas de Navegação Lateral**:
   - Carrosséis possuem setas de rolagem lateral esquerda/direita ativadas por mouse.
3. **Proxy Reverso para Streams HTTP**:
   - Obrigatório o uso de `buildProxyUrl` para contornar Mixed Content em hospedagens HTTPS como a Vercel.

---

## ⚽ HUB DE ESPORTES E TRANSIÇÃO PARA TV (FIRE TV STICK)

### 📌 Regras de Navegação e Performance no Hub de Esportes:
1. **Modal de Seleção de Canais (`SportsChannelPickerModal.tsx`)**:
   - Navegação D-pad estritamente vertical entre as opções de canais (`button[data-channel-option="true"]`).
   - Botão fechar (X) marcado com `tabIndex={-1}` para não ser atingido por engano no D-pad (fechamento é feito pelo botão Voltar do controle).
   - Sem salto circular infinito: ao chegar no último canal para baixo, permanece no último; ao chegar no primeiro para cima, permanece no primeiro.
   - Sempre executa `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` para manter o canal focado na tela visível.

2. **Otimização Crítica e Pureza da Lista de Canais ao Abrir Jogo pelo Hub de Esportes (`sportsPlaylist.ts`)**:
   - **NUNCA passar a lista bruta com 10.000 canais IPTV** no parâmetro `playlist` do `play()`.
   - **NUNCA poluir a lista de esportes com canais generalistas ou de notícias**: A função `buildSportsPlaylist` aplica filtro rigoroso que exclui terminantemente canais como `GloboNews`, `Record News`, `BandNews`, `Jovem Pan`, novelas e canais abertos regionais.
   - O player de esportes exibe uma lista limpa, estritamente de esportes, priorizada por relevância (`SporTV`, `Premiere`, `ESPN`, `CazéTV`, `BandSports`, etc.), com o canal em reprodução fixado no topo.
   - Tanto em `Player.tsx` quanto em `PwaPlayer.tsx`, o QuickZap renderiza com alta performance instantânea.

3. **Alerta de Gols Simultâneos do Mesmo Campeonato (`GoalNotificationBanner.tsx`)**:
   - Ao reproduzir uma partida ao vivo pelo Hub de Esportes, é passado `matchContext` contendo `leagueId`, `matchId` e `leagueName`.
   - Consulta a API da ESPN a cada 45 segundos em segundo plano (baixíssimo consumo de CPU/memória para Smart TVs).
   - Quando sai gol em outro jogo do mesmo campeonato, um banner flutuante discreto e moderno surge no canto da tela por exatamente 5 segundos e desaparece automaticamente.
   - Não dispara alerta para gols da partida que o usuário já está assistindo na tela.

4. **Vínculo Direto com Emissora Exata e Tabela De-Para (`broadcasterMapper.ts` e `channelMatcher.ts`)**:
   - Cada jogo do dia possui metadados de transmissão: `broadcaster` (ex: `"ESPN 2"` ou `"Premiere 2"`), `broadcasters` e `hasExactBroadcast`.
   - **Busca por Evento (`findChannelByMatchTeams`)**: Antes de recorrer a nomes genéricos, o app verifica se existe um canal no IPTV nomeado com os dois times da partida (ex: `"PREMIERE 2 - CRUZEIRO X REMO"`). Se existir, entra direto nele.
   - **Sem Expansão Artificial de Subcanais**: O app NUNCA expande `"Premiere"` em `"Premiere 1, 2, 3, 4, 5"` para forçar o usuário a adivinhar. Se o canal for Premiere, vai direto ao canal Premiere principal sem modal.
   - **Modal apenas para plataformas diferentes**: Se um jogo passar simultaneamente em duas plataformas oficiais distintas (ex: `"Disney+"` e `"ESPN 4"`, ou `"Globo"` e `"Premiere"`), o modal exibirá exclusivamente essas 2 opções. Se o usuário tiver apenas uma, vai direto sem modal.

---

## 🔒 TABELA RÁPIDA DE DECISÃO (CHECKLIST PARA AGENTES E DEVS)

| Plataforma | Player Utilizado | Som / Autoplay | Layout de Vídeo | Proxy de Vídeo? |
| :--- | :--- | :--- | :--- | :--- |
| **Fire TV / Smart TV** | `Player.tsx` + `NativePlayer` | Direto 100% (Sem popup) | `texture_view` (Transparente) | Não (Direto) |
| **PWA iPhone (iOS)** | `PwaPlayer.tsx` | Mudo inicial + Botão som | `<video>` HTML5 com rotação 90° | Sim (se HTTPS) |
| **Mobile Web (Celular)** | `Player.tsx` | Mudo inicial no Safari/Chrome | `<video>` HTML5 | Sim (CORS proxy) |
| **Desktop Windows (Exe)** | `Player.tsx` | Direto | `<video>` HTML5 | Não (Bypass Electron) |
| **Web PC (Navegador)** | `Player.tsx` | Direto | `<video>` HTML5 + hls.js | Sim (CORS proxy) |

> 💡 **Lembrete Final**: Antes de rodar `git push` ou compilar para TV, verifique se a alteração não viola nenhuma das proibições acima!
