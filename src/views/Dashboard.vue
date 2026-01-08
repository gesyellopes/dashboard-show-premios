<script setup>
import { computed, onMounted, ref } from "vue";
import MiniStatisticsCard from "@/examples/Cards/MiniStatisticsCard.vue";
import GradientLineChart from "@/examples/Charts/GradientLineChart.vue";
import api from "@/services/api";
//import Carousel from "./components/Carousel.vue";
//import CategoriesList from "./components/CategoriesList.vue";

const sales = ref([]);

const validationReport = ref([]);
const kpisLoading = ref(true);
const kpis = ref({
  total_vendors: 0,
  total_tickets: 0,
  total_validated_tickets: 0,
  total_fianncial: 0,
});

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);

const kpiValues = computed(() => ({
  totalTickets: kpis.value.total_tickets,
  totalValidatedTickets: kpis.value.total_validated_tickets,
  totalVendors: kpis.value.total_vendors,
  totalFinancial: formatCurrency(kpis.value.total_fianncial),
}));

const loadKpis = async () => {
  kpisLoading.value = true;
  try {
    const { data } = await api.get("/report/kpis");
    if (data) kpis.value = data;
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
        vendors: Array.isArray(item?.vendedores)
          ? item.vendedores.length
          : item?.vendedores ?? 0,
      }));
    }
  } catch (error) {
    console.error("Failed to load financial report", error);
  }
};

const validationChart = computed(() => ({
  labels: validationReport.value.map((item) => item.date),
  datasets: [
    {
      label: "Verificadas",
      data: validationReport.value.map((item) => item.total),
    },
  ],
}));

onMounted(() => {
  loadKpis();
  loadValidationReport();
  loadFinancialReport();
});
</script>
<template>
  <div class="py-4 container-fluid">
    <div class="row">
      <div class="col-lg-12">
        <div class="row">
          <div class="col-lg-3 col-md-6 col-12">
            <mini-statistics-card title="Cartelas Cadastradas" :value="{ text: kpiValues.totalTickets }"
              :loading="kpisLoading" description="" :icon="{
              component: 'ni ni-money-coins',
              background: 'bg-gradient-primary',
              shape: 'rounded-circle',
            }" />
          </div>
          <div class="col-lg-3 col-md-6 col-12">
            <mini-statistics-card title="Cartelas Verificadas" :value="{ text: kpiValues.totalValidatedTickets }"
              :loading="kpisLoading" description="" :icon="{
              component: 'ni ni-check-bold',
              background: 'bg-gradient-danger',
              shape: 'rounded-circle',
            }" />
          </div>
          <div class="col-lg-3 col-md-6 col-12">
            <mini-statistics-card title="Vendedores Cadastrados" :value="{ text: kpiValues.totalVendors }"
              :loading="kpisLoading" description="" :icon="{
              component: 'ni ni-paper-diploma',
              background: 'bg-gradient-success',
              shape: 'rounded-circle',
            }" />
          </div>
          <div class="col-lg-3 col-md-6 col-12">
            <mini-statistics-card title="Arrecadado" :value="{ text: kpiValues.totalFinancial }" :loading="kpisLoading"
              description="" :icon="{
              component: 'ni ni-cart',
              background: 'bg-gradient-warning',
              shape: 'rounded-circle',
            }" />
          </div>
        </div>
        <div class="row">
          <div class="col-lg-6 mb-lg">
            <div class="card z-index-2">
              <gradient-line-chart id="chart-line" title="Resumo Validações" :chart="validationChart" />
            </div>
          </div>
          <div class="col-lg-6">
            <div class="col-lg-12 mb-lg-0 mb-4">
              <div class="card">
                <div class="p-3 pb-0 card-header">
                  <div class="d-flex justify-content-between">
                    <h6 class="mb-2">Resumo por Comunidade</h6>
                  </div>
                </div>
                <div class="table-responsive">
                  <table class="table align-items-center">
                    <tbody>
                      <tr v-for="(sale, index) in sales" :key="index">
                        <td class="w-30">
                          <div class="px-2 py-1 d-flex align-items-center">
                            <div class="ms-4">
                              <p class="mb-0 text-xs font-weight-bold">
                                Comunidade
                              </p>
                              <h6 class="mb-0 text-sm">{{ sale.unit }}</h6>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="text-center">
                            <p class="mb-0 text-xs font-weight-bold">Cartelas</p>
                            <h6 class="mb-0 text-sm">{{ sale.tickets }}</h6>
                          </div>
                        </td>
                        <td>
                          <div class="text-center">
                            <p class="mb-0 text-xs font-weight-bold">Verificadas</p>
                            <h6 class="mb-0 text-sm">{{ sale.verified }}</h6>
                          </div>
                        </td>
                        <td class="text-sm align-middle">
                          <div class="text-center col">
                            <p class="mb-0 text-xs font-weight-bold">Vendedores</p>
                            <h6 class="mb-0 text-sm">{{ sale.vendors }}</h6>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
