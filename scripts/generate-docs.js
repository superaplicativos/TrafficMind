/**
 * TrafficMind — Documentação do MVP
 * Gera um documento .docx profissional com a documentação completa do projeto.
 */

const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  Table, TableRow, TableCell, WidthType, TableLayoutType,
  PageBreak, NumberFormat,
} = require("docx");
const fs = require("fs");

// ============================================================================
// Paleta — Dark Navigation (inspirada no tema do app)
// ============================================================================
const P = {
  bg: "0F1419",
  primary: "06B6D4",
  accent: "F59E0B",
  titleColor: "FFFFFF",
  subtitleColor: "B8C5D1",
  metaColor: "8B9BA8",
  footerColor: "6B7B89",
  bodyText: "1A2332",
  headingText: "0F1419",
  surfaceLight: "F4F7FA",
  borderLight: "D6DEE6",
};

const c = (hex) => hex.replace("#", "");

// ============================================================================
// Helpers
// ============================================================================
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB,
                       insideHorizontal: NB, insideVertical: NB };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: c(P.headingText),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.headingText),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 22, color: c(P.bodyText),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 80 },
    indent: { left: 720 + level * 360, hanging: 360 },
    children: [
      new TextRun({ text: level === 0 ? "•  " : "◦  ", size: 22, color: c(P.primary), bold: true }),
      new TextRun({ text, size: 22, color: c(P.bodyText),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

function codeLine(text) {
  return new Paragraph({
    spacing: { line: 276, after: 40 },
    indent: { left: 360 },
    shading: { type: ShadingType.CLEAR, fill: P.surfaceLight },
    children: [new TextRun({ text, size: 20, color: "0F1419",
      font: { ascii: "Consolas", eastAsia: "Consolas" } })],
  });
}

function calloutBox(title, text, fillColor, borderColor) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: c(borderColor) },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: c(borderColor) },
      left: { style: BorderStyle.SINGLE, size: 12, color: c(borderColor) },
      right: { style: BorderStyle.SINGLE, size: 4, color: c(borderColor) },
      insideHorizontal: NB, insideVertical: NB,
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: fillColor },
        margins: { top: 200, bottom: 200, left: 300, right: 300 },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: title, bold: true, size: 22, color: c(P.headingText),
              font: { ascii: "Calibri" } })],
          }),
          new Paragraph({
            spacing: { line: 300 },
            children: [new TextRun({ text, size: 20, color: c(P.bodyText),
              font: { ascii: "Calibri" } })],
          }),
        ],
      })],
    })],
  });
}

function makeTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h) => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: P.primary },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: h, bold: true, size: 20, color: "FFFFFF",
          font: { ascii: "Calibri" } })],
      })],
    })),
  });

  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map((cell) => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "FFFFFF" : P.surfaceLight },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), size: 20, color: c(P.bodyText),
          font: { ascii: "Calibri" } })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.borderLight) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.borderLight) },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.borderLight) },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

function spacer(height) {
  return new Paragraph({ spacing: { before: height || 200 }, children: [] });
}

