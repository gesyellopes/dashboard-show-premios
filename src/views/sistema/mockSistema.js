/* ------------------------------------------------------------------ */
/* MOCK – dados simulados do painel do sistema (substituir pela API)   */
/* Cada bloco abaixo corresponde a um futuro endpoint do admin.        */
/* ------------------------------------------------------------------ */

export const STORAGE_CAPACITY_GB = 50;

// Clientes (paróquias / entidades) que usam o Show de Prêmios
export const CLIENTS = [
  {
    id: 1,
    name: "Paróquia São Sebastião",
    city: "Pirapora - MG",
    status: "active",
    tickets: 4200,
    processed: 3610,
    storageGb: 3.8,
    vendors: 18,
    drawDate: "2026-11-22T19:00:00",
  },
  {
    id: 2,
    name: "Paróquia Nossa Senhora Conceição",
    city: "Buritizeiro - MG",
    status: "active",
    tickets: 2600,
    processed: 1980,
    storageGb: 2.1,
    vendors: 11,
    drawDate: "2026-12-13T19:30:00",
  },
  {
    id: 3,
    name: "Rodeio dos Amigos",
    city: "Pirapora - MG",
    status: "active",
    tickets: 5000,
    processed: 4420,
    storageGb: 5.6,
    vendors: 24,
    drawDate: "2026-11-08T20:00:00",
  },
  {
    id: 4,
    name: "Paróquia Sagrado Coração de Jesus",
    city: "Pirapora - MG",
    status: "pending",
    tickets: 3100,
    processed: 2050,
    storageGb: 2.7,
    vendors: 14,
    drawDate: "2027-01-17T19:00:00",
  },
  {
    id: 5,
    name: "Paróquia Nossa Senhora Conceição",
    city: "Várzea da Palma - MG",
    status: "active",
    tickets: 1800,
    processed: 1510,
    storageGb: 1.4,
    vendors: 9,
    drawDate: "2026-12-05T19:00:00",
  },
];

// Serviços de infraestrutura
export const SERVICES = [
  {
    id: "worker-canhotos",
    name: "Worker Canhotos",
    description: "Processa e espelha as imagens dos canhotos",
    status: "online",
    uptime: 99.92,
    latencyMs: 142,
    queue: 12,
    lastSeenSec: 18,
  },
  {
    id: "api-leitura-canhotos",
    name: "API Leitura Canhotos",
    description: "Leitura e validação dos canhotos enviados",
    status: "degraded",
    uptime: 98.4,
    latencyMs: 940,
    queue: 0,
    lastSeenSec: 6,
  },
];

// Instâncias de WhatsApp (Evolution | W-API)
export const WHATSAPP_INSTANCES = [
  {
    id: 1,
    number: "+55 38 99871-2045",
    provider: "Evolution",
    status: "connected",
    client: "Paróquia São Sebastião",
    messages24h: 412,
  },
  {
    id: 2,
    number: "+55 38 99722-1190",
    provider: "W-API",
    status: "connected",
    client: "Rodeio dos Amigos",
    messages24h: 287,
  },
  {
    id: 3,
    number: "+55 38 99650-7733",
    provider: "Evolution",
    status: "disconnected",
    client: "Paróquia Sagrado Coração de Jesus",
    messages24h: 0,
  },
  {
    id: 4,
    number: "+55 38 98815-4402",
    provider: "W-API",
    status: "connecting",
    client: "Paróquia NSª Conceição (Buritizeiro)",
    messages24h: 64,
  },
];

// Série diária dos últimos 14 dias (valores fixos para o gráfico não "pular")
export const DAILY_SERIES = {
  received: [700, 820, 950, 600, 1050, 1200, 840, 900, 980, 1100, 1020, 1260, 930, 1010],
  processed: [620, 710, 880, 540, 990, 1120, 760, 830, 900, 1040, 980, 1210, 870, 940],
};

// Eventos recentes do sistema
export const ACTIVITY = [
  {
    id: 1,
    time: "há 3 min",
    type: "validation",
    text: "Lote de 48 cartelas validado — Rodeio dos Amigos",
  },
  {
    id: 2,
    time: "há 17 min",
    type: "instance",
    text: "Instância +55 38 99650-7733 desconectou — Sagrado Coração de Jesus",
  },
  {
    id: 3,
    time: "há 42 min",
    type: "service",
    text: "API Leitura Canhotos com latência acima de 900 ms",
  },
  {
    id: 4,
    time: "há 1 h",
    type: "client",
    text: "Novo vendedor cadastrado — Paróquia São Sebastião",
  },
  {
    id: 5,
    time: "há 2 h",
    type: "storage",
    text: "Upload de 200 canhotos — Paróquia NSª Conceição (Várzea da Palma)",
  },
  {
    id: 6,
    time: "há 5 h",
    type: "validation",
    text: "Lote de 120 cartelas validado — Paróquia NSª Conceição (Buritizeiro)",
  },
];
