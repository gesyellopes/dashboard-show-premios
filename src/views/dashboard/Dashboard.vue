<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import api from "@/services/api";

const TICKET_VALUE = Number(process.env.VUE_APP_TICKET_VALUE);

/* ------------------------------------------------------------------ */
/* MOCK – dados simulados para o dashboard (substituir pela API)       */
/* ------------------------------------------------------------------ */
const SORTEIO = {
  label: "Show de Prêmios Paróquia NSª da Conceição - Várzea da Palma",
  // 6/12/2026 lido como 6 de dezembro de 2026 (formato pt-BR)
  date: new Date(2026, 11, 5, 19, 0, 0),
};

/* ------------------------------------------------------------------ */
/* Paleta (data-viz): blue / orange / aqua / neutros                   */
/* ------------------------------------------------------------------ */
const COLORS = {
  blue: "#3987e5",
  blueDeep: "#184f95",
  orange: "#d95926",
  aqua: "#199e70",
  surface: "#111c44",
  textPrimary: "#f1f4fb",
  textSecondary: "#9aa6c4",
  grid: "rgba(255, 255, 255, 0.16)",
  tick: "#c3cbe0",
  neutral: "#2a3a6b",
};

/* ------------------------------------------------------------------ */
/* Estado                                                             */
/* ------------------------------------------------------------------ */
const sales = ref([]);
const validationReport = ref([]);
const kpisLoading = ref(true);
const kpis = ref({
  total_vendors: 0,
  total_tickets: 0,
  total_validated_tickets: 0,
  total_fianncial: 0,
  verifiedPercent: 0,
});

const now = ref(Date.now());
let countdownTimer;

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);

const formatNumber = (value) =>
  new Intl.NumberFormat("pt-BR").format(value ?? 0);

const pad = (n) => String(n).padStart(2, "0");

const countdown = computed(() => {
  const diff = Math.max(SORTEIO.date.getTime() - now.value, 0);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    finished: diff === 0,
  };
});

const drawDateLabel = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(SORTEIO.date);

const kpiValues = computed(() => ({
  totalTickets: kpis.value.total_tickets,
  totalValidatedTickets: kpis.value.total_validated_tickets,
  totalVendors: kpis.value.total_vendors,
  totalFinancial: formatCurrency(kpis.value.total_fianncial),
  verifiedPercent: kpis.value.verifiedPercent,
}));

const pendingTickets = computed(() =>
  Math.max(
    (kpis.value.total_tickets ?? 0) - (kpis.value.total_validated_tickets ?? 0),
    0
  )
);

/* ------------------------------------------------------------------ */
/* Carregamento (API real)                                             */
/* ------------------------------------------------------------------ */
const loadKpis = async () => {
  kpisLoading.value = true;
  try {
    const { data } = await api.get("/report/kpis");

    if (data) {
      Object.assign(kpis.value, data);
    }

    kpis.value.verifiedPercent = kpis.value.total_tickets
      ? (
        (kpis.value.total_validated_tickets / kpis.value.total_tickets) *
        100
      ).toFixed(2)
      : "0.00";

    kpis.value.total_fianncial = kpis.value.total_validated_tickets * TICKET_VALUE;
  } catch (error) {
    console.error("Failed to load KPIs", error);
  } finally {
    kpisLoading.value = false;
  }
};

const loadValidationReport = async () => {
  try {
    const { data } = await api.get("/report/validationReport");
    const report = Array.isArray(data) ? data : data?.data;
    if (Array.isArray(report)) validationReport.value = report;
  } catch (error) {
    console.error("Failed to load validation report", error);
  }
};

const loadFinancialReport = async () => {
  try {
    const { data } = await api.get("/report/financialReport");
    const report = Array.isArray(data) ? data : data?.data;
    if (Array.isArray(report)) {
      sales.value = report.map((item) => ({
        unit: item?.name ?? "",
        tickets: item?.tickets?.total ?? 0,
        verified: item?.tickets?.verified ?? 0,
        verifiedPercent: item?.tickets?.total
          ? ((item.tickets.verified / item.tickets.total) * 100).toFixed(2)
          : "0.00",
        vendors: Array.isArray(item?.vendedores)
          ? item.vendedores.length
          : item?.vendedores ?? 0,
      }));
    }
  } catch (error) {
    console.error("Failed to load financial report", error);
  }
};

