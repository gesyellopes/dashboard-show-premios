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
const filterForm = ref(null);
const filters = ref({});

// options combos
const unitOptions = ref([]);
const groupOptions = ref([]);
const groupLoading = ref(false);

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

// reseta combo de paróquia
const resetGroupFilter = () => {
  groupOptions.value = [];
  const form = filterForm.value;
  if (form?.el$) {
    form.el$("group_id")?.update(null);
  }
};

// mesma lógica do vendors: ao selecionar unidade, busca grupos
const handleUnitFilterChange = async (value) => {
  const unitId = value?.value ?? value;

  if (!unitId) {
    resetGroupFilter();
    return;
  }

  groupLoading.value = true;
  resetGroupFilter();

  try {
    const { data } = await api.get(`/groups/by-unit/${unitId}`);
    const groups = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    groupOptions.value = groups.map((g) => ({
      value: g.id,
      label: g.name,
    }));
  } catch (error) {
    console.error("Failed to load groups by unit", error);
  } finally {
    groupLoading.value = false;
  }
};

const handleFilter = (form$) => {
  filters.value = { ...form$.requestData };
  setTableLoading(true);
  reloadTable();
};

const handleResetFilters = () => {
  filters.value = {};
  if (filterForm.value) filterForm.value.reset();
  resetGroupFilter();
  setTableLoading(true);
  reloadTable();
};

// ===== Columns =====
const columns = [
  { data: "ticketNumber", title: "Cartela", name: "ticketNumber" },

  {
    data: null,
    title: "Comunidade",
    name: "unit",
    defaultContent: "-",
    render: (_d, _t, row) => row?.unit?.name ?? "-",
  },
  {
    data: null,
    title: "Paróquia",
    name: "group",
    defaultContent: "-",
    render: (_d, _t, row) => row?.group?.name ?? "-",
  },
  {
    data: null,
    title: "Vendedor",
    name: "vendor",
    defaultContent: "-",
    render: (_d, _t, row) => row?.vendor?.name ?? "-",
  },

  // ✅ Validada clicável (só se "Sim" e tiver mirror)
  {
    data: "validated",
    title: "Validada",
    name: "validated",
    orderable: false,
    render: (_val, _type, row) => {
      const ok = Number(row?.validated) === 1;

      if (!ok) {
        return `<span class="badge bg-secondary">Não</span>`;
      }

      const hasMirror = !!row?.mirror;
      const disabledStyle = hasMirror ? "" : "opacity:0.6; pointer-events:none;";
      const title = hasMirror ? "Ver canhoto" : "Sem canhoto";

      return `
        <a href="#"
           class="badge bg-success text-decoration-none js-open-mirror"
           style="cursor:pointer; ${disabledStyle}"
           title="${title}">
          Sim
        </a>
      `;
    },
  },

  {
    data: "paid",
    title: "Paga",
    name: "paid",
    orderable: false,
    render: (val) => {
      const ok = Number(val) === 1;
      const cls = ok ? "badge bg-success" : "badge bg-warning text-dark";
      return `<span class="${cls}">${ok ? "Sim" : "Não"}</span>`;
    },
  },
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

    const endpoint = "/tickets";
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
                <h6 class="mb-0">Cartelas</h6>
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
              <!-- ✅ FILTROS -->
              <div class="col-3 tickets-filters">
                <Vueform ref="filterForm" :endpoint="false" @submit="handleFilter">
                  <GroupElement name="container4">
                    <GroupElement name="column1" :columns="{ container: 12 }">
                      <TextElement name="ticket_number" label="Cartela" />

                      <SelectElement
                        name="unit_id"
                        :items="unitOptions"
                        :search="true"
                        :native="false"
                        label="Comunidade"
                        input-type="search"
                        autocomplete="off"
                        @change="handleUnitFilterChange"
                      />

                      <SelectElement
                        name="group_id"
                        :items="groupOptions"
                        :search="true"
                        :native="false"
                        label="Paróquia"
                        input-type="search"
                        autocomplete="off"
                        :disabled="groupLoading || groupOptions.length === 0"
                      />
                    </GroupElement>

                    <GroupElement name="column4" :columns="{ container: 12 }">
                      <StaticElement
                        name="p"
                        tag="blockquote"
                        content="<div><strong>Buscar por vendedor</strong></div>"
                      />
                      <TextElement name="vendor_name" label="Nome Vendedor" />
                      <TextElement name="vendor_whatsapp" label="Whatsapp Vendedor" />
                    </GroupElement>

                    <GroupElement name="column4_1" :columns="{ container: 6 }">
                      <ToggleElement name="validated" text="Validada" />
                      <ToggleElement name="paid" text="Paga" />
                    </GroupElement>

                    <GroupElement name="column4_2" :columns="{ container: 12 }">
                      <ButtonElement
                        name="submit"
                        button-label="Filtrar"
                        :submits="true"
                        :columns="{ container: 6 }"
                      />
                      <ButtonElement
                        name="reset"
                        button-label="Limpar"
                        :secondary="true"
                        :submits="false"
                        :columns="{ container: 6 }"
                        @click="handleResetFilters"
                      />
                    </GroupElement>
                  </GroupElement>
                </Vueform>
              </div>

              <!-- ✅ TABELA -->
              <div class="col-9 tickets-table">
                <!-- wrapper captura clique nos badges -->
                <div @click="onTableClick">
                  <DataTable
                    ref="dtRef"
                    class="table table-striped table-hover align-items-center mb-0"
                    :columns="columns"
                    :options="options"
                    :ajax="ajaxTickets"
                  />
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
        <img
          :src="mirrorUrl"
          alt="Canhoto"
          class="img-fluid rounded"
          style="max-height: 70vh;"
          @error="mirrorLoadError = true"
          v-show="!mirrorLoadError"
        />

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