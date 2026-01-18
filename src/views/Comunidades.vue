<script setup>
import { ref, onMounted } from "vue";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

import api from "@/services/api";
import BaseModal from "@/views/components/BaseModal.vue"; // ajuste se seu path for outro

DataTable.use(DataTablesCore);

// ===== DataTables refs/helpers =====
const dtRef = ref(null);

function reloadTable() {
  const dt = dtRef.value?.dt;
  if (dt) dt.ajax.reload(null, false);
}

function setTableLoading(isLoading) {
  const dt = dtRef.value?.dt;
  if (dt) dt.processing(isLoading);
}

// ===== Modal Canhoto =====
const showMirrorModal = ref(false);
const mirrorUrl = ref("");
const mirrorTicketNumber = ref("");
const mirrorLoadError = ref(false);

const STORAGE_BASE = "https://storage.showdepremios.cloud/file/";

function formatBrWhatsapp(value) {
    if (!value) return "-";
    const digits = String(value).replace(/\D/g, "");
    const d = digits.startsWith("55") ? digits.slice(2) : digits;
    if (d.length < 10) return value;

    const ddd = d.slice(0, 2);
    const rest = d.slice(2);

    // celular 9 dígitos
    if (rest.length === 9) {
        return `(${ddd}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
    }

    // fixo 8 dígitos
    if (rest.length === 8) {
        return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
    }

    return value;
}

function openMirrorModal(row) {
  if (!row?.mirror) return;

  mirrorLoadError.value = false;
  mirrorTicketNumber.value = row.ticketNumber ?? "";

  const filename = encodeURIComponent(String(row.mirror).trim());
  mirrorUrl.value = `${STORAGE_BASE}${filename}`;

  console.log("mirrorUrl:", mirrorUrl.value);
  showMirrorModal.value = true;
}

function closeMirrorModal() {
  showMirrorModal.value = false;
  mirrorUrl.value = "";
  mirrorTicketNumber.value = "";
  mirrorLoadError.value = false;
}

// ===== Filters (Vueform) =====
const filters = ref({});

// options combos
const unitOptions = ref([]);

// carrega comunidades
const loadUnits = async () => {
  try {
    const { data } = await api.get("/units/list");
    const units = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    unitOptions.value = units.map((u) => ({
      value: u.id,
      label: u.name,
    }));
  } catch (error) {
    console.error("Failed to load units", error);
  }
};

// ===== Columns =====
const columns = [
  {
    data: null,
    title: "Comunidade",
    name: "unit",
    defaultContent: "-",
    render: (_d, _t, row) => row?.name ?? "-",
  },
  {
    data: null,
    title: "Coordenador",
    name: "coordinator",
    defaultContent: "-",
    render: (_d, _t, row) => row?.manager?.name ?? "-",
  },
  {
    data: null,
    title: "Whatsapp",
    name: "coordinator_whatsapp",
    defaultContent: "-",
    render: (_d, _t, row) => formatBrWhatsapp(row?.manager?.whatsapp) ?? "-",
  },
  {
    data: null,
    title: "Cartelas",
    name: "total_tickets",
    defaultContent: "-",
    render: (_d, _t, row) => row?.counts?.totalTickets ?? "-",
  },
  {
    data: null,
    title: "Validadas",
    name: "validated_tickets",
    defaultContent: "-",
    render: (_d, _t, row) => row?.counts?.validatedTickets ?? "-",
  },
  {
    data: null,
    title: "Não Validadas",
    name: "not_validated_tickets",
    defaultContent: "-",
    render: (_d, _t, row) => row?.counts?.awaitValidationTickets ?? "-",
  },
  {
    data: null,
    title: "Devolvidas",
    name: "returned_tickets",
    defaultContent: "-",
    render: (_d, _t, row) => row?.counts?.returnedTickets ?? "-",
  }
];

// ===== DataTables options =====
const options = {
  processing: true,
  serverSide: true,
  searching: false,
  lengthChange: false,
  pageLength: 30,
  ordering: false,
  responsive: true,
  stateSave: false,
};

// ===== server-side ajax =====
async function ajaxTickets(dtRequest, callback) {
  try {
    const length = dtRequest.length || 30;
    const page = Math.floor((dtRequest.start || 0) / length) + 1;

    const endpoint = "/units/list";
    const rawFilters = filters.value || {};

    // limpa params vazios (igual vendors)
    const params = Object.keys(rawFilters).reduce((acc, key) => {
      const value = rawFilters[key];

      // Vueform SelectElement costuma mandar {value,label}
      const normalized =
        value && typeof value === "object" && "value" in value ? value.value : value;

      if (
        normalized === null ||
        normalized === undefined ||
        normalized === "" ||
        normalized === false // toggle desligado não manda
      ) {
        return acc;
      }

      acc[key] = normalized;
      return acc;
    }, {});

    const { data } = await api.get(endpoint, {
      params: {
        page,
        limit: length,
        ...params,
      },
    });

    const meta = data?.meta || {};
    const rows = Array.isArray(data?.data) ? data.data : [];

    callback({
      draw: dtRequest.draw,
      data: rows,
      recordsTotal: meta.total ?? rows.length,
      recordsFiltered: meta.total ?? rows.length,
    });
  } catch (e) {
    console.error("DataTables ajax error:", e);
    callback({
      draw: dtRequest.draw,
      data: [],
      recordsTotal: 0,
      recordsFiltered: 0,
    });
  } finally {
    setTableLoading(false);
  }
}

// ===== capture click inside DataTables (supports responsive child rows) =====
function onTableClick(e) {
  const el = e.target?.closest?.(".js-open-mirror");
  if (!el) return;

  e.preventDefault();

  const dt = dtRef.value?.dt;
  if (!dt) return;

  let tr = el.closest("tr");
  if (!tr) return;

  // ✅ responsive mode creates a "child" row; the real data row is the previous sibling
  if (tr.classList.contains("child")) {
    tr = tr.previousElementSibling;
  }

  const rowData = dt.row(tr).data();

  console.log("rowData click:", rowData);

  if (!rowData?.mirror) return;
  openMirrorModal(rowData);
}

onMounted(loadUnits);
</script>

<template>
  <div class="py-4 container-fluid">
    <div class="row">
      <div class="col-md-12 mb-lg-0 mb-4">
        <div class="card">
          <div class="card-header pb-0">
            <div class="row">
              <div class="col-6 d-flex align-items-center">
                <h6 class="mb-0">Comunidades</h6>
              </div>
              <div class="col-6 text-end">
                <button class="btn bg-gradient-dark mb-0" type="button" @click="reloadTable">
                  <i class="fas fa-rotate"></i>&nbsp;&nbsp;Recarregar
                </button>
              </div>
            </div>
          </div>

          <div class="card-body">
            <div class="row">
              <!-- ✅ TABELA -->
              <div class="col-12 tickets-table">
                <!-- wrapper captura clique nos badges -->
                <div @click="onTableClick">
                  <DataTable ref="dtRef" class="table table-striped table-hover align-items-center mb-0"
                    :columns="columns" :options="options" :ajax="ajaxTickets" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ✅ MODAL CANHOTO -->
    <BaseModal v-model="showMirrorModal" title="Canhoto" @close="closeMirrorModal">
      <div class="mb-2">
        <strong>Cartela:</strong> {{ mirrorTicketNumber || "-" }}
      </div>

      <div v-if="mirrorUrl" class="text-center">
        <img :src="mirrorUrl" alt="Canhoto" class="img-fluid rounded" style="max-height: 70vh;"
          @error="mirrorLoadError = true" v-show="!mirrorLoadError" />

        <div v-if="mirrorLoadError" class="alert alert-warning text-start mt-3">
          Não foi possível carregar a imagem.
          <div class="mt-2">
            <a :href="mirrorUrl" target="_blank" rel="noopener">Abrir imagem em nova aba</a>
          </div>
        </div>
      </div>

      <div v-else class="text-muted">Sem imagem.</div>

      <template #footer>
        <button class="btn btn-outline-dark mb-0" type="button" @click="closeMirrorModal">
          Fechar
        </button>
      </template>
    </BaseModal>
  </div>
</template>