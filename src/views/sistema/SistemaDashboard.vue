<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import {
  ACTIVITY,
  CLIENTS,
  DAILY_SERIES,
  SERVICES,
  STORAGE_CAPACITY_GB,
  WHATSAPP_INSTANCES,
} from "./mockSistema";

const TICKET_VALUE = Number(process.env.VUE_APP_TICKET_VALUE) || 0;

/* ------------------------------------------------------------------ */
/* Paleta (mesma do Dashboard de Eventos)                              */
/* ------------------------------------------------------------------ */
const COLORS = {
  blue: "#3987e5",
  blueDeep: "#184f95",
  orange: "#eb6834",
  aqua: "#1baf7a",
  surface: "#111c44",
  neutral: "#2a3a6b",
  textSecondary: "#9aa6c4",
  grid: "rgba(255, 255, 255, 0.08)",
  tick: "#c3cbe0",
  series: ["#3987e5", "#eb6834", "#1baf7a", "#8b7cf6", "#f5b942"],
};

const STATUS_LABEL = {
  client: { active: "Ativo", pending: "Em configuração" },
  service: { online: "Operacional", degraded: "Degradado", offline: "Fora do ar" },
  instance: { connected: "Conectada", connecting: "Conectando", disconnected: "Desconectada" },
};

const STATUS_CLASS = {
  ok: "badge-ok",
  warn: "badge-warn",
  bad: "badge-bad",
};

const SERVICE_CLASS = { online: "ok", degraded: "warn", offline: "bad" };
const INSTANCE_CLASS = { connected: "ok", connecting: "warn", disconnected: "bad" };
const CLIENT_CLASS = { active: "ok", pending: "warn" };

const ACTIVITY_ICON = {
  validation: "fas fa-check-circle",
  instance: "fab fa-whatsapp",
  service: "fas fa-server",
  client: "fas fa-user-plus",
  storage: "fas fa-hdd",
};

const ACTIVITY_CLASS = {
  validation: "kpi-aqua",
  instance: "kpi-green",
  service: "kpi-orange",
  client: "kpi-blue",
  storage: "kpi-blue",
};

/* ------------------------------------------------------------------ */
/* Helpers de formatação                                               */
/* ------------------------------------------------------------------ */
const nf0 = new Intl.NumberFormat("pt-BR");
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatNumber = (value) => nf0.format(value ?? 0);
const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
const formatPercent = (value) => `${nf1.format(value ?? 0)}%`;
const formatGb = (value) => `${nf1.format(value ?? 0)} GB`;
const formatDate = (iso) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));

const pct = (part, total) => (total ? (part / total) * 100 : 0);
const sumBy = (list, fn) => list.reduce((acc, item) => acc + fn(item), 0);

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */
const now = ref(Date.now());
let refreshTimer;

/* ------------------------------------------------------------------ */
/* Ações de serviço                                                    */
/* ------------------------------------------------------------------ */
const restartingId = ref(null);

const confirmRestart = async (service) => {
  const result = await Swal.fire({
    icon: "warning",
    title: "Reiniciar serviço?",
    html: `Esta é uma <b>ação importante</b>. O container de <b>${service.name}</b> será reiniciado e o processamento ficará indisponível por alguns instantes.`,
    showCancelButton: true,
    confirmButtonText: "Sim, reiniciar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: COLORS.orange,
    cancelButtonColor: "#2a3a6b",
  });

  if (!result.isConfirmed) return;

  restartingId.value = service.id;
  try {
    // TODO: substituir pelo endpoint real quando existir, ex.: api.post(`/system/services/${service.id}/restart`)
    // MOCK – simula o tempo de reinício
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await Swal.fire({
      icon: "success",
      title: "Reinício solicitado",
      text: `${service.name} (simulado) — conecte a API real para reiniciar de fato.`,
    });
  } catch (error) {
    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: "Não foi possível reiniciar o serviço.",
    });
  } finally {
    restartingId.value = null;
  }
};

