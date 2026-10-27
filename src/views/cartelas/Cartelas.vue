<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

import api from "@/services/api";
import BaseModal from "@/components/common/BaseModal.vue"; // ajuste se seu path for outro
import Swal from "sweetalert2";
import { DateTime } from "luxon";

const store = useStore();
const isAdmin = computed(() => store.state.auth.user?.role === "admin");

DataTable.use(DataTablesCore);

// ===== Estado geral da página =====
const totalRecords = ref(0);
const isLoading = ref(false);
const filtersOpen = ref(true);

const STATUS_OPTIONS = [
  { value: null, label: "Todas", icon: "fas fa-layer-group" },
  { value: 1, label: "Validadas", icon: "fas fa-circle-check" },
  { value: 0, label: "Não validadas", icon: "fas fa-clock" },
];

const FILTER_LABELS = {
  ticket_number: "Cartela",
  group_id: "Distribuidor",
  vendor_name: "Vendedor",
  vendor_whatsapp: "WhatsApp",
};

// ===== Utils =====
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const initials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

// ===== DataTables refs/helpers =====
const dtRef = ref(null);

// recarrega mantendo a página atual (botão Recarregar)
function reloadTable() {
  const dt = dtRef.value?.dt;
  if (dt) dt.ajax.reload(null, false);
}

// aplica filtros: volta para a primeira página, senão a página atual pode não existir mais
function reloadToFirstPage() {
  const dt = dtRef.value?.dt;
  if (dt) dt.ajax.reload(null, true);
}

function setTableLoading(loading) {
  isLoading.value = loading;
  const dt = dtRef.value?.dt;
  if (dt) dt.processing(loading);
}

// ===== Modal Canhoto =====
const showMirrorModal = ref(false);
const mirrorUrl = ref("");
const mirrorTicketNumber = ref("");
const mirrorTicketValidatedDate = ref("");
const mirrorLoadError = ref(false);
const mirrorRowData = ref(null);
const mirrorWhatsappSenderNumber = ref("");
const mirrorWhatsappSenderName = ref("");
const mirrorOriginalUrl = ref("");
const mirrorAttemptedFallback = ref(false);
const mirrorImageLoaded = ref(false);

// Zoom, pan e rotação
const mirrorZoom = ref(1);
const mirrorOffsetX = ref(0);
const mirrorOffsetY = ref(0);
const mirrorRotation = ref(0);
const mirrorDragging = ref(false);
const mirrorDragStartX = ref(0);
const mirrorDragStartY = ref(0);
const mirrorDragStartOffsetX = ref(0);
const mirrorDragStartOffsetY = ref(0);
const mirrorImgRef = ref(null);
const mirrorViewerRef = ref(null);

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const WHEEL_STEP = 0.2;
const PAN_STEP = 40;

const STORAGE_BASE = "https://files.showdepremios.cloud/tickets/";

function formatValidatedDate(dateString) {
  if (!dateString) return "-";
  try {
    const dt = DateTime.fromISO(dateString);
    return dt.toFormat("dd/MM/yyyy 'às' HH:mm");
  } catch {
    return "-";
  }
}

