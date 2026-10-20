# Planejamento de Otimizações Futuras - BAT TV

Este documento registra as 5 melhorias planejadas para implementação futura, conforme alinhado com o usuário.

---

### 1. Virtualização de Listas nas Grades Longas (Windowing / Virtual Scroll)
- **Objetivo**: Reduzir consumo de memória RAM e acelerar a rolagem em categorias com centenas/milhares de títulos.
- **Como funciona**: Em vez de renderizar centenas de nós no DOM simultaneamente, o app mantém montados apenas os 20 a 30 cards visíveis na janela da TV, reciclabilidade de elementos em tempo real.
- **Impacto no Fire TV**: Reduz uso de RAM em mais de 70% e crava a rolagem em 60 FPS estáveis mesmo em aparelhos com 1 GB de RAM.

---

### 2. Cache em Disco das Listas IPTV (IndexedDB / Armazenamento Local)
- **Objetivo**: Carregamento instantâneo do catálogo ao abrir o aplicativo ou alternar abas.
- **Como funciona**: Salva uma cópia estruturada das categorias e títulos localmente no armazenamento do aparelho (IndexedDB) e faz atualizações silenciosas em segundo plano (stale-while-revalidate).
- **Impacto no Fire TV**: As telas de Filmes, Séries e TV ao Vivo abrem em menos de 100 ms, sem esperar requisições HTTP ao servidor Xtream.

---

### 3. Otimização de Resolução de Imagens das Capas (Thumbnails TMDB / WebP)
- **Objetivo**: Economia de banda e carregamento ultra-rápido das capas.
- **Como funciona**: Solicitar tamanhos otimizados para grid (`w300`/`w342` em vez de resoluções excessivas) e imagens no formato leve WebP.
- **Impacto no Fire TV**: Download das capas na metade do tempo e menor esforço da GPU do aparelho para decodificar imagens.

---

### 4. Modo "Trailer Lite" ou Opção de Desativar Trailers no Banner
- **Objetivo**: Fluidez máxima e resposta instantânea de cliques para usuários que priorizam agilidade total sobre efeitos audiovisuais.
- **Como funciona**: Adicionar nas Configurações do App uma chave: *Trailer no Banner (Ativado / Desativado)*. Ao desativar, o banner exibe apenas o pôster estático panorâmico em 1280px com 0% de uso de CPU com player de vídeo.

---

### 5. Ícone Oficial do BAT TV no Menu do Fire TV Stick
- **Objetivo**: Substituir o ícone genérico do Android pelo logotipo oficial do BAT TV na tela inicial e gaveta de aplicativos do Fire OS.
- **Como funciona**: 
  - Adicionar o banner Leanback de TV em alta resolução (320x180 px no formato PNG com transparência e proporção 16:9 oficial para Android TV / Fire TV) em `android/app/src/main/res/drawable/banner.png`.
  - Configurar os ícones `ic_launcher.png` e `ic_launcher_round.png` em todas as densidades (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