/* ------------------------------------------------------------------ */
/* Agregados                                                           */
/* ------------------------------------------------------------------ */
const totals = computed(() => {
  const tickets = sumBy(CLIENTS, (c) => c.tickets);
  const processed = sumBy(CLIENTS, (c) => c.processed);
  const storage = sumBy(CLIENTS, (c) => c.storageGb);
  return {
    clients: CLIENTS.length,
    activeClients: CLIENTS.filter((c) => c.status === "active").length,
    tickets,
    processed,
    processedPct: pct(processed, tickets),
    pending: tickets - processed,
    storage,
    storagePct: pct(storage, STORAGE_CAPACITY_GB),
    storageFree: STORAGE_CAPACITY_GB - storage,
    revenue: processed * TICKET_VALUE,
    vendors: sumBy(CLIENTS, (c) => c.vendors),
  };
});

const instanceTotals = computed(() => ({
  total: WHATSAPP_INSTANCES.length,
  connected: WHATSAPP_INSTANCES.filter((i) => i.status === "connected").length,
  messages24h: sumBy(WHATSAPP_INSTANCES, (i) => i.messages24h),
}));

const serviceTotals = computed(() => ({
  total: SERVICES.length,
  online: SERVICES.filter((s) => s.status === "online").length,
}));

const clientRows = computed(() =>
  [...CLIENTS]
    .map((c) => ({
      ...c,
      processedPct: pct(c.processed, c.tickets),
      storagePct: pct(c.storageGb, STORAGE_CAPACITY_GB),
    }))
    .sort((a, b) => b.processed - a.processed)
);

const upcomingDraws = computed(() =>
  CLIENTS.map((c) => ({
    ...c,
    daysLeft: Math.ceil((new Date(c.drawDate).getTime() - now.value) / 86400000),
  }))
    .filter((c) => c.daysLeft >= 0)
    .sort((a, b) => new Date(a.drawDate) - new Date(b.drawDate))
);

/* ------------------------------------------------------------------ */
/* Gráficos (Chart.js)                                                 */
/* ------------------------------------------------------------------ */
const dailyCanvas = ref(null);
const storageCanvas = ref(null);
let dailyChart;
let storageChart;

const tooltipStyle = {
  backgroundColor: "#0b1437",
  borderColor: "rgba(255, 255, 255, 0.12)",
  borderWidth: 1,
  titleColor: "#f1f4fb",
  bodyColor: "#c3cbe0",
  padding: 10,
  cornerRadius: 8,
};

const buildDaily = () => {
  if (!dailyCanvas.value) return;
  dailyChart?.destroy();

  const labels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  });

  dailyChart = new Chart(dailyCanvas.value, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Recebidos",
          data: DAILY_SERIES.received,
          borderColor: COLORS.orange,
          backgroundColor: "rgba(217, 89, 38, 0.10)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: "Processados",
          data: DAILY_SERIES.processed,
          borderColor: COLORS.blue,
          backgroundColor: "rgba(57, 135, 229, 0.16)",
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: COLORS.blue,
          pointBorderColor: COLORS.surface,
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle,
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: COLORS.tick, font: { size: 12, weight: "500" } },
        },
        y: {
          grid: { color: COLORS.grid },
          border: { display: false },
          ticks: { color: COLORS.tick, font: { size: 12, weight: "500" } },
          beginAtZero: true,
        },
      },
    },
  });
};