function formatPhoneBR(phone) {
  if (!phone) return "-";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55")) cleaned = cleaned.slice(2);
  if (cleaned.length !== 10 && cleaned.length !== 11) return phone;
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

function whatsappLink(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.length >= 12 ? digits : `55${digits}`}`;
}

const mirrorWhatsappLink = computed(() => whatsappLink(mirrorWhatsappSenderNumber.value));

function openMirrorModal(row) {
  if (!row?.mirror) return;

  mirrorLoadError.value = false;
  mirrorAttemptedFallback.value = false;
  mirrorImageLoaded.value = false;
  resetView();
  mirrorTicketNumber.value = row.ticketNumber ?? "";
  mirrorTicketValidatedDate.value = row.validatedOn ?? "";
  mirrorWhatsappSenderNumber.value = row.whatsappSenderNumber ?? "";
  mirrorWhatsappSenderName.value = row.whatsappSenderName ?? "";
  mirrorRowData.value = row;

  const filename = encodeURIComponent(String(row.mirror).trim());
  mirrorOriginalUrl.value = `${STORAGE_BASE}${filename}`;
  mirrorUrl.value = mirrorOriginalUrl.value;

  showMirrorModal.value = true;
}

function onMirrorImageLoad() {
  mirrorImageLoaded.value = true;
}

// ===== Zoom, pan e rotação =====
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function resetZoom() {
  mirrorZoom.value = 1;
  mirrorOffsetX.value = 0;
  mirrorOffsetY.value = 0;
}

function resetView() {
  resetZoom();
  mirrorRotation.value = 0;
}

// limite de arraste: o quanto da imagem ampliada passa da área visível
function getPanLimits(zoom) {
  const container = mirrorViewerRef.value;
  const img = mirrorImgRef.value;
  if (!container || !img) return { x: 0, y: 0 };

  const quarterTurn = Math.abs(mirrorRotation.value / 90) % 2 === 1;
  const imgW = quarterTurn ? img.offsetHeight : img.offsetWidth;
  const imgH = quarterTurn ? img.offsetWidth : img.offsetHeight;

  return {
    x: Math.max(0, (imgW * zoom - container.clientWidth) / 2),
    y: Math.max(0, (imgH * zoom - container.clientHeight) / 2),
  };
}

function clampOffsets() {
  const limit = getPanLimits(mirrorZoom.value);
  mirrorOffsetX.value = clamp(mirrorOffsetX.value, -limit.x, limit.x);
  mirrorOffsetY.value = clamp(mirrorOffsetY.value, -limit.y, limit.y);
}

// zoom que mantém o ponto sob o cursor parado (sem coordenadas, usa o centro)
function setZoom(value, clientX, clientY) {
  const from = mirrorZoom.value;
  const to = clamp(Number(value.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
  if (to === from) return;

  if (to === MIN_ZOOM) {
    resetZoom();
    return;
  }

  const container = mirrorViewerRef.value;
  if (container) {
    const rect = container.getBoundingClientRect();
    const cx = clientX === undefined ? 0 : clientX - (rect.left + rect.width / 2);
    const cy = clientY === undefined ? 0 : clientY - (rect.top + rect.height / 2);
    const k = to / from;
    mirrorOffsetX.value = cx - (cx - mirrorOffsetX.value) * k;
    mirrorOffsetY.value = cy - (cy - mirrorOffsetY.value) * k;
  }

  mirrorZoom.value = to;
  clampOffsets();
}

function zoomIn() {
  setZoom(mirrorZoom.value + ZOOM_STEP);
}

function zoomOut() {
  setZoom(mirrorZoom.value - ZOOM_STEP);
}

function onZoomSlider(e) {
  setZoom(Number(e.target.value));
}

function panBy(dx, dy) {
  if (mirrorZoom.value <= MIN_ZOOM) return;
  mirrorOffsetX.value += dx;
  mirrorOffsetY.value += dy;
  clampOffsets();
}

function rotate(delta) {
  mirrorRotation.value = (mirrorRotation.value + delta + 360) % 360;
  clampOffsets();
}

function handleImageWheel(e) {
  if (!mirrorImgRef.value) return;
  e.preventDefault();

  const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
  setZoom(mirrorZoom.value + delta, e.clientX, e.clientY);
}

function handleImageMouseDown(e) {
  if (mirrorZoom.value === MIN_ZOOM) return;

  mirrorDragging.value = true;
  mirrorDragStartX.value = e.clientX;
  mirrorDragStartY.value = e.clientY;
  mirrorDragStartOffsetX.value = mirrorOffsetX.value;
  mirrorDragStartOffsetY.value = mirrorOffsetY.value;
}

function handleImageMouseMove(e) {
  if (!mirrorDragging.value || !mirrorImgRef.value) return;

  mirrorOffsetX.value = mirrorDragStartOffsetX.value + (e.clientX - mirrorDragStartX.value);
  mirrorOffsetY.value = mirrorDragStartOffsetY.value + (e.clientY - mirrorDragStartY.value);
  clampOffsets();
}

function handleImageMouseUp() {
  mirrorDragging.value = false;
}

function handleImageDoubleClick(e) {
  setZoom(mirrorZoom.value > MIN_ZOOM ? MIN_ZOOM : 2.5, e.clientX, e.clientY);
}

// atalhos de teclado enquanto o modal está aberto (ignorados ao digitar)
function handleGlobalKeydown(e) {
  if (!showMirrorModal.value) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key) {
    case "+":
    case "=":
      zoomIn();
      break;
    case "-":
    case "_":
      zoomOut();
      break;
    case "0":
      resetZoom();
      break;
    case "r":
    case "R":
      rotate(90);
      break;
    case "ArrowLeft":
      panBy(PAN_STEP, 0);
      break;
    case "ArrowRight":
      panBy(-PAN_STEP, 0);
      break;
    case "ArrowUp":
      panBy(0, PAN_STEP);
      break;
    case "ArrowDown":
      panBy(0, -PAN_STEP);
      break;
    default:
      return;
  }
  e.preventDefault();
}

onMounted(() => window.addEventListener("keydown", handleGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleGlobalKeydown));

const mirrorImageStyle = computed(() => ({
  transform: `translate(${mirrorOffsetX.value}px, ${mirrorOffsetY.value}px) scale(${mirrorZoom.value}) rotate(${mirrorRotation.value}deg)`,
  cursor: mirrorZoom.value > MIN_ZOOM ? (mirrorDragging.value ? "grabbing" : "grab") : "zoom-in",
  transition: mirrorDragging.value ? "none" : "transform 0.12s ease-out",
}));

const mirrorZoomPercent = computed(() => Math.round(mirrorZoom.value * 100));

function handleMirrorImageError() {
  if (mirrorAttemptedFallback.value) {
    mirrorLoadError.value = true;
    return;
  }

  const url = mirrorUrl.value;
  let fallbackUrl = "";

  if (url.endsWith(".jpeg")) {
    fallbackUrl = url.slice(0, -5) + ".jpg";
  } else if (url.endsWith(".jpg")) {
    fallbackUrl = url.slice(0, -4) + ".jpeg";
  }

  if (fallbackUrl) {
    mirrorAttemptedFallback.value = true;
    mirrorImageLoaded.value = false;
    mirrorUrl.value = fallbackUrl;
  } else {
    mirrorLoadError.value = true;
  }
}

function closeMirrorModal() {
  showMirrorModal.value = false;
  mirrorUrl.value = "";
  mirrorOriginalUrl.value = "";
  mirrorTicketNumber.value = "";
  mirrorLoadError.value = false;
  mirrorAttemptedFallback.value = false;
  mirrorImageLoaded.value = false;
  resetView();
  mirrorRowData.value = null;
  mirrorWhatsappSenderNumber.value = "";
  mirrorWhatsappSenderName.value = "";
}

async function confirmInvalidate() {
  if (!mirrorRowData.value?.ticketNumber) return;

  const result = await Swal.fire({
    icon: "warning",
    title: "Confirmar Desvalidação",
    text: `Deseja remover a validação da cartela "${mirrorRowData.value.ticketNumber}"?`,
    showCancelButton: true,
    confirmButtonText: "Sim, desvalidar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc3545",
  });

  if (result.isConfirmed) {
    await invalidateTicket();
  }
}

async function invalidateTicket() {
  if (!mirrorRowData.value?.ticketNumber) return;

  try {
    const { data } = await api.post("/invalidate", {
      ticket_number: mirrorRowData.value.ticketNumber,
    });

    if (data?.success) {
      await Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: "Cartela desvalidada com sucesso.",
      });

      closeMirrorModal();
      reloadTable();
      return;
    }

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: data?.message || "Erro ao desvalidar a cartela.",
    });
  } catch (error) {
    const message = error?.response?.data?.message || "Erro ao desvalidar a cartela.";

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: message,
    });
  }
}

// ===== Filters (Vueform) =====
const filterForm = ref(null);
const filters = ref({});
const statusFilter = ref(null); // 1 = validadas, 0 = não validadas, null = todas

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

// filtros aplicados (chips + contador) — derivados do que foi submetido
const activeChips = computed(() =>
  Object.keys(FILTER_LABELS).reduce((acc, key) => {
    const raw = filters.value[key];
    const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
    if (value === null || value === undefined || value === "" || value === false) return acc;

    let text = String(value);
    if (key === "group_id") {
      text = groupOptions.value.find((g) => g.value === value)?.label ?? text;
    }

    acc.push({ key, label: FILTER_LABELS[key], text });
    return acc;
  }, [])
);

const activeFilterCount = computed(
  () => activeChips.value.length + (statusFilter.value !== null ? 1 : 0)
);

const handleFilter = (form$) => {
  filters.value = { ...form$.requestData, validated: statusFilter.value };
  setTableLoading(true);
  reloadToFirstPage();
};

const handleResetFilters = () => {
  statusFilter.value = null;
  filters.value = {};
  if (filterForm.value) filterForm.value.reset();
  resetGroupFilter();
  setTableLoading(true);
  reloadToFirstPage();
};

// clique nos botões de status: aplica na hora, sem precisar submeter o form
function setStatus(value) {
  if (statusFilter.value === value) return;
  statusFilter.value = value;
  filters.value = { ...filters.value, validated: value };
  setTableLoading(true);
  reloadToFirstPage();
}

// remove um chip: limpa o campo no form e reaplica
function removeChip(key) {
  filterForm.value?.el$(key)?.update(null);
  filters.value = { ...filters.value, [key]: null };
  setTableLoading(true);
  reloadToFirstPage();
}

// ===== Columns =====
const columns = [
  {
    data: "ticketNumber",
    title: "Cartela",
    name: "ticketNumber",
    render: (d) => (d ? `<span class="ct-ticket">${esc(d)}</span>` : `<span class="ct-muted">-</span>`),
  },
  {
    data: null,
    title: "Vendedor",
    name: "vendor",
    defaultContent: "-",
    render: (_d, _t, row) => {
      const name = row?.vendor?.name;
      if (!name) return `<span class="ct-muted">-</span>`;
      return `
        <div class="ct-vendor">
          <span class="ct-avatar">${esc(initials(name))}</span>
          <span>${esc(name)}</span>
        </div>`;
    },
  },
  {
    data: "validatedOn",
    title: "Validada em",
    name: "validatedOn",
    orderable: false,
    defaultContent: "-",
    render: (val) =>
      val
        ? `<span class="ct-date">${esc(formatValidatedDate(val))}</span>`
        : `<span class="ct-muted">-</span>`,
  },
  // Status clicável (só se "Sim" e tiver mirror)
  {
    data: "validated",
    title: "Status",
    name: "validated",
    orderable: false,
    render: (_val, _type, row) => {
      const ok = Number(row?.validated) === 1;

      if (!ok) {
        return `<span class="ct-pill ct-pill-off"><i class="fas fa-circle-xmark"></i> Não</span>`;
      }

      if (!row?.mirror) {
        return `<span class="ct-pill ct-pill-ok is-disabled" title="Sem canhoto"><i class="fas fa-check"></i> Sim</span>`;
      }

      return `
        <button type="button" class="ct-pill ct-pill-ok js-open-mirror" title="Ver canhoto">
          <i class="fas fa-check"></i> Sim
          <i class="fas fa-image ct-pill-action"></i>
        </button>`;
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
  language: {
    emptyTable: "Nenhuma cartela cadastrada ainda",
    zeroRecords: "Nenhuma cartela encontrada com esses filtros",
    info: "Exibindo _START_ a _END_ de _TOTAL_ cartelas",
    infoEmpty: "Exibindo 0 a 0 de 0 cartelas",
    processing: "Carregando cartelas...",
    paginate: { previous: "Anterior", next: "Próxima" },
  },
};

// ===== server-side ajax =====
async function ajaxTickets(dtRequest, callback) {
  try {
    const length = dtRequest.length || 30;
    const page = Math.floor((dtRequest.start || 0) / length) + 1;

    const endpoint = "/tickets";
    const rawFilters = filters.value || {};

    // limpa params vazios
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
    const total = meta.total ?? rows.length;

    totalRecords.value = total;

    callback({
      draw: dtRequest.draw,
      data: rows,
      recordsTotal: total,
      recordsFiltered: total,
    });
  } catch (e) {
    console.error("DataTables ajax error:", e);
    totalRecords.value = 0;
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

  // responsive mode creates a "child" row; the real data row is the previous sibling
  if (tr.classList.contains("child")) {
    tr = tr.previousElementSibling;
  }

  const rowData = dt.row(tr).data();

  if (!rowData?.mirror) return;
  openMirrorModal(rowData);
}

onMounted(loadUnits);
</script>

<template>
  <div class="py-4 container-fluid ct-page">
    <!-- HERO -->
    <section class="ct-hero mb-4">
      <div class="ct-hero-main">
        <div class="ct-hero-icon"><i class="fas fa-ticket"></i></div>
        <div>
          <h4 class="ct-hero-title">Cartelas</h4>
          <p class="ct-hero-sub mb-0">Pesquise, filtre e confira os canhotos validados</p>
        </div>
      </div>

      <div class="ct-hero-stats">
        <div class="ct-stat">
          <span :key="totalRecords" class="ct-stat-value">{{ totalRecords.toLocaleString("pt-BR") }}</span>
          <span class="ct-stat-label">resultados</span>
        </div>
        <div class="ct-stat">
          <span :key="activeFilterCount" class="ct-stat-value">{{ activeFilterCount }}</span>
          <span class="ct-stat-label">filtros ativos</span>
        </div>
      </div>

      <button type="button" class="ct-refresh" :class="{ 'is-spinning': isLoading }" :disabled="isLoading"
        @click="reloadTable">
        <i class="fas fa-rotate"></i> Recarregar
      </button>
    </section>

    <div class="row">
      <!-- FILTROS -->
      <aside class="col-lg-3 mb-4 mb-lg-0">
        <div class="card ct-filters-card" :class="{ 'is-collapsed': !filtersOpen }">
          <button type="button" class="ct-filters-head" :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen">
            <span><i class="fas fa-sliders me-2"></i>Filtros</span>
            <i class="fas fa-chevron-down ct-chevron"></i>
          </button>

          <div class="ct-filters-body">
            <Vueform ref="filterForm" :endpoint="false" @submit="handleFilter">
              <GroupElement name="container4">
                <GroupElement name="column1" :columns="{ container: 12 }">
                  <TextElement name="ticket_number" label="Cartela" />

                  <SelectElement v-if="false" name="unit_id" :items="unitOptions" :search="true" :native="false"
                    label="Paróquia" input-type="search" autocomplete="off" @change="handleUnitFilterChange" />

                  <SelectElement name="group_id" :items="groupOptions" :search="true" :native="false"
                    label="Distribuidor" input-type="search" autocomplete="off"
                    :disabled="groupLoading || groupOptions.length === 0" />
                </GroupElement>

                <GroupElement name="column4" :columns="{ container: 12 }">
                  <StaticElement name="vendor_title" tag="div"
                    content="<div class='ct-section-title'><i class='fas fa-user-tie me-1'></i> Vendedor</div>" />
                  <TextElement name="vendor_name" label="Nome" />
                  <TextElement name="vendor_whatsapp" label="WhatsApp" />
                </GroupElement>

                <GroupElement name="column4_2" :columns="{ container: 12 }">
                  <ButtonElement name="submit" button-label="Filtrar" :submits="true" :columns="{ container: 6 }" />
                  <ButtonElement name="reset" button-label="Limpar" :secondary="true" :submits="false"
                    :columns="{ container: 6 }" @click="handleResetFilters" />
                </GroupElement>
              </GroupElement>
            </Vueform>
          </div>
        </div>
      </aside>

      <!-- TABELA -->
      <div class="col-lg-9">
        <div class="card ct-card">
          <div class="ct-toolbar">
            <div class="ct-segment" role="group" aria-label="Filtrar por status">
              <button v-for="opt in STATUS_OPTIONS" :key="String(opt.value)" type="button" class="ct-segment-btn"
                :class="{ 'is-active': statusFilter === opt.value }" @click="setStatus(opt.value)">
                <i :class="opt.icon" class="me-1"></i>{{ opt.label }}
              </button>
            </div>

            <div v-if="activeFilterCount" class="ct-chips">
              <span v-for="chip in activeChips" :key="chip.key" class="ct-chip">
                {{ chip.label }}: <strong>{{ chip.text }}</strong>
                <button type="button" class="ct-chip-x" :aria-label="`Remover filtro ${chip.label}`"
                  @click="removeChip(chip.key)">
                  <i class="fas fa-xmark"></i>
                </button>
              </span>
              <button type="button" class="ct-clear-all" @click="handleResetFilters">Limpar tudo</button>
            </div>
          </div>

          <div class="ct-table-wrap" @click="onTableClick">
            <DataTable ref="dtRef" class="table ct-table align-items-center mb-0" :columns="columns"
              :options="options" :ajax="ajaxTickets" />
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL CANHOTO (teleportado para o body para ficar acima do sidebar) -->
    <Teleport to="body">
      <BaseModal class="ct-page ct-modal" v-model="showMirrorModal" title="Canhoto" size="xl"
        @close="closeMirrorModal">
        <div class="ct-layout">
          <!-- Visualizador -->
          <div class="ct-viewer-col">
            <div v-if="mirrorUrl && !mirrorLoadError" class="ct-viewer-wrap">
              <div class="ct-zoom-bar">
                <button class="ct-tool-btn" type="button" @click="zoomOut" :disabled="mirrorZoom <= MIN_ZOOM"
                  title="Diminuir zoom (-)">
                  <i class="fas fa-magnifying-glass-minus"></i>
                </button>

                <input type="range" class="ct-zoom-range" min="1" max="4" step="0.05" :value="mirrorZoom"
                  aria-label="Nível de zoom" @input="onZoomSlider" />

                <button class="ct-tool-btn" type="button" @click="zoomIn" :disabled="mirrorZoom >= MAX_ZOOM"
                  title="Aumentar zoom (+)">
                  <i class="fas fa-magnifying-glass-plus"></i>
                </button>

                <button class="ct-zoom-value" type="button" @click="resetZoom" title="Ajustar à tela (0)">
                  {{ mirrorZoomPercent }}%
                </button>

                <span class="ct-divider"></span>

                <button class="ct-tool-btn" type="button" @click="rotate(-90)" title="Girar à esquerda">
                  <i class="fas fa-rotate-left"></i>
                </button>
                <button class="ct-tool-btn" type="button" @click="rotate(90)" title="Girar à direita (R)">
                  <i class="fas fa-rotate-right"></i>
                </button>
              </div>

              <div ref="mirrorViewerRef" class="ct-image-container" @wheel="handleImageWheel"
                @mousedown="handleImageMouseDown" @mousemove="handleImageMouseMove" @mouseup="handleImageMouseUp"
                @mouseleave="handleImageMouseUp">
                <div v-if="!mirrorImageLoaded" class="ct-viewer-skeleton">
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  <span>Carregando canhoto…</span>
                </div>
                <img ref="mirrorImgRef" :src="mirrorUrl" alt="Canhoto" class="ct-image"
                  :class="{ 'is-visible': mirrorImageLoaded }" :style="mirrorImageStyle" draggable="false"
                  @load="onMirrorImageLoad" @error="handleMirrorImageError" @dblclick="handleImageDoubleClick" />
              </div>

              <small class="ct-viewer-hint">
                <i class="fas fa-computer-mouse me-1"></i>Scroll: zoom no cursor · Arraste: mover · Setas: navegar ·
                +/−: zoom · 0: ajustar · R: girar
              </small>
            </div>

            <div v-if="mirrorLoadError" class="alert alert-warning mb-0">
              Não foi possível carregar a imagem.
              <div class="mt-2">
                <a :href="mirrorUrl" target="_blank" rel="noopener">Abrir imagem em nova aba</a>
              </div>
            </div>

            <div v-if="!mirrorUrl && !mirrorLoadError" class="text-muted text-center py-4">Sem imagem.</div>
          </div>

          <!-- Informações da cartela -->
          <aside class="ct-side-col">
            <div class="ct-info-tile">
              <span class="ct-info-label"><i class="fas fa-ticket me-1"></i>Cartela</span>
              <span class="ct-info-value">{{ mirrorTicketNumber || "-" }}</span>
            </div>
            <div class="ct-info-tile">
              <span class="ct-info-label"><i class="fas fa-calendar-check me-1"></i>Validada em</span>
              <span class="ct-info-value">{{ formatValidatedDate(mirrorTicketValidatedDate) }}</span>
            </div>
            <div v-if="mirrorWhatsappSenderNumber || mirrorWhatsappSenderName" class="ct-info-tile">
              <span class="ct-info-label"><i class="fas fa-user me-1"></i>Contato</span>
              <span class="ct-info-value d-block">{{ mirrorWhatsappSenderName || "-" }}</span>
              <a v-if="mirrorWhatsappLink" :href="mirrorWhatsappLink" target="_blank" rel="noopener"
                class="ct-wa-link">
                <i class="fab fa-whatsapp"></i> {{ formatPhoneBR(mirrorWhatsappSenderNumber) }}
              </a>
            </div>
          </aside>
        </div>

        <template #footer>
          <div class="ct-modal-footer">
            <a v-if="mirrorOriginalUrl" :href="mirrorOriginalUrl" target="_blank" rel="noopener"
              class="btn btn-outline-primary mb-0">
              <i class="fas fa-up-right-from-square me-1"></i>Abrir original
            </a>
            <div class="ms-auto d-flex gap-2">
              <button v-if="isAdmin" class="btn btn-danger mb-0" type="button" @click="confirmInvalidate">
                <i class="fas fa-trash me-1"></i>Desvalidar
              </button>
              <button class="btn btn-outline-dark mb-0" type="button" @click="closeMirrorModal">
                Fechar
              </button>
            </div>
          </div>
        </template>
      </BaseModal>
    </Teleport>
  </div>
</template>

<style>
/* Estilos não-scoped: o DataTables gera o HTML das células fora do alcance do data-v do Vue */
.ct-page {
  --ct-primary: #5e72e4;
  --ct-primary-2: #825ee4;
  --ct-success: #2dce89;
  --ct-text: #f1f3f9;
  --ct-muted: rgba(255, 255, 255, 0.55);
  --ct-border: rgba(255, 255, 255, 0.08);
  --ct-surface: rgba(255, 255, 255, 0.04);
  --ct-surface-2: rgba(255, 255, 255, 0.08);
}

/* HERO */
.ct-page .ct-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
  border-radius: 1rem;
  color: #fff;
  background: linear-gradient(135deg, var(--ct-primary) 0%, var(--ct-primary-2) 100%);
  box-shadow: 0 12px 28px -12px rgba(94, 114, 228, 0.6);
}
.ct-page .ct-hero::before,
.ct-page .ct-hero::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}
.ct-page .ct-hero::before {
  width: 280px;
  height: 280px;
  top: -140px;
  right: -60px;
}
.ct-page .ct-hero::after {
  width: 180px;
  height: 180px;
  bottom: -110px;
  left: 35%;
}
.ct-page .ct-hero > * {
  position: relative;
  z-index: 1;
}
.ct-page .ct-hero-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.ct-page .ct-hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}
.ct-page .ct-hero-title {
  margin: 0;
  font-weight: 700;
  color: #fff;
}
.ct-page .ct-hero-sub {
  opacity: 0.85;
  font-size: 0.9rem;
}
.ct-page .ct-hero-stats {
  display: flex;
  gap: 0.75rem;
}
.ct-page .ct-stat {
  min-width: 110px;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
}
.ct-page .ct-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  animation: ct-pop 0.35s ease;
}
.ct-page .ct-stat-label {
  font-size: 0.75rem;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ct-page .ct-refresh {
  border: 0;
  border-radius: 999px;
  padding: 0.55rem 1.2rem;
  font-weight: 600;
  color: var(--ct-primary);
  background: #fff;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.ct-page .ct-refresh:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.25);
}
.ct-page .ct-refresh:disabled {
  opacity: 0.8;
}
.ct-page .ct-refresh.is-spinning i {
  animation: ct-spin 0.9s linear infinite;
}

/* FILTROS */
.ct-page .ct-filters-card {
  position: sticky;
  top: 90px;
  overflow: hidden;
}
.ct-page .ct-filters-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border: 0;
  background: transparent;
  font-weight: 700;
  color: var(--ct-text);
  text-align: left;
}
.ct-page .ct-chevron {
  color: var(--ct-muted);
  transition: transform 0.25s;
}
.ct-page .ct-filters-card.is-collapsed .ct-chevron {
  transform: rotate(-180deg);
}
.ct-page .ct-filters-body {
  padding: 0 1.25rem 1.25rem;
}
.ct-page .ct-filters-card.is-collapsed .ct-filters-body {
  display: none;
}
.ct-page .ct-section-title {
  margin: 0.5rem 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ct-muted);
}

/* Desktop: filtros sempre visíveis e fixos ao rolar */
@media (min-width: 992px) {
  .ct-page .ct-filters-head {
    cursor: default;
  }
  .ct-page .ct-chevron {
    display: none;
  }
  .ct-page .ct-filters-body,
  .ct-page .ct-filters-card.is-collapsed .ct-filters-body {
    display: block;
  }
}

/* TOOLBAR */
.ct-page .ct-card {
  overflow: hidden;
}
.ct-page .ct-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--ct-border);
}
.ct-page .ct-segment {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background: var(--ct-surface-2);
}
.ct-page .ct-segment-btn {
  border: 0;
  padding: 0.4rem 0.9rem;
  border-radius: 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ct-muted);
  background: transparent;
  transition: all 0.2s;
}
.ct-page .ct-segment-btn:hover {
  color: var(--ct-text);
}
.ct-page .ct-segment-btn.is-active {
  color: var(--ct-primary);
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.ct-page .ct-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.ct-page .ct-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.3rem 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: #c7d2fe;
  background: rgba(94, 114, 228, 0.25);
  animation: ct-pop 0.25s ease;
}
.ct-page .ct-chip-x {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  font-size: 0.6rem;
  color: #fff;
  background: var(--ct-primary);
  display: inline-grid;
  place-items: center;
}
.ct-page .ct-clear-all {
  border: 0;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: #f5365c;
  text-decoration: underline;
}

/* TABELA */
.ct-page .ct-table-wrap {
  position: relative;
  padding: 0.5rem 1rem 1rem;
}
.ct-page .ct-table thead th {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ct-muted);
  background: var(--ct-surface);
  border-bottom: 1px solid var(--ct-border) !important;
}
.ct-page .ct-table td {
  vertical-align: middle;
  font-size: 0.9rem;
  color: var(--ct-text);
}
.ct-page .ct-table tbody tr {
  transition: background 0.15s, box-shadow 0.15s;
  animation: ct-row-in 0.3s ease both;
}
.ct-page .ct-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 3px 0 0 var(--ct-primary);
}
.ct-page .ct-table-wrap .dt-processing {
  background: rgba(15, 23, 41, 0.6);
  backdrop-filter: blur(2px);
  border-radius: 0.75rem;
}
.ct-page .ct-ticket {
  padding: 0.2rem 0.55rem;
  border-radius: 0.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--ct-surface-2);
}
.ct-page .ct-date {
  font-variant-numeric: tabular-nums;
  color: var(--ct-muted);
}
.ct-page .ct-muted {
  color: var(--ct-muted);
}
.ct-page .ct-vendor {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.ct-page .ct-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--ct-primary), var(--ct-primary-2));
}
.ct-page .ct-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border: 0;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ct-page .ct-pill-ok {
  color: #1a9f6b;
  background: rgba(45, 206, 137, 0.15);
}
.ct-page .ct-pill-off {
  color: var(--ct-muted);
  background: var(--ct-surface-2);
}
.ct-page button.ct-pill-ok:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(45, 206, 137, 0.3);
}
.ct-page .ct-pill-ok.is-disabled {
  opacity: 0.6;
}
.ct-page .ct-pill-action {
  opacity: 0.7;
}

/* ===== MODAL CANHOTO (tela cheia, sem scroll) ===== */
.ct-page.ct-modal .modal {
  overflow: hidden;
  z-index: 10000;
}
.ct-page.ct-modal .modal-backdrop {
  z-index: 9999;
}
/* Alertas do SweetAlert2 (enviados ao body) precisam ficar acima do modal */
.swal2-container {
  z-index: 10100 !important;
}
.ct-page.ct-modal .modal-dialog {
  height: 100vh;
  height: 100dvh;
  max-width: min(1400px, 100vw);
  margin: 0 auto;
}
.ct-page.ct-modal .modal-content {
  height: 100%;
  border: 0;
  border-radius: 0;
}
.ct-page.ct-modal .modal-header,
.ct-page.ct-modal .modal-footer {
  padding: 0.75rem 1.25rem;
}
.ct-page.ct-modal .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1.25rem;
}

.ct-page .ct-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
}
.ct-page .ct-viewer-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ct-page .ct-viewer-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ct-page .ct-side-col {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ct-page .ct-info-tile {
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--ct-border);
  border-radius: 0.75rem;
  background: var(--ct-surface);
}
.ct-page .ct-info-label {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ct-muted);
}
.ct-page .ct-info-value {
  display: block;
  font-weight: 600;
  color: var(--ct-text);
}
.ct-page .ct-wa-link {
  display: inline-block;
  margin-top: 0.15rem;
  font-size: 0.85rem;
  color: #1a9f6b;
  text-decoration: none;
}
.ct-page .ct-wa-link:hover {
  text-decoration: underline;
}

/* Barra de ferramentas do visualizador */
.ct-page .ct-zoom-bar {
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--ct-surface-2);
}
.ct-page .ct-tool-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  color: var(--ct-text);
  background: rgba(255, 255, 255, 0.1);
  display: grid;
  place-items: center;
  transition: background 0.2s, opacity 0.2s;
}
.ct-page .ct-tool-btn:hover:not(:disabled) {
  background: var(--ct-primary);
}
.ct-page .ct-tool-btn:disabled {
  opacity: 0.35;
}
.ct-page .ct-zoom-range {
  width: 150px;
  accent-color: var(--ct-primary);
  cursor: pointer;
}
.ct-page .ct-zoom-value {
  min-width: 60px;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ct-text);
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: background 0.2s;
}
.ct-page .ct-zoom-value:hover {
  background: rgba(255, 255, 255, 0.1);
}
.ct-page .ct-divider {
  width: 1px;
  height: 22px;
  margin: 0 0.25rem;
  background: var(--ct-border);
}

/* Imagem ocupa o espaço disponível, sem altura fixa */
.ct-page .ct-image-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #0f1729;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ct-page .ct-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center;
  will-change: transform;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ct-page .ct-image.is-visible {
  opacity: 1;
}
.ct-page .ct-viewer-skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #fff;
  opacity: 0.8;
}
.ct-page .ct-viewer-hint {
  text-align: center;
  color: var(--ct-muted);
  font-size: 0.8rem;
}
.ct-page .ct-modal-footer {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 991px) {
  .ct-page .ct-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .ct-page .ct-side-col {
    overflow-y: visible;
  }
}

/* ANIMAÇÕES */
@keyframes ct-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ct-pop {
  0% {
    opacity: 0.4;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes ct-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ct-page *,
  .ct-page *::before,
  .ct-page *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