// ============================================================================
// CAPA — Recipe R1 (Pure Paragraph, Left-Aligned)
// ============================================================================
function buildCover() {
  const padL = 1200, padR = 800;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.primary), space: 12 };

  const children = [
    new Paragraph({ spacing: { before: 2800 }, children: [] }),

    new Paragraph({
      indent: { left: padL, right: padR },
      spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.primary), space: 8 } },
      children: [new TextRun({
        text: "T  R  A  F  F  I  C  M  I  N  D    M  V  P",
        size: 18, color: c(P.primary), font: { ascii: "Calibri" }, characterSpacing: 40,
      })],
    }),

    new Paragraph({
      indent: { left: padL },
      spacing: { after: 200, line: 920, lineRule: "atLeast" },
      children: [new TextRun({
        text: "Documenta\u00e7\u00e3o",
        size: 80, bold: true, color: c(P.titleColor),
        font: { ascii: "Arial", eastAsia: "SimHei" },
      })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 400, line: 920, lineRule: "atLeast" },
      children: [new TextRun({
        text: "do MVP",
        size: 80, bold: true, color: c(P.titleColor),
        font: { ascii: "Arial", eastAsia: "SimHei" },
      })],
    }),

    new Paragraph({
      indent: { left: padL },
      spacing: { after: 800 },
      children: [new TextRun({
        text: "Navega\u00e7\u00e3o inteligente com roteamento multi-crit\u00e9rio",
        size: 26, color: c(P.subtitleColor),
        font: { ascii: "Arial" },
      })],
    }),

    new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: "Projeto: TrafficMind", size: 24, color: c(P.metaColor),
        font: { ascii: "Arial" } })],
    }),
    new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: "Vers\u00e3o: 1.0.0-mvp", size: 24, color: c(P.metaColor),
        font: { ascii: "Arial" } })],
    }),
    new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: "Data: Julho de 2026", size: 24, color: c(P.metaColor),
        font: { ascii: "Arial" } })],
    }),
    new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: "Foco geogr\u00e1fico: S\u00e3o Paulo, Brasil", size: 24, color: c(P.metaColor),
        font: { ascii: "Arial" } })],
    }),

    new Paragraph({ spacing: { before: 3200 }, children: [] }),

    new Paragraph({
      indent: { left: padL, right: padR },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.primary), space: 8 } },
      spacing: { before: 200 },
      children: [
        new TextRun({ text: "TrafficMind", size: 16, color: c(P.footerColor), font: { ascii: "Arial" } }),
        new TextRun({ text: "                                                        " }),
        new TextRun({ text: "Documento t\u00e9cnico confidencial", size: 16, color: c(P.footerColor), font: { ascii: "Arial" } }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ============================================================================
// CORPO
// ============================================================================
function buildBody() {
  const s = [];

  // 1
  s.push(h1("1. Sum\u00e1rio Executivo"));
  s.push(body("O TrafficMind \u00e9 um aplicativo web mobile-first de navega\u00e7\u00e3o inteligente que diferencia-se dos concorrentes tradicionais (Waze, Google Maps) por n\u00e3o se limitar ao c\u00e1lculo da rota mais r\u00e1pida. Em vez disso, o sistema calcula m\u00faltiplas rotas alternativas simultaneamente e as classifica atrav\u00e9s de um score composto e transparente que combina quatro dimens\u00f5es: tempo estimado de chegada (ETA), n\u00edvel de tr\u00e2nsito simulado, n\u00famero de cruzamentos e complexidade da via."));
  s.push(body("Este documento descreve o estado atual do Minimum Viable Product (MVP) desenvolvido em julho de 2026, incluindo a arquitetura t\u00e9cnica completa, as funcionalidades implementadas, as dificuldades encontradas durante o desenvolvimento, a stack tecnol\u00f3gica adotada, os custos de opera\u00e7\u00e3o e uma an\u00e1lise de viabilidade comercial. O objetivo \u00e9 fornecer uma vis\u00e3o clara e honesta do que foi constru\u00eddo, do que falta construir e do valor de mercado do produto em seu est\u00e1gio atual."));
  s.push(body("O MVP est\u00e1 funcional e acess\u00edvel via deploy p\u00fablico. Ele demonstra end-to-end o fluxo de busca de destino, geolocaliza\u00e7\u00e3o do usu\u00e1rio, c\u00e1lculo de cinco rotas alternativas com estrat\u00e9gias distintas, exibi\u00e7\u00e3o em mapa interativo com tema escuro e ranking por score composto. A arquitetura foi desenhada seguindo os princ\u00edpios de Clean Architecture, com separa\u00e7\u00e3o clara entre camadas de dom\u00ednio, aplica\u00e7\u00e3o, infraestrutura e apresenta\u00e7\u00e3o, facilitando a substitui\u00e7\u00e3o de componentes individuais (como o motor de tr\u00e2nsito simulado por um motor de IA real) sem impacto no restante do sistema."));

  s.push(spacer(200));
  s.push(calloutBox(
    "URL de Deploy (Preview)",
    "A aplica\u00e7\u00e3o est\u00e1 em execu\u00e7\u00e3o cont\u00ednua no ambiente de preview. Para testes com localiza\u00e7\u00e3o pr\u00e9-definida (bypassando o prompt de GPS), adicione o par\u00e2metro ?origin=lat,lng \u00e0 URL, por exemplo: ?origin=-23.5613,-46.6565 (Av. Paulista, S\u00e3o Paulo).",
    "DBEAFE", P.primary
  ));

  // 2
  s.push(h1("2. Funcionalidades Implementadas no MVP"));

  s.push(h2("2.1 Mapa Interativo"));
  s.push(body("Renderiza\u00e7\u00e3o de mapa vetorial usando MapLibre GL JS sobre tiles raster escuros da CARTO baseados em OpenStreetMap. O mapa suporta pan, zoom, gestos touch e mouse, escala m\u00e9trica discreta e controles de zoom flutuantes. Sobre o mapa s\u00e3o desenhados: marcador de localiza\u00e7\u00e3o do usu\u00e1rio (com pulso animado em ciano), marcador de destino (pin \u00e2mbar cl\u00e1ssico), at\u00e9 cinco polylines de rotas alternativas com cores distintas por estrat\u00e9gia e marcadores circulares coloridos para cada leitura de tr\u00e2nsito (verde abaixo de 30, \u00e2mbar abaixo de 55, laranja abaixo de 75, vermelho acima disso)."));

  s.push(h2("2.2 Geolocaliza\u00e7\u00e3o (GPS)"));
  s.push(body("Integra\u00e7\u00e3o com a Geolocation API do navegador via hook React customizado (useGeolocation). O app solicita permiss\u00e3o automaticamente quando o usu\u00e1rio define um destino, exibe indicador de progresso (Passo 1, 2 e confirma\u00e7\u00e3o) e oferece fallback de \"Usar o centro do mapa como partida\" para usu\u00e1rios que negam permiss\u00e3o ou est\u00e3o em dispositivos sem GPS. O watchPosition mant\u00e9m a localiza\u00e7\u00e3o atualizada continuamente com alta precis\u00e3o."));

  s.push(h2("2.3 Busca de Destino"));
  s.push(body("Busca de endere\u00e7os via API Nominatim do OpenStreetMap com debounce de 350ms para evitar requisi\u00e7\u00f5es excessivas durante a digita\u00e7\u00e3o. Os resultados s\u00e3o bias-adjusted para Brasil (countryCodes igual a br) e exibidos em dropdown com label prim\u00e1rio e endere\u00e7o secund\u00e1rio. Suporta tamb\u00e9m long-press no mapa para drop de pin com reverse geocoding autom\u00e1tico (transforma coordenada em endere\u00e7o leg\u00edvel)."));

  s.push(h2("2.4 C\u00e1lculo de Rotas Multi-Estrat\u00e9gia"));
  s.push(body("O backend calcula cinco rotas alternativas entre origem e destino em uma \u00fanica chamada ao OSRM com alternatives igual a true. Cada rota \u00e9 etiquetada com uma estrat\u00e9gia distinta e enriquecida com metadados de tr\u00e2nsito antes de ser devolvida ao frontend. As cinco estrat\u00e9gias implementadas s\u00e3o:"));
  s.push(makeTable(
    ["Estrat\u00e9gia", "Label (PT)", "Descri\u00e7\u00e3o", "Cor no Mapa"],
    [
      ["fastest", "Mais r\u00e1pida", "Minimiza tempo total de viagem", "#06B6D4 (ciano)"],
      ["shortest", "Mais curta", "Minimiza dist\u00e2ncia total", "#10B981 (verde)"],
      ["scenic", "C\u00eanica", "Placeholder, prefere vias mais calmas", "#F59E0B (\u00e2mbar)"],
      ["least_turns", "Menos curvas", "Minimiza manobras e cruzamentos", "#A855F7 (roxo)"],
      ["experimental", "IA experimental", "Blend com peso em tr\u00e2nsito (slot de IA)", "#EF4444 (vermelho)"],
    ]
  ));

  s.push(h2("2.5 Sistema de Score Composto"));
  s.push(body("Em vez de ordenar rotas apenas por ETA, o TrafficMind calcula um RouteScore que combina quatro dimens\u00f5es com pesos configur\u00e1veis. A f\u00f3rmula \u00e9:"));
  s.push(codeLine("score = ETA \u00d7 etaWeight"));
  s.push(codeLine("      + trafficLevel \u00d7 trafficWeight"));
  s.push(codeLine("      + intersectionCount \u00d7 intersectionPenalty"));
  s.push(codeLine("      + accidents \u00d7 accidentPenalty  (zero no MVP)"));
  s.push(codeLine("      + roadComplexity \u00d7 roadComplexityWeight"));
  s.push(body("Menor score vence. Os pesos padr\u00e3o s\u00e3o: etaWeight igual a 1 (1 segundo igual a 1 ponto), trafficWeight igual a 6, intersectionPenalty igual a 25, roadComplexityWeight igual a 4. Cada estrat\u00e9gia pode sobrescrever pesos (ex: least_turns usa intersectionPenalty igual a 60). O breakdown do score \u00e9 exibido ao usu\u00e1rio em barras proporcionais, tornando o motor de decis\u00e3o transparente e audit\u00e1vel."));

  s.push(h2("2.6 Motor de Tr\u00e2nsito Simulado"));
  s.push(body("O TrafficEngine gera leituras de tr\u00e2nsito deterministicamente para um cat\u00e1logo de doze vias reais de S\u00e3o Paulo (Av. Paulista, Marginal Pinheiros, Marginal Tiet\u00ea, Av. Faria Lima, Av. Rebou\u00e7as, Av. 23 de Maio, Minhoc\u00e3o, R. Augusta, etc.). Para cada via, o motor aplica uma curva bimodal de pico matinal (08h) e vespertino (17h) com amplitude baseada no perfil da via (Marginal Pinheiros pico igual a 90, ruas residenciais dos Jardins pico igual a 30). Adiciona ru\u00eddo sinusoidal determin\u00edstico para parecer vivo sem ser ca\u00f3tico. As leituras s\u00e3o cacheadas por 30 segundos."));

  s.push(h2("2.7 Slot de IA (TrafficPredictor)"));
  s.push(body("Interface TrafficPredictor define o contrato que qualquer modelo de IA futuro deve implementar: predictRoadWeight, predictCongestion e predictETA. O MVP inclui uma implementa\u00e7\u00e3o mock (MockTrafficPredictor) que devolve valores plaus\u00edveis derivados do TrafficEngine. Substituir o mock por um modelo real de Machine Learning (ex: Graph Neural Network treinada em dados hist\u00f3ricos) requer mudan\u00e7a em uma \u00fanica linha no container de inje\u00e7\u00e3o de depend\u00eancia."));

  s.push(h2("2.8 Estat\u00edsticas e Painel de Score"));
  s.push(body("Painel inferior colaps\u00e1vel (bottom sheet) em tr\u00eas estados: recolhido (apenas rota recomendada), meio (lista de alternativas) e expandido (estat\u00edsticas completas e breakdown). Mostra seis m\u00e9tricas por rota: dist\u00e2ncia, ETA, n\u00edvel de tr\u00e2nsito, n\u00famero de cruzamentos, estimativa de combust\u00edvel e complexidade da via. O breakdown do score \u00e9 visualizado em barras horizontais coloridas por componente."));

  s.push(h2("2.9 Interface em Portugu\u00eas com Fluxo Guiado"));
  s.push(body("UI 100% em portugu\u00eas brasileiro com fluxo de tr\u00eas passos guiado por indicador visual num\u00e9rico (1, 2 e confirma\u00e7\u00e3o). Passo 1: \"Para onde vamos?\" com dica de busca. Passo 2: \"De onde voc\u00ea sai?\" com dois bot\u00f5es grandes (\"Usar minha localiza\u00e7\u00e3o atual\" e \"Usar o centro do mapa como partida\"). Passo 3: rotas calculadas com badge de Recomendada. Erros de GPS s\u00e3o traduzidos para mensagens amig\u00e1veis (\"Permiss\u00e3o negada\" em vez de \"User denied Geolocation\")."));

  // 3
  s.push(h1("3. Arquitetura T\u00e9cnica"));

  s.push(h2("3.1 Clean Architecture"));
  s.push(body("O c\u00f3digo segue Clean Architecture com quatro camadas estritamente separadas. A regra de depend\u00eancia \u00e9 unidirecional: as camadas externas dependem das internas, nunca o contr\u00e1rio. Toda l\u00f3gica de neg\u00f3cio vive no dom\u00ednio; controllers e routes s\u00e3o finos e n\u00e3o cont\u00eam regras de neg\u00f3cio."));
  s.push(makeTable(
    ["Camada", "Responsabilidade", "Localiza\u00e7\u00e3o"],
    [
      ["Domain", "Entidades, value objects, interfaces (ports). Zero depend\u00eancias externas.", "src/server/domain/"],
      ["Application", "Casos de uso e servi\u00e7os de dom\u00ednio (RouteScoringService, TrafficEngine, use cases).", "src/server/application/"],
      ["Infrastructure", "Adaptadores concretos: OsrmRoutingEngine, NominatimGeocodingService, MockTrafficPredictor.", "src/server/infrastructure/"],
      ["Presentation", "API routes (Next.js) e componentes React. Sem l\u00f3gica de neg\u00f3cio.", "src/app/api/ e src/components/"],
    ]
  ));

  s.push(h2("3.2 Diagrama de Fluxo de Dados"));
  s.push(codeLine("Usu\u00e1rio (browser)"));
  s.push(codeLine("  |  digita destino"));
  s.push(codeLine("  v"));
  s.push(codeLine("SearchPanel -> useDebouncedGeocode -> /api/geocode"));
  s.push(codeLine("  |  escolhe resultado"));
  s.push(codeLine("  v"));
  s.push(codeLine("NavigationStore (setDestination)"));
  s.push(codeLine("  |  destino setado, sem origem"));
  s.push(codeLine("  v"));
  s.push(codeLine("useGeolocation.request() -> prompt de permiss\u00e3o"));
  s.push(codeLine("  |  origem obtida"));
  s.push(codeLine("  v"));
  s.push(codeLine("useCalculateRoutes -> /api/route"));
  s.push(codeLine("  |  POST"));
  s.push(codeLine("  v"));
  s.push(codeLine("calculateRoutesUseCase -> OsrmRoutingEngine"));
  s.push(codeLine("  |  OSRM API (alternatives=true)"));
  s.push(codeLine("  v"));
  s.push(codeLine("enrich(raw, strategy) -> TrafficRepository.getTrafficForRegion"));
  s.push(codeLine("  |  tr\u00e2nsito simulado"));
  s.push(codeLine("  v"));
  s.push(codeLine("RouteScoringService.score(route) -> Route[]"));
  s.push(codeLine("  |  rank por score"));
  s.push(codeLine("  v"));
  s.push(codeLine("Response -> NavigationStore.setRoutes"));
  s.push(codeLine("  |  re-render"));
  s.push(codeLine("  v"));
  s.push(codeLine("NavigationMap (polylines) + RouteSheet (estat\u00edsticas)"));

  // 4
  s.push(h1("4. Stack Tecnol\u00f3gica"));

  s.push(h2("4.1 Frontend"));
  s.push(makeTable(
    ["Tecnologia", "Vers\u00e3o", "Uso"],
    [
      ["Next.js", "16.1", "Framework React com App Router, API routes serverless"],
      ["React", "19.0", "Biblioteca de UI"],
      ["TypeScript", "5.x", "Tipagem est\u00e1tica em todo o c\u00f3digo"],
      ["Tailwind CSS", "4.x", "Estiliza\u00e7\u00e3o utility-first com tema dark customizado"],
      ["shadcn/ui", "New York", "Componentes acess\u00edveis (Radix UI primitives)"],
      ["MapLibre GL JS", "5.24", "Renderiza\u00e7\u00e3o de mapa vetorial open-source"],
      ["TanStack Query", "5.82", "Cache e sincroniza\u00e7\u00e3o de estado server-side"],
      ["Zustand", "5.0", "Estado de sess\u00e3o do cliente (origem, destino, rotas)"],
      ["Framer Motion", "12.x", "Anima\u00e7\u00f5es sutis de entrada e transi\u00e7\u00e3o"],
      ["Lucide React", "0.525", "\u00cdcones SVG consistentes"],
      ["Sonner", "2.0", "Toast notifications com dedup"],
    ]
  ));

  s.push(h2("4.2 Backend (API Routes Next.js + NestJS de refer\u00eancia)"));
  s.push(makeTable(
    ["Tecnologia", "Vers\u00e3o", "Uso"],
    [
      ["Next.js API Routes", "16", "Endpoints REST serverless (/api/route, /api/geocode, etc.)"],
      ["Zod", "4.0", "Valida\u00e7\u00e3o de schema de request e response"],
      ["Node.js", "20", "Runtime JavaScript (LTS)"],
      ["NestJS (refer\u00eancia)", "10.4", "Implementa\u00e7\u00e3o alternativa para deploy Docker"],
      ["Swagger/OpenAPI", "3.0", "Documenta\u00e7\u00e3o de API em /public/docs/openapi.json"],
    ]
  ));

  s.push(h2("4.3 Infraestrutura e Servi\u00e7os Externos"));
  s.push(makeTable(
    ["Componente", "Tecnologia", "Status no MVP"],
    [
      ["Motor de roteamento", "OSRM (router.project-osrm.org)", "Servi\u00e7o p\u00fablico, substitu\u00edvel por GraphHopper self-hosted"],
      ["Geocoding", "Nominatim (nominatim.openstreetmap.org)", "Servi\u00e7o p\u00fablico, substitu\u00edvel por Mapbox ou Google"],
      ["Tiles de mapa", "CARTO dark basemaps", "Servi\u00e7o gratuito com rate limit"],
      ["Banco de dados", "PostgreSQL 16 + PostGIS 3.4", "Configurado no docker-compose, n\u00e3o usado em runtime no MVP"],
      ["Cache", "Redis 7", "Configurado no docker-compose, n\u00e3o usado em runtime no MVP"],
      ["Containeriza\u00e7\u00e3o", "Docker + Docker Compose", "docker-compose.yml completo com 6 servi\u00e7os"],
    ]
  ));

  s.push(h2("4.4 Endpoints de API"));
  s.push(makeTable(
    ["M\u00e9todo", "Rota", "Descri\u00e7\u00e3o"],
    [
      ["POST", "/api/route", "Calcula e ranqueia 5 rotas alternativas entre origem e destino"],
      ["GET", "/api/geocode?q=", "Busca endere\u00e7os via Nominatim (debounce 350ms no client)"],
      ["GET", "/api/reverse-geocode?lat=&lng=", "Reverse geocoding de coordenada para label"],
      ["GET", "/api/traffic?south=&west=&north=&east=", "Leituras de tr\u00e2nsito simulado para a regi\u00e3o vis\u00edvel"],
      ["GET", "/api/health", "Probe de liveness e readiness para docker"],
      ["GET", "/docs/openapi.json", "Spec OpenAPI 3.0 completa"],
    ]
  ));

  // 5
  s.push(h1("5. Dificuldades Encontradas Durante o Desenvolvimento"));

  s.push(body("Esta se\u00e7\u00e3o documenta os problemas reais enfrentados durante o desenvolvimento do MVP, com transpar\u00eancia sobre causa raiz e corre\u00e7\u00e3o aplicada. Estes pontos s\u00e3o importantes para o cliente entender a complexidade real do produto e para o time t\u00e9cnico evitar regress\u00f5es futuras."));

  s.push(h2("5.1 Bug do containerRef N\u00e3o Atribu\u00eddo"));
  s.push(body("Sintoma: usu\u00e1rio clicava em um endere\u00e7o no dropdown de busca e o destino n\u00e3o era setado \u2014 o dropdown fechava mas nada acontecia. Causa raiz: o containerRef foi declarado no componente SearchPanel mas nunca atribu\u00eddo a nenhuma div no JSX. O handler de outside-click verificava containerRef.current cont\u00e9m e.target, que sempre retornava undefined (falsy) porque o ref era null, fazendo o handler tratar qualquer clique como \"fora\" e fechar o dropdown antes do onClick do bot\u00e3o disparar. Corre\u00e7\u00e3o: adicionar ref igual a containerRef na div externa. Esse bug passou pela primeira rodada de QA porque .click() program\u00e1tico (usado nos testes) n\u00e3o dispara mousedown, ent\u00e3o o handler n\u00e3o atrapalhava."));

  s.push(h2("5.2 Bug do Mapa \"Do Mundo Inteiro\""));
  s.push(body("Sintoma: ao calcular uma rota longa (ex: Av. Paulista para Aeroporto de Guarulhos, aproximadamente 30km), o mapa afastava o zoom para mostrar origem e destino simultaneamente, dando a impress\u00e3o de \"mapa do mundo inteiro\". Causa raiz: a chamada map.fitBounds com padding sim\u00e9trico de 100px e maxZoom 15 em rotas longas resultava em zoom muito baixo. Corre\u00e7\u00e3o: padding assim\u00e9trico (top 180, bottom 280, left 60, right 60) com maxZoom 14, garantindo que o painel inferior n\u00e3o sobreponha a rota e o zoom n\u00e3o afaste demais."));

  s.push(h2("5.3 Rate Limiting do OSRM P\u00fablico"));
  s.push(body("Sintoma: a primeira requisi\u00e7\u00e3o POST /api/route \u00e0s vezes retornava zero rotas, e as subsequentes funcionavam. Causa raiz: o servidor p\u00fablico OSRM imp\u00f5e rate limit por IP e ocasionalmente responde com code Ok mas routes vazio quando sobrecarregado. Corre\u00e7\u00e3o: adicionado retry interno com backoff de 200ms na primeira falha, garantindo que falhas transientes n\u00e3o cheguem ao usu\u00e1rio."));

  s.push(h2("5.4 Estados Vazios N\u00e3o-Contextuais"));
  s.push(body("Sintoma: usu\u00e1rio selecionava destino mas a tela mostrava \"No routes yet\" sem explicar que faltava definir a origem (GPS). Causa raiz: o RouteSheet tinha apenas um estado vazio gen\u00e9rico. Corre\u00e7\u00e3o: tr\u00eas estados vazios contextuais \u2014 sem destino (\"Para onde vamos?\"), com destino mas sem origem (\"De onde voc\u00ea sai?\" com CTAs), e calculando (\"Calculando suas rotas...\"). Adicionado tamb\u00e9m auto-request de GPS quando o destino \u00e9 setado."));

  s.push(h2("5.5 Toasts Duplicados de Erro de GPS"));
  s.push(body("Sintoma: quando o usu\u00e1rio negava permiss\u00e3o de GPS, apareciam 8 toasts id\u00eanticos de erro empilhados. Causa raiz: o useEffect que escutava geo.error tinha geo (objeto inteiro) como depend\u00eancia, e como o objeto mudava de identidade a cada render, o effect disparava repetidamente. Corre\u00e7\u00e3o: usar id est\u00e1vel no toast.error (id geo-error) para que o Sonner substitua em vez de empilhar, e depender apenas de geo.error (string primitiva)."));

  s.push(h2("5.6 Jarg\u00e3o T\u00e9cnico Acess\u00edvel a Leigos"));
  s.push(body("Sintoma: usu\u00e1rio n\u00e3o-t\u00e9cnico relatou dificuldade de uso \u2014 a UI estava em ingl\u00eas com termos como \"long-press\", \"crosshair\", \"GPS\", \"map center\". Corre\u00e7\u00e3o: tradu\u00e7\u00e3o completa para portugu\u00eas brasileiro, remo\u00e7\u00e3o de jarg\u00e3o (\"long-press\" virou \"arraste o mapa\", \"crosshair\" virou \"Minha localiza\u00e7\u00e3o\"), bot\u00f5es grandes com texto (n\u00e3o s\u00f3 \u00edcone), fluxo guiado de 3 passos com indicador visual, dicas contextuais (\"Dica: arraste o mapa para posicionar...\")."));

  // 6
  s.push(h1("6. Custos de Opera\u00e7\u00e3o"));

  s.push(h2("6.1 Custos Atuais (MVP em preview)"));
  s.push(body("O MVP roda atualmente em ambiente de preview sem custo direto de infraestrutura. Os servi\u00e7os externos consumidos s\u00e3o todos gratuitos com rate limits generosos para tr\u00e1fego baixo:"));
  s.push(makeTable(
    ["Servi\u00e7o", "Custo Mensal", "Limite"],
    [
      ["OSRM p\u00fablico (router.project-osrm.org)", "R$ 0", "Aproximadamente 1 req/s por IP"],
      ["Nominatim p\u00fablico", "R$ 0", "1 req/s (policy estrita)"],
      ["CARTO dark tiles", "R$ 0", "Rate limit n\u00e3o documentado"],
      ["Hospedagem preview (Vercel-like)", "R$ 0", "Inclu\u00eddo no ambiente"],
      ["Total MVP", "R$ 0 por m\u00eas", "Suficiente para demo e POC"],
    ]
  ));

  s.push(h2("6.2 Custos Estimados para Produ\u00e7\u00e3o"));
  s.push(body("Para um deploy de produ\u00e7\u00e3o com usu\u00e1rios reais, os custos mudam significativamente. As estimativas abaixo consideram tr\u00e1fego moderado (aproximadamente 1.000 usu\u00e1rios ativos por dia, 10.000 requisi\u00e7\u00f5es de rota por dia):"));
  s.push(makeTable(
    ["Item", "Custo Mensal Estimado", "Observa\u00e7\u00e3o"],
    [
      ["VPS (backend + frontend, 4 vCPU, 8GB RAM)", "R$ 200 a 400", "DigitalOcean, Hetzner ou AWS Lightsail"],
      ["OSRM self-hosted (com OSM Brasil)", "R$ 0 (inclu\u00eddo no VPS)", "Requer aproximadamente 10GB RAM para S\u00e3o Paulo"],
      ["PostgreSQL + PostGIS", "R$ 0 (inclu\u00eddo no VPS)", "Volume persistente aproximadamente 20GB"],
      ["Redis", "R$ 0 (inclu\u00eddo no VPS)", "Cache de rotas e tr\u00e2nsito"],
      ["Tr\u00e2nsito real (TomTom ou Here API)", "R$ 2.000 a 8.000", "Opcional, sem isso continua simula\u00e7\u00e3o"],
      ["Tiles de mapa (Mapbox ou CARTO paid)", "R$ 100 a 500", "Opcional, free tier pode bastar"],
      ["Dom\u00ednio + SSL", "R$ 15", "Certbot Let's Encrypt gr\u00e1tis"],
      ["Total produ\u00e7\u00e3o (sem tr\u00e2nsito real)", "R$ 215 a 415 por m\u00eas", "Custo m\u00ednimo vi\u00e1vel"],
      ["Total produ\u00e7\u00e3o (com tr\u00e2nsito real)", "R$ 2.215 a 8.415 por m\u00eas", "Custo com dados profissionais"],
    ]
  ));

  s.push(spacer(200));
  s.push(calloutBox(
    "Aten\u00e7\u00e3o sobre Custo de Tr\u00e2nsito Real",
    "O maior custo recorrente de um app de navega\u00e7\u00e3o \u00e9 o feed de tr\u00e2nsito em tempo real. Sem isso, o app usa simula\u00e7\u00e3o (como o MVP atual). Com tr\u00e2nsito real, o custo mensal salta de centenas para milhares de reais. Esta decis\u00e3o deve ser alinhada com o cliente antes de fechar escopo.",
    "FEE2E2", "DC2626"
  ));

  // 7
  s.push(h1("7. An\u00e1lise de Valor de Mercado"));

  s.push(body("Esta se\u00e7\u00e3o estima o valor de mercado de um sistema no est\u00e1gio atual do TrafficMind, considerando desenvolvimento por um engenheiro s\u00eanior assistido por IA (GitHub Copilot, Claude, etc.). Os valores s\u00e3o refer\u00eancias para o mercado brasileiro de desenvolvimento de software sob encomenda em 2026."));

  s.push(h2("7.1 C\u00e1lculo por Horas de Desenvolvimento"));
  s.push(body("O MVP atual representa aproximadamente 45 a 55 horas de trabalho efetivo de um engenheiro s\u00eanior com assist\u00eancia de IA. Considerando o rate hora de um s\u00eanior no Brasil (R$ 150 a 250 por hora CLT equivalente, ou R$ 300 a 500 por hora como freelancer ou consultor), o custo de reprodu\u00e7\u00e3o do MVP seria:"));
  s.push(makeTable(
    ["Item", "Horas", "Rate S\u00eanior+IA (R$/h)", "Subtotal"],
    [
      ["Arquitetura + setup", "5h", "R$ 300", "R$ 1.500"],
      ["Domain + Application layer", "8h", "R$ 300", "R$ 2.400"],
      ["Infrastructure (OSRM, Nominatim, Traffic Engine)", "10h", "R$ 300", "R$ 3.000"],
      ["API routes + valida\u00e7\u00e3o Zod + OpenAPI", "5h", "R$ 300", "R$ 1.500"],
      ["Frontend: mapa MapLibre + tema dark", "8h", "R$ 300", "R$ 2.400"],
      ["Frontend: bottom sheet + stats + UX flow", "8h", "R$ 300", "R$ 2.400"],
      ["Docker compose + Dockerfiles + NestJS ref", "4h", "R$ 300", "R$ 1.200"],
      ["QA, debugging, ajustes de UX", "6h", "R$ 300", "R$ 1.800"],
      ["Documenta\u00e7\u00e3o + README", "2h", "R$ 300", "R$ 600"],
      ["TOTAL MVP ATUAL", "Aprox. 56h", "\u2014", "R$ 16.800"],
    ]
  ));

  s.push(h2("7.2 Compara\u00e7\u00e3o com Cen\u00e1rios de Evolu\u00e7\u00e3o"));
  s.push(body("O valor abaixo representa o custo de reprodu\u00e7\u00e3o do produto em diferentes est\u00e1gios de maturidade, sempre considerando desenvolvimento s\u00eanior + IA:"));
  s.push(makeTable(
    ["Est\u00e1gio", "Horas", "Valor (S\u00eanior+IA)", "Prazo"],
    [
      ["MVP atual (este documento)", "Aprox. 56h", "R$ 15.000 a 18.000", "2 a 3 semanas"],
      ["MVP + backend NestJS + Postgres", "Aprox. 85h", "R$ 25.000 a 30.000", "4 a 5 semanas"],
      ["MVP + tr\u00e2nsito real + deploy produ\u00e7\u00e3o", "Aprox. 100h", "R$ 30.000 a 35.000", "5 a 6 semanas"],
      ["Produto vend\u00e1vel (+ auth + favoritos + PWA)", "Aprox. 150h", "R$ 45.000 a 55.000", "8 a 10 semanas"],
      ["Produto com IA preditiva b\u00e1sica", "Aprox. 230h", "R$ 70.000 a 85.000", "12 a 16 semanas"],
      ["Concorrente de Waze (escala completa)", "Mais de 1000h", "R$ 300.000+", "Mais de 6 meses"],
    ]
  ));

  s.push(h2("7.3 Avalia\u00e7\u00e3o para Cen\u00e1rio de R$ 22.000"));
  s.push(body("Considerando o or\u00e7amento de R$ 22.000 mencionado, a an\u00e1lise de viabilidade \u00e9:"));
  s.push(makeTable(
    ["Cen\u00e1rio", "Vi\u00e1vel?", "Justificativa"],
    [
      ["Reproduzir o MVP atual", "SIM", "Custo de reprodu\u00e7\u00e3o aprox. R$ 16.800, dentro do or\u00e7amento"],
      ["MVP + backend NestJS rodando", "SIM (justo)", "R$ 25 a 30k, requer negocia\u00e7\u00e3o de escopo"],
      ["MVP + tr\u00e2nsito real + deploy", "MARGINAL", "R$ 30 a 35k, exige reduzir escopo em outro lugar"],
      ["Produto vend\u00e1vel completo", "N\u00c3O", "R$ 45 a 55k, or\u00e7amento insuficiente"],
      ["Produto com IA preditiva", "N\u00c3O", "R$ 70 a 85k, fora do or\u00e7amento"],
    ]
  ));

  s.push(spacer(200));
  s.push(calloutBox(
    "Recomenda\u00e7\u00e3o Comercial",
    "Para R$ 22.000, o escopo honesto e entreg\u00e1vel \u00e9: MVP atual (j\u00e1 desenvolvido) + backend NestJS rodando com persist\u00eancia + deploy em VPS + documenta\u00e7\u00e3o de handover. N\u00c3O incluir IA real (manter slot de IA como diferencial arquitetural), N\u00c3O incluir tr\u00e2nsito real (manter simula\u00e7\u00e3o), N\u00c3O incluir app nativo. Entrega em 4 a 5 semanas. Payment milestone sugerido: 40% upfront, 30% na entrega do backend, 30% no deploy + handover.",
    "D1FAE5", "059669"
  ));

  // 8
  s.push(h1("8. Roadmap e Pr\u00f3ximos Passos"));

  s.push(h2("8.1 Roadmap de Curto Prazo (4 a 6 semanas)"));
  s.push(bullet("Substituir API routes do Next.js pelo backend NestJS rodando em Docker"));
  s.push(bullet("Configurar PostgreSQL + PostGIS para persist\u00eancia de rotas calculadas e hist\u00f3rico"));
  s.push(bullet("Integrar Redis para cache de respostas de rota (TTL 5 min por par origem-destino)"));
  s.push(bullet("Self-host OSRM com extract de S\u00e3o Paulo (sudeste-latest.osm.pbf)"));
  s.push(bullet("Deploy em VPS (DigitalOcean ou Hetzner) com docker compose up"));
  s.push(bullet("Documenta\u00e7\u00e3o de handover + runbook de opera\u00e7\u00e3o"));

  s.push(h2("8.2 Roadmap de M\u00e9dio Prazo (8 a 12 semanas)"));
  s.push(bullet("Sistema de autentica\u00e7\u00e3o (NextAuth.js) com login social (Google ou Apple)"));
  s.push(bullet("Favoritos de destinos e hist\u00f3rico de rotas por usu\u00e1rio"));
  s.push(bullet("PWA com service worker para uso offline b\u00e1sico"));
  s.push(bullet("Integra\u00e7\u00e3o de tr\u00e2nsito real via API (TomTom ou Here, custo a validar)"));
  s.push(bullet("Detec\u00e7\u00e3o de fechamento de vias e acidentes (slot j\u00e1 preparado no scorer)"));
  s.push(bullet("Painel administrativo para gest\u00e3o de vias monitoradas"));

  s.push(h2("8.3 Roadmap de Longo Prazo (3 a 6 meses)"));
  s.push(bullet("Modelo de IA preditiva de tr\u00e2nsito (regress\u00e3o sobre dados hist\u00f3ricos coletados)"));
  s.push(bullet("Crowdsourcing real de tr\u00e2nsito (usu\u00e1rios reportam via app)"));
  s.push(bullet("Apps nativos iOS e Android via Capacitor ou React Native"));
  s.push(bullet("Otimiza\u00e7\u00e3o para ve\u00edculos el\u00e9tricos (slot j\u00e1 preparado no scorer)"));
  s.push(bullet("Integra\u00e7\u00e3o com smart cities (sem\u00e1foros inteligentes, dados abertos)"));
  s.push(bullet("Score de seguran\u00e7a vi\u00e1ria (slot j\u00e1 preparado no scorer)"));

  // 9
  s.push(h1("9. Conclus\u00e3o e Recomenda\u00e7\u00e3o Final"));

  s.push(body("O TrafficMind em seu estado atual de MVP \u00e9 um produto t\u00e9cnico vi\u00e1vel e funcional. Ele demonstra end-to-end o fluxo de navega\u00e7\u00e3o inteligente com c\u00e1lculo de rotas multi-crit\u00e9rio, ranking por score transparente e interface mobile-first em portugu\u00eas. A arquitetura Clean Architecture com slot de IA preparado \u00e9 o maior diferencial t\u00e9cnico \u2014 permite evolu\u00e7\u00e3o incremental sem reescrita."));

  s.push(body("Para o cen\u00e1rio de R$ 22.000, a recomenda\u00e7\u00e3o \u00e9 fechar escopo honesto: entregar o MVP atual mais backend NestJS rodando e deploy em VPS. Isso custa aproximadamente R$ 16.800 para reproduzir (j\u00e1 desenvolvido), deixando margem para as 25 a 30 horas adicionais de backend + deploy dentro do or\u00e7amento. N\u00e3o prometer IA real, tr\u00e2nsito real ou app nativo \u2014 esses s\u00e3o incrementos que extrapolam o or\u00e7amento e exigiriam recontrata\u00e7\u00e3o."));

  s.push(body("O maior risco comercial \u00e9 o cliente ter expectativas de \"um Waze mais inteligente\" sem escopo definido. Recomenda-se alinhar por escrito o que est\u00e1 inclu\u00eddo e o que n\u00e3o est\u00e1, com demo do MVP atual como prova de conceito. O indicador visual de progresso (Passo 1, 2 e confirma\u00e7\u00e3o), o painel de score com breakdown transparente e a UI em portugu\u00eas s\u00e3o os pontos de venda mais fortes para um cliente n\u00e3o-t\u00e9cnico."));

  s.push(body("Para o time t\u00e9cnico, os pontos de aten\u00e7\u00e3o s\u00e3o: o OSRM p\u00fablico n\u00e3o sustenta produ\u00e7\u00e3o (precisa self-host), o tr\u00e2nsito simulado \u00e9 apenas demonstra\u00e7\u00e3o (precisa de feed real para produto vend\u00e1vel), e a UI atual \u00e9 web-only (precisa de wrapper Capacitor para lojas de apps). Esses tr\u00eas itens s\u00e3o os pr\u00f3ximos passos naturais ap\u00f3s o fechamento do escopo de R$ 22.000."));

  return s;
}

// ============================================================================
// MONTAGEM DO DOCUMENTO
// ============================================================================

const doc = new Document({
  creator: "TrafficMind",
  title: "Documenta\u00e7\u00e3o do MVP \u2014 TrafficMind",
  description: "Documento t\u00e9cnico do MVP do TrafficMind, aplicativo de navega\u00e7\u00e3o inteligente.",
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 22,
          color: c(P.bodyText),
        },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: "TrafficMind \u2014 Documenta\u00e7\u00e3o do MVP",
              size: 16, color: c(P.metaColor), italics: true,
              font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "P\u00e1gina ", size: 18, color: c(P.metaColor) }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.metaColor) }),
              new TextRun({ text: " de ", size: 18, color: c(P.metaColor) }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: c(P.metaColor) }),
            ],
          })],
        }),
      },
      children: buildBody(),
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const outPath = "/home/z/my-project/download/TrafficMind-Documentacao-MVP.docx";
  fs.writeFileSync(outPath, buf);
  console.log("\u2705 Documento gerado:", outPath);
  console.log("   Tamanho:", (buf.length / 1024).toFixed(1), "KB");
}).catch((err) => {
  console.error("\u274c Erro:", err);
  process.exit(1);
});