const buildStorage = () => {
  if (!storageCanvas.value) return;
  storageChart?.destroy();
  storageChart = new Chart(storageCanvas.value, {
    type: "doughnut",
    data: {
      labels: CLIENTS.map((c) => c.name),
      datasets: [
        {
          data: [...CLIENTS.map((c) => c.storageGb), Math.max(STORAGE_CAPACITY_GB - totals.value.storage, 0)],
          backgroundColor: [...COLORS.series, COLORS.neutral],
          borderWidth: 3,
          borderColor: COLORS.surface,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatGb(ctx.parsed)}`,
          },
        },
      },
    },
  });
};

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */
onMounted(() => {
  refreshTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  buildDaily();
  buildStorage();
});

onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  dailyChart?.destroy();
  storageChart?.destroy();
});
</script>

<template>
  <div class="sys py-4 container-fluid">
    <!-- KPIs -->
    <div class="row g-4 mb-4">
      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-blue"><i class="fas fa-calendar-check"></i></div>
            <p class="kpi-label">Eventos ativos</p>
            <h4 class="kpi-value">
              {{ totals.activeClients }}<small class="kpi-sub kpi-sub-muted">/ {{ totals.clients }}</small>
            </h4>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-orange"><i class="fas fa-ticket-alt"></i></div>
            <p class="kpi-label">Tickets Total</p>
            <h4 class="kpi-value">{{ formatNumber(totals.tickets) }}</h4>
            <small class="kpi-foot">{{ formatNumber(totals.pending) }} aguardando processamento</small>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-aqua"><i class="fas fa-check-circle"></i></div>
            <p class="kpi-label">Tickets Processados</p>
            <h4 class="kpi-value">
              {{ formatNumber(totals.processed) }}<small class="kpi-sub">{{ formatPercent(totals.processedPct) }}</small>
            </h4>
            <div class="progress-track thin mt-2">
              <div class="progress-fill" :style="{ width: totals.processedPct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-green"><i class="fas fa-hdd"></i></div>
            <p class="kpi-label">Storage</p>
            <h4 class="kpi-value">
              {{ formatGb(totals.storage) }}<small class="kpi-sub kpi-sub-muted">/ {{ STORAGE_CAPACITY_GB }} GB</small>
            </h4>
            <div class="progress-track thin mt-2">
              <div class="progress-fill progress-fill-storage" :style="{ width: totals.storagePct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Linha 2: série diária + storage por cliente -->
    <div class="row g-4 mb-4">
      <div class="col-lg-8">
        <div class="card panel h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <div>
                <h6 class="mb-0">Processamento diário</h6>
                <small class="text-secondary">Tickets recebidos x processados — últimos 14 dias</small>
              </div>
              <div class="legend-inline">
                <span><i class="dot" :style="{ background: COLORS.orange }"></i> Recebidos</span>
                <span><i class="dot" :style="{ background: COLORS.blue }"></i> Processados</span>
              </div>
            </div>
            <div class="chart-box">
              <canvas ref="dailyCanvas"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="card panel h-100">
          <div class="card-body d-flex flex-column">
            <h6 class="mb-0">Storage por cliente</h6>
            <small class="text-secondary mb-3">Uso de {{ formatGb(totals.storage) }} de {{ STORAGE_CAPACITY_GB }} GB</small>
            <div class="donut-wrap">
              <canvas ref="storageCanvas"></canvas>
              <div class="donut-center">
                <strong>{{ formatPercent(totals.storagePct) }}</strong>
                <span>utilizado</span>
              </div>
            </div>
            <ul class="legend-list mt-3">
              <li v-for="(c, i) in CLIENTS" :key="c.id">
                <span class="legend-name">
                  <i class="dot" :style="{ background: COLORS.series[i] }"></i>{{ c.name }}
                </span>
                <span class="legend-value">{{ formatGb(c.storageGb) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Linha 3: clientes + próximos sorteios -->
    <div class="row g-4 mb-4">
      <div class="col-lg-8">
        <div class="card panel h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 class="mb-0">Eventos</h6>
                <small class="text-secondary">
                  {{ totals.clients }} cadastrados · {{ formatNumber(totals.vendors) }} vendedores
                </small>
              </div>
              <div class="fw-semibold text-end">
                <div class="money">{{ formatCurrency(totals.revenue) }}</div>
                <small class="text-secondary">arrecadado</small>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table align-middle sys-table mb-0">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Status</th>
                    <th class="text-end">Tickets</th>
                    <th style="min-width: 180px">Processamento</th>
                    <th>Sorteio</th>
                    <th class="text-end">Storage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in clientRows" :key="c.id">
                    <td>
                      <div class="fw-semibold">{{ c.name }}</div>
                      <small class="text-secondary"><i class="fas fa-map-marker-alt me-1"></i>{{ c.city }}</small>
                    </td>
                    <td>
                      <span class="badge-status" :class="STATUS_CLASS[CLIENT_CLASS[c.status]]">
                        {{ STATUS_LABEL.client[c.status] }}
                      </span>
                    </td>
                    <td class="text-end tabular">{{ formatNumber(c.tickets) }}</td>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <div class="progress-track thin flex-grow-1">
                          <div class="progress-fill" :style="{ width: c.processedPct + '%' }"></div>
                        </div>
                        <small class="tabular text-secondary">{{ formatPercent(c.processedPct) }}</small>
                      </div>
                    </td>
                    <td class="tabular text-nowrap">{{ formatDate(c.drawDate) }}</td>
                    <td class="text-end tabular">{{ formatGb(c.storageGb) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="card panel h-100">
          <div class="card-body">
            <h6 class="mb-0">Próximos sorteios</h6>
            <small class="text-secondary">Contagem regressiva por cliente</small>

            <ul class="draw-list mt-3">
              <li v-for="d in upcomingDraws" :key="d.id">
                <div class="draw-days">
                  <strong>{{ d.daysLeft }}</strong>
                  <span>dias</span>
                </div>
                <div class="draw-info">
                  <div class="fw-semibold">{{ d.name }}</div>
                  <small class="text-secondary">{{ d.city }} · {{ formatDate(d.drawDate) }}</small>
                </div>
              </li>
              <li v-if="!upcomingDraws.length" class="text-secondary">Nenhum sorteio agendado.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Linha 4: serviços + instâncias WhatsApp -->
    <div class="row g-4 mb-4">
      <div class="col-lg-5">
        <div class="card panel h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 class="mb-0">Serviços</h6>
                <small class="text-secondary">{{ serviceTotals.online }} de {{ serviceTotals.total }} operacionais</small>
              </div>
            </div>

            <div class="service" v-for="s in SERVICES" :key="s.id">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-semibold">{{ s.name }}</div>
                  <small class="text-secondary">{{ s.description }}</small>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                  <span class="badge-status" :class="STATUS_CLASS[SERVICE_CLASS[s.status]]">
                    {{ STATUS_LABEL.service[s.status] }}
                  </span>
                  <button
                    type="button"
                    class="btn-restart"
                    :disabled="restartingId === s.id"
                    @click="confirmRestart(s)"
                  >
                    <i class="fas fa-rotate-right me-1" :class="{ 'fa-spin': restartingId === s.id }"></i>
                    {{ restartingId === s.id ? "Reiniciando..." : "Reiniciar" }}
                  </button>
                </div>
              </div>
              <div class="service-metrics">
                <div>
                  <small>Uptime</small>
                  <strong class="tabular">{{ formatPercent(s.uptime) }}</strong>
                </div>
                <div>
                  <small>Latência</small>
                  <strong class="tabular" :class="{ 'text-warn': s.latencyMs > 500 }">{{ s.latencyMs }} ms</strong>
                </div>
                <div>
                  <small>Fila</small>
                  <strong class="tabular">{{ s.queue }}</strong>
                </div>
                <div>
                  <small>Último sinal</small>
                  <strong class="tabular">{{ s.lastSeenSec }}s atrás</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="card panel h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 class="mb-0">Instâncias WhatsApp</h6>
                <small class="text-secondary">
                  {{ instanceTotals.connected }} de {{ instanceTotals.total }} conectadas ·
                  {{ formatNumber(instanceTotals.messages24h) }} mensagens nas últimas 24h
                </small>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table align-middle sys-table mb-0">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Serviço</th>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th class="text-end">Msgs 24h</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in WHATSAPP_INSTANCES" :key="i.id">
                    <td class="tabular fw-semibold">{{ i.number }}</td>
                    <td>
                      <span class="provider" :class="i.provider === 'Evolution' ? 'provider-evo' : 'provider-wapi'">
                        {{ i.provider }}
                      </span>
                    </td>
                    <td class="text-secondary small">{{ i.client }}</td>
                    <td>
                      <span class="badge-status" :class="STATUS_CLASS[INSTANCE_CLASS[i.status]]">
                        <i class="dot-status"></i>{{ STATUS_LABEL.instance[i.status] }}
                      </span>
                    </td>
                    <td class="text-end tabular">{{ formatNumber(i.messages24h) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Linha 5: atividade recente -->
    <div class="row g-4 mb-4">
      <div class="col-12">
        <div class="card panel">
          <div class="card-body">
            <h6 class="mb-3">Atividade recente</h6>
            <ul class="activity">
              <li v-for="a in ACTIVITY" :key="a.id">
                <span class="kpi-icon activity-icon" :class="ACTIVITY_CLASS[a.type]">
                  <i :class="ACTIVITY_ICON[a.type]"></i>
                </span>
                <span class="activity-text">{{ a.text }}</span>
                <small class="activity-time">{{ a.time }}</small>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sys {
  --text-primary: #f1f4fb;
  --text-secondary: #9aa6c4;
  --surface: #111c44;
  --surface-alt: #0b1437;
  --line: rgba(255, 255, 255, 0.08);
  --blue: #3987e5;
  --orange: #eb6834;
  --aqua: #1baf7a;
  --green: #0ca30c;
  color: var(--text-primary);
}

.card {
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  color: var(--text-primary);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.card h6 {
  color: var(--text-primary);
  font-weight: 700;
}
.text-secondary {
  color: var(--text-secondary) !important;
}

/* KPIs */
.kpi .card-body {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 14px;
  align-items: center;
  padding: 14px 16px;
}
.kpi-icon {
  grid-row: 1 / span 3;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 1rem;
  flex-shrink: 0;
}
.kpi-blue { background: var(--blue); }
.kpi-orange { background: var(--orange); }
.kpi-aqua { background: var(--aqua); }
.kpi-green { background: var(--green); }
.kpi-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 4px;
}
.kpi-value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin: 0;
}
.kpi-sub {
  font-size: 0.9rem;
  color: var(--aqua);
  font-weight: 600;
  margin-left: 6px;
}
.kpi-sub-muted {
  color: var(--text-secondary);
}
.kpi-foot {
  color: var(--text-secondary);
  font-size: 0.78rem;
}

/* Progress */
.progress-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.progress-track.thin {
  height: 6px;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1baf7a, #2a78d6);
  transition: width 0.6s ease;
}
.progress-fill-storage {
  background: linear-gradient(90deg, #3987e5, #eb6834);
}

/* Charts */
.chart-box {
  position: relative;
  height: 300px;
}
.donut-wrap {
  position: relative;
  height: 220px;
}
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.donut-center strong {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}
.donut-center span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.legend-inline {
  display: flex;
  gap: 14px;
  font-size: 0.85rem;
  font-weight: 600;
}
.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
}
.legend-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--line);
}
.legend-list li:last-child {
  border-bottom: 0;
}
.legend-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.legend-value {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  white-space: nowrap;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}

/* Tabelas */
.sys-table {
  --bs-table-color: var(--text-primary);
  --bs-table-border-color: var(--line);
  --bs-table-hover-color: var(--text-primary);
  --bs-table-hover-bg: rgba(255, 255, 255, 0.03);
  font-size: 0.9rem;
  color: var(--text-primary);
}
.sys-table th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-weight: 700;
  border-bottom-width: 1px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
.money {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
  color: var(--aqua);
}

/* Badges de status */
.badge-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.badge-ok { background: rgba(27, 175, 122, 0.18); color: #5ee0a8; }
.badge-warn { background: rgba(235, 104, 52, 0.18); color: #ffa67f; }
.badge-bad { background: rgba(248, 113, 113, 0.16); color: #fca5a5; }
.dot-status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}

.provider {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
}
.provider-evo { background: #199e70; }
.provider-wapi { background: #3987e5; }

/* Próximos sorteios */
.draw-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.draw-list li {
  display: flex;
  align-items: center;
  gap: 12px;
}
.draw-days {
  min-width: 62px;
  text-align: center;
  padding: 6px 4px;
  border-radius: 12px;
  background: rgba(57, 135, 229, 0.18);
  color: #7fb4f5;
  line-height: 1;
}
.draw-days strong {
  display: block;
  font-size: 1.3rem;
  font-variant-numeric: tabular-nums;
}
.draw-days span {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.draw-info {
  min-width: 0;
  font-size: 0.9rem;
}

/* Serviços */
.service {
  padding: 14px;
  border-radius: 12px;
  background: var(--surface-alt);
  border: 1px solid var(--line);
  margin-bottom: 12px;
}
.service:last-child {
  margin-bottom: 0;
}
.btn-restart {
  padding: 4px 10px;
  border: 1px solid rgba(235, 104, 52, 0.5);
  border-radius: 8px;
  background: rgba(235, 104, 52, 0.12);
  color: #ffa67f;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.btn-restart:hover:not(:disabled) {
  background: #eb6834;
  color: #fff;
}
.btn-restart:disabled {
  opacity: 0.6;
  cursor: wait;
}
.service-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.service-metrics small {
  display: block;
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.service-metrics strong {
  font-size: 0.95rem;
}
.text-warn {
  color: #ffa67f;
}

/* Atividade */
.activity {
  list-style: none;
  margin: 0;
  padding: 0;
}
.activity li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--line);
}
.activity li:last-child {
  border-bottom: 0;
}
.activity-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 0.85rem;
  grid-row: auto;
}
.activity-text {
  flex: 1;
  font-size: 0.92rem;
}
.activity-time {
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (max-width: 576px) {
  .service-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