/* ------------------------------------------------------------------ */
/* Gráficos (Chart.js)                                                 */
/* ------------------------------------------------------------------ */
const lineCanvas = ref(null);
const doughnutCanvas = ref(null);
let lineChart;
let doughnutChart;

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0b1437",
      borderColor: "rgba(255, 255, 255, 0.12)",
      borderWidth: 1,
      titleColor: "#f1f4fb",
      bodyColor: "#c3cbe0",
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: "600" },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: COLORS.tick, font: { size: 13, weight: "500" } },
    },
    y: {
      grid: { color: COLORS.grid, lineWidth: 1 },
      border: { display: false },
      ticks: { color: COLORS.tick, font: { size: 13, weight: "500" } },
      beginAtZero: true,
    },
  },
};

const buildLine = () => {
  if (!lineCanvas.value) return;
  lineChart?.destroy();
  lineChart = new Chart(lineCanvas.value, {
    type: "line",
    data: {
      labels: validationReport.value.map((item) => item.date),
      datasets: [
        {
          label: "Verificadas",
          data: validationReport.value.map((item) => item.total),
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
    options: baseOptions,
  });
};

const buildDoughnut = () => {
  if (!doughnutCanvas.value) return;
  doughnutChart?.destroy();
  doughnutChart = new Chart(doughnutCanvas.value, {
    type: "doughnut",
    data: {
      labels: ["Verificadas", "Pendentes"],
      datasets: [
        {
          data: [kpis.value.total_validated_tickets ?? 0, pendingTickets.value],
          backgroundColor: [COLORS.blue, COLORS.neutral],
          borderWidth: 4,
          borderColor: COLORS.surface,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0b1437",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          titleColor: "#f1f4fb",
          bodyColor: "#c3cbe0",
          cornerRadius: 8,
        },
      },
    },
  });
};

const buildCharts = () => {
  buildLine();
  buildDoughnut();
};

watch(validationReport, buildLine, { deep: true });
watch(kpis, buildDoughnut, { deep: true });

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */
onMounted(async () => {
  countdownTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  buildCharts();

  await Promise.all([loadKpis(), loadValidationReport(), loadFinancialReport()]);
  buildCharts();
});

onBeforeUnmount(() => {
  clearInterval(countdownTimer);
  lineChart?.destroy();
  doughnutChart?.destroy();
});
</script>

<template>
  <div class="dash py-4 container-fluid">
    <!-- HERO: sorteio + countdown -->
    <section class="hero card mb-4">
      <div class="card-body px-4 py-3">
        <div class="row align-items-center g-3">
          <div class="col-lg-5">
            <span class="badge-soft">
              <i class="fas fa-trophy me-1"></i> {{ SORTEIO.label }}
            </span>
            <div class="d-flex align-items-baseline flex-wrap gap-2 mt-2">
              <h5 class="hero-title mb-0">Data do Sorteio</h5>
              <span class="hero-date">
                <i class="far fa-calendar-alt me-1"></i>{{ drawDateLabel }}
              </span>
            </div>
          </div>

          <div class="col-lg-7">
            <div v-if="!countdown.finished" class="countdown">
              <div class="count-tile">
                <span class="count-value">{{ countdown.days }}</span>
                <span class="count-label">Dias</span>
              </div>
              <div class="count-tile">
                <span class="count-value">{{ pad(countdown.hours) }}</span>
                <span class="count-label">Horas</span>
              </div>
              <div class="count-tile">
                <span class="count-value">{{ pad(countdown.minutes) }}</span>
                <span class="count-label">Min</span>
              </div>
              <div class="count-tile">
                <span class="count-value">{{ pad(countdown.seconds) }}</span>
                <span class="count-label">Seg</span>
              </div>
            </div>
            <div v-else class="finished">Sorteio realizado!</div>
          </div>
        </div>
      </div>
    </section>

    <!-- KPIs reais -->
    <div class="row g-4 mb-4">
      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-blue"><i class="fas fa-ticket-alt"></i></div>
            <p class="kpi-label">Cartelas Cadastradas</p>
            <h4 class="kpi-value">
              <span v-if="kpisLoading" class="skeleton"></span>
              <span v-else>{{ formatNumber(kpiValues.totalTickets) }}</span>
            </h4>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-aqua"><i class="fas fa-check-circle"></i></div>
            <p class="kpi-label">Cartelas Verificadas</p>
            <h4 class="kpi-value">
              <span v-if="kpisLoading" class="skeleton"></span>
              <template v-else>
                {{ formatNumber(kpiValues.totalValidatedTickets) }}
                <small class="kpi-sub">{{ kpiValues.verifiedPercent }}%</small>
              </template>
            </h4>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-orange"><i class="fas fa-user-tie"></i></div>
            <p class="kpi-label">Vendedores Cadastrados</p>
            <h4 class="kpi-value">
              <span v-if="kpisLoading" class="skeleton"></span>
              <span v-else>{{ formatNumber(kpiValues.totalVendors) }}</span>
            </h4>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-sm-6">
        <div class="kpi card h-100">
          <div class="card-body">
            <div class="kpi-icon kpi-green"><i class="fas fa-sack-dollar"></i></div>
            <p class="kpi-label">Arrecadado</p>
            <h4 class="kpi-value">
              <span v-if="kpisLoading" class="skeleton"></span>
              <span v-else>{{ kpiValues.totalFinancial }}</span>
            </h4>
          </div>
        </div>
      </div>
    </div>

    <!-- Gráficos -->
    <div class="row g-4 mb-4">
      <div class="col-lg-8">
        <div class="card chart-card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 class="mb-0">Resumo de Validações</h6>
                <small class="text-secondary">Cartelas verificadas por data</small>
              </div>
            </div>
            <div class="chart-box">
              <canvas ref="lineCanvas"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card chart-card h-100">
          <div class="card-body d-flex flex-column">
            <h6 class="mb-0">Verificação</h6>
            <small class="text-secondary mb-3">Verificadas x pendentes</small>
            <div class="donut-wrap">
              <canvas ref="doughnutCanvas"></canvas>
              <div class="donut-center">
                <strong>{{ kpiValues.verifiedPercent }}%</strong>
                <span>verificado</span>
              </div>
            </div>
            <div class="legend mt-3">
              <span><i class="dot" style="background: #3987e5"></i> Verificadas</span>
              <span><i class="dot" style="background: #2a3a6b"></i> Pendentes ({{ formatNumber(pendingTickets) }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dash {
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --surface: #ffffff;
  --blue: #2a78d6;
  --blue-deep: #184f95;
  --orange: #eb6834;
  --aqua: #1baf7a;
  --green: #0ca30c;
  --neutral: #e4e3df;
  color: var(--text-primary);
}

.card {
  border: 0;
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.1);
}

/* Hero */
.hero {
  background: linear-gradient(135deg, #2a78d6 0%, #184f95 100%);
  color: #fff;
  overflow: hidden;
  position: relative;
}
.hero::after {
  content: "";
  position: absolute;
  right: -80px;
  top: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.badge-soft {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.hero-title {
  font-weight: 700;
  color: #fff;
}
.hero-date {
  font-size: 0.95rem;
  opacity: 0.95;
}
.countdown {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.count-tile {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 8px 6px;
  text-align: center;
  backdrop-filter: blur(4px);
}
.count-value {
  display: block;
  font-size: clamp(1.2rem, 2.5vw, 1.6rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.count-label {
  display: block;
  margin-top: 4px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
}
.finished {
  font-size: 1.6rem;
  font-weight: 700;
}

/* Progress */
.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}
.hero .progress-track {
  background: rgba(255, 255, 255, 0.25);
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
.hero .progress-fill {
  background: #fff;
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
  grid-row: 1 / span 2;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 1rem;
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
  margin-left: 4px;
}
.kpi-mock {
  border: 1px dashed rgba(15, 23, 42, 0.12);
  box-shadow: none;
}
.mock-tag {
  display: inline-block;
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 6px;
  background: #f0efec;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  vertical-align: middle;
  margin-left: 4px;
}
.skeleton {
  display: inline-block;
  width: 80px;
  height: 22px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eee, #f7f7f7, #eee);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
  font-size: 1.6rem;
  font-variant-numeric: tabular-nums;
}
.donut-center span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.chart-card {
  background: #111c44;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #f1f4fb;
}
.chart-card h6 {
  color: #f1f4fb;
  font-weight: 700;
}
.chart-card .text-secondary {
  color: #9aa6c4 !important;
}
.donut-center strong {
  color: #f1f4fb;
}
.donut-center span {
  color: #9aa6c4;
}
.legend {
  display: flex;
  justify-content: center;
  gap: 18px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #f1f4fb;
}
.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 6px;
}

.text-secondary {
  color: var(--text-secondary) !important;
}

@media (max-width: 576px) {
  .countdown {
    gap: 8px;
  }
  .count-tile {
    padding: 12px 4px;
  }
}
</style>
