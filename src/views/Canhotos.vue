<script setup>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

import api from "@/services/api";
import BaseModal from "@/views/components/BaseModal.vue";
import Swal from "sweetalert2";
import { DateTime } from "luxon";

const store = useStore();
const isAdmin = computed(() => store.state.auth.user?.role === "admin");

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
const showCanhotoModal = ref(false);
const canhotoUrl = ref("");
const canhotoMessageId = ref("");
const canhotoSenderNumber = ref("");
const canhotoSenderName = ref("");
const canhotoSentAt = ref("");
const canhotoLoadError = ref(false);
const canhotoRowData = ref(null);
const canhotoOriginalUrl = ref("");
const canhotoAttemptedFallback = ref(false);
const manualTicketNumber = ref("");
const validatingManual = ref(false);
const rejectingMessage = ref(false);

// Zoom e drag
const canhotoZoom = ref(1);
const canhotoOffsetX = ref(0);
const canhotoOffsetY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartOffsetX = ref(0);
const dragStartOffsetY = ref(0);
const imgRef = ref(null);

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

const STORAGE_BASE = "https://files.showdepremios.cloud/tickets/";

function formatDate(dateString) {
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
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) cleaned = cleaned.slice(2);
  if (cleaned.length !== 10 && cleaned.length !== 11) return phone;
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

function openCanhotoModal(row) {
  if (!row?.filename) return;

  canhotoLoadError.value = false;
  canhotoAttemptedFallback.value = false;
  canhotoMessageId.value = row.message_id ?? "";
  canhotoSenderNumber.value = row.sender_number ?? "";
  canhotoSenderName.value = row.sender_name ?? "";
  canhotoSentAt.value = row.sent_at ?? "";
  canhotoRowData.value = row;
  manualTicketNumber.value = "";
  validatingManual.value = false;

  const filename = encodeURIComponent(String(row.filename).trim());
  canhotoOriginalUrl.value = `${STORAGE_BASE}${filename}`;
  canhotoUrl.value = canhotoOriginalUrl.value;

  showCanhotoModal.value = true;
}

function handleCanhotoImageError() {
  if (canhotoAttemptedFallback.value) {
    canhotoLoadError.value = true;
    return;
  }

  const url = canhotoUrl.value;
  let fallbackUrl = "";

  if (url.endsWith(".jpeg")) {
    fallbackUrl = url.slice(0, -5) + ".jpg";
  } else if (url.endsWith(".jpg")) {
    fallbackUrl = url.slice(0, -4) + ".jpeg";
  }

  if (fallbackUrl) {
    canhotoAttemptedFallback.value = true;
    canhotoUrl.value = fallbackUrl;
  } else {
    canhotoLoadError.value = true;
  }
}

function closeCanhotoModal() {
  showCanhotoModal.value = false;
  canhotoUrl.value = "";
  canhotoOriginalUrl.value = "";
  canhotoMessageId.value = "";
  canhotoLoadError.value = false;
  canhotoAttemptedFallback.value = false;
  canhotoRowData.value = null;
  canhotoSenderNumber.value = "";
  canhotoSenderName.value = "";
  canhotoSentAt.value = "";
  manualTicketNumber.value = "";
  validatingManual.value = false;
  resetZoom();
}

// Funções de zoom
function resetZoom() {
  canhotoZoom.value = 1;
  canhotoOffsetX.value = 0;
  canhotoOffsetY.value = 0;
}

function zoomIn() {
  if (canhotoZoom.value < MAX_ZOOM) {
    canhotoZoom.value = Math.min(canhotoZoom.value + ZOOM_STEP, MAX_ZOOM);
  }
}

function zoomOut() {
  if (canhotoZoom.value > MIN_ZOOM) {
    canhotoZoom.value = Math.max(canhotoZoom.value - ZOOM_STEP, MIN_ZOOM);
    if (canhotoZoom.value === MIN_ZOOM) {
      resetZoom();
    }
  }
}

function handleImageWheel(e) {
  if (!imgRef.value) return;
  e.preventDefault();

  // Calcula o delta de forma contínua (mais suave)
  const scrollDelta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, canhotoZoom.value + scrollDelta));

  canhotoZoom.value = newZoom;
}

function handleImageMouseDown(e) {
  if (canhotoZoom.value === MIN_ZOOM) return;

  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  dragStartOffsetX.value = canhotoOffsetX.value;
  dragStartOffsetY.value = canhotoOffsetY.value;
}

function handleImageMouseMove(e) {
  if (!isDragging.value || !imgRef.value) return;

  const deltaX = e.clientX - dragStartX.value;
  const deltaY = e.clientY - dragStartY.value;

  canhotoOffsetX.value = dragStartOffsetX.value + deltaX;
  canhotoOffsetY.value = dragStartOffsetY.value + deltaY;
}

function handleImageMouseUp() {
  isDragging.value = false;
}

function handleImageDoubleClick() {
  if (canhotoZoom.value > MIN_ZOOM) {
    resetZoom();
  } else {
    canhotoZoom.value = 2;
  }
}

const imageStyle = computed(() => ({
  transform: `translate(${canhotoOffsetX.value}px, ${canhotoOffsetY.value}px) scale(${canhotoZoom.value})`,
  cursor: canhotoZoom.value > MIN_ZOOM ? (isDragging.value ? "grabbing" : "grab") : "default",
  transition: isDragging.value ? "none" : "transform 0.1s ease-out",
}));

async function confirmManualValidate() {
  if (!manualTicketNumber.value || !canhotoMessageId.value) {
    await Swal.fire({
      icon: "warning",
      title: "Erro",
      text: "Digite o número do canhoto para validar",
    });
    return;
  }

  const result = await Swal.fire({
    icon: "question",
    title: "Confirmar Validação Manual",
    text: `Deseja validar manualmente o canhoto "${manualTicketNumber.value}"?`,
    showCancelButton: true,
    confirmButtonText: "Sim, validar",
    cancelButtonText: "Cancelar",
  });

  if (result.isConfirmed) {
    await manualValidateTicket();
  }
}

async function manualValidateTicket() {
  if (!manualTicketNumber.value || !canhotoMessageId.value) return;

  validatingManual.value = true;

  try {
    const { data } = await api.post("/ticket-whatsapp-messages/manual-validate", {
      message_id: canhotoMessageId.value,
      ticket_number: manualTicketNumber.value,
    });

    if (data?.success) {
      await Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: `Canhoto ${manualTicketNumber.value} validado com sucesso!`,
      });

      closeCanhotoModal();
      reloadTable();
      return;
    }

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: data?.message || "Erro ao validar o canhoto.",
    });
  } catch (error) {
    const message = error?.response?.data?.message || "Erro ao validar o canhoto.";

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: message,
    });
  } finally {
    validatingManual.value = false;
  }
}

async function confirmRejectMessage() {
  if (!canhotoMessageId.value) return;

  const result = await Swal.fire({
    icon: "warning",
    title: "Rejeitar Canhoto",
    text: `Tem certeza que deseja rejeitar este canhoto? Esta ação não pode ser desfeita.`,
    showCancelButton: true,
    confirmButtonText: "Sim, rejeitar",
    confirmButtonColor: "#dc3545",
    cancelButtonText: "Cancelar",
  });

  if (result.isConfirmed) {
    await rejectMessage();
  }
}

async function rejectMessage() {
  if (!canhotoMessageId.value) return;

  rejectingMessage.value = true;

  try {
    const { data } = await api.post("/ticket-whatsapp-messages/reject", {
      message_id: canhotoMessageId.value,
    });

    if (data?.success) {
      await Swal.fire({
        icon: "success",
        title: "Sucesso",
        text: "Canhoto rejeitado com sucesso!",
      });

      closeCanhotoModal();
      reloadTable();
      return;
    }

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: data?.message || "Erro ao rejeitar o canhoto.",
    });
  } catch (error) {
    const message = error?.response?.data?.message || "Erro ao rejeitar o canhoto.";

    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: message,
    });
  } finally {
    rejectingMessage.value = false;
  }
}

// ===== Filters =====
const filterForm = ref(null);
const filters = ref({});

const handleFilter = (form$) => {
  filters.value = { ...form$.requestData };
  setTableLoading(true);
  reloadTable();
};

const handleResetFilters = () => {
  filters.value = {};
  if (filterForm.value) filterForm.value.reset();
  setTableLoading(true);
  reloadTable();
};

// ===== Columns =====
const columns = [
  { data: "message_id", title: "ID Mensagem", name: "message_id" },
  { data: "sender_number", title: "Telefone", name: "sender_number" },
  { data: "sender_name", title: "Nome", name: "sender_name" },
  {
    data: "sent_at",
    title: "Data Envio",
    name: "sent_at",
    render: (_val) => formatDate(_val),
  },
  {
    data: null,
    title: "Canhoto",
    name: "filename",
    orderable: false,
    render: (_d, _t, row) => {
      const hasFile = !!row?.filename;
      const disabledStyle = hasFile ? "" : "opacity:0.6; pointer-events:none;";
      const title = hasFile ? "Ver canhoto" : "Sem canhoto";

      return `
        <a href="#"
           class="badge bg-info text-decoration-none js-open-canhoto"
           style="cursor:pointer; ${disabledStyle}"
           title="${title}">
          Ver
        </a>
      `;
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
async function ajaxCanhotos(dtRequest, callback) {
  try {
    const length = dtRequest.length || 30;
    const page = Math.floor((dtRequest.start || 0) / length) + 1;

    const endpoint = "/ticket-whatsapp-messages";
    const rawFilters = filters.value || {};

    const params = Object.keys(rawFilters).reduce((acc, key) => {
      const value = rawFilters[key];
      const normalized =
        value && typeof value === "object" && "value" in value ? value.value : value;

      if (
        normalized === null ||
        normalized === undefined ||
        normalized === "" ||
        normalized === false
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

// ===== capture click inside DataTables =====
function onTableClick(e) {
  const el = e.target?.closest?.(".js-open-canhoto");
  if (!el) return;

  e.preventDefault();

  const dt = dtRef.value?.dt;
  if (!dt) return;

  let tr = el.closest("tr");
  if (!tr) return;

  if (tr.classList.contains("child")) {
    tr = tr.previousElementSibling;
  }

  const rowData = dt.row(tr).data();

  if (!rowData?.filename) return;
  openCanhotoModal(rowData);
}
</script>

<template>
  <div class="py-4 container-fluid">
    <!-- Alert informativo -->
    <div class="alert alert-info alert-dismissible fade show" role="alert">
      <strong>Atenção:</strong> Esta página exibe apenas os canhotos rejeitados (não validados) pendentes de validação manual.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>

    <div class="row">
      <div class="col-md-12 mb-lg-0 mb-4">
        <div class="card">
          <div class="card-header pb-0">
            <div class="row">
              <div class="col-6 d-flex align-items-center">
                <h6 class="mb-0">Canhotos Rejeitados</h6>
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
              <!-- FILTROS -->
              <div class="col-3 canhotos-filters">
                <Vueform ref="filterForm" :endpoint="false" @submit="handleFilter">
                  <GroupElement name="container">
                    <GroupElement name="column1" :columns="{ container: 12 }">
                      <TextElement name="sender_number" label="Telefone" />
                      <TextElement name="sender_name" label="Nome" />
                      <TextElement name="sent_at" label="Data Envio" input-type="date" />
                    </GroupElement>

                    <GroupElement name="column2" :columns="{ container: 12 }">
                      <ButtonElement name="submit" button-label="Filtrar" :submits="true" :columns="{ container: 6 }" />
                      <ButtonElement name="reset" button-label="Limpar" :secondary="true" :submits="false"
                        :columns="{ container: 6 }" @click="handleResetFilters" />
                    </GroupElement>
                  </GroupElement>
                </Vueform>
              </div>

              <!-- TABELA -->
              <div class="col-9 canhotos-table">
                <div @click="onTableClick">
                  <DataTable ref="dtRef" class="table table-striped table-hover align-items-center mb-0"
                    :columns="columns" :options="options" :ajax="ajaxCanhotos" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL CANHOTO -->
    <BaseModal v-model="showCanhotoModal" title="Validar Canhoto" @close="closeCanhotoModal">
      <div class="mb-3">
        <strong>Contato:</strong> {{ canhotoSenderName || "-" }}
        <br><strong>Telefone:</strong> {{ formatPhoneBR(canhotoSenderNumber) }}
        <br><strong>Data Envio:</strong> {{ formatDate(canhotoSentAt) }}
      </div>

      <div v-if="canhotoUrl && !canhotoLoadError" class="text-center mb-3">
        <!-- Controles de Zoom -->
        <div class="mb-2 d-flex justify-content-center gap-2">
          <button
            class="btn btn-sm btn-outline-dark"
            type="button"
            @click="zoomOut"
            :disabled="canhotoZoom <= MIN_ZOOM"
            title="Diminuir zoom"
          >
            <i class="fas fa-minus"></i>
          </button>

          <span class="align-self-center" style="min-width: 60px; font-size: 0.85rem;">
            {{ Math.round(canhotoZoom * 100) }}%
          </span>

          <button
            class="btn btn-sm btn-outline-dark"
            type="button"
            @click="zoomIn"
            :disabled="canhotoZoom >= MAX_ZOOM"
            title="Aumentar zoom"
          >
            <i class="fas fa-plus"></i>
          </button>

          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            @click="resetZoom"
            :disabled="canhotoZoom === MIN_ZOOM"
            title="Resetar zoom"
          >
            <i class="fas fa-redo"></i>
          </button>
        </div>

        <!-- Área da imagem com zoom e drag -->
        <div
          class="canhoto-image-container"
          @wheel="handleImageWheel"
          @mousedown="handleImageMouseDown"
          @mousemove="handleImageMouseMove"
          @mouseup="handleImageMouseUp"
          @mouseleave="handleImageMouseUp"
        >
          <img
            ref="imgRef"
            :src="canhotoUrl"
            alt="Canhoto"
            class="canhoto-image"
            :style="imageStyle"
            @error="handleCanhotoImageError"
            @dblclick="handleImageDoubleClick"
          />
        </div>

        <small class="text-muted d-block mt-2">
          💡 Scroll para zoom | Arraste para mover | Duplo clique para zoom automático
        </small>
      </div>

      <div v-if="canhotoLoadError" class="alert alert-warning text-start mb-3">
        Não foi possível carregar a imagem.
        <div class="mt-2">
          <a :href="canhotoUrl" target="_blank" rel="noopener">Abrir imagem em nova aba</a>
        </div>
      </div>

      <div v-else class="text-muted mb-3">Sem imagem.</div>

      <!-- Campo para digitar ticket_number -->
      <div class="form-group mb-3">
        <label class="form-label" for="manualTicketInput">Número do Canhoto</label>
        <input
          id="manualTicketInput"
          v-model="manualTicketNumber"
          type="text"
          class="form-control"
          placeholder="Digite apenas números"
          @keypress.enter="confirmManualValidate"
          inputmode="numeric"
          pattern="[0-9]*"
        />
        <small class="text-muted">Digite apenas números</small>
      </div>

      <template #footer>
        <div class="d-flex gap-2">
          <button
            v-if="isAdmin"
            class="btn btn-success mb-0"
            type="button"
            @click="confirmManualValidate"
            :disabled="validatingManual || !manualTicketNumber"
          >
            <i v-if="!validatingManual" class="fas fa-check"></i>
            <i v-else class="fas fa-spinner fa-spin"></i>
            &nbsp;&nbsp;Validar
          </button>
          <button
            v-if="isAdmin"
            class="btn btn-danger mb-0"
            type="button"
            @click="confirmRejectMessage"
            :disabled="rejectingMessage"
          >
            <i v-if="!rejectingMessage" class="fas fa-times"></i>
            <i v-else class="fas fa-spinner fa-spin"></i>
            &nbsp;&nbsp;Rejeitar
          </button>
          <button class="btn btn-outline-dark mb-0" type="button" @click="closeCanhotoModal">
            Fechar
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.canhotos-filters {
  border-right: 1px solid #e0e0e0;
  padding-right: 1.5rem;
}

/* Estilos para zoom e drag de imagem */
.canhoto-image-container {
  display: inline-block;
  max-width: 100%;
  max-height: 60vh;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 0.375rem;
  background: #f8f9fa;
  position: relative;
  user-select: none;
}

.canhoto-image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  transform-origin: center;
  will-change: transform;
}

@media (max-width: 768px) {
  .canhotos-filters {
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
    padding-right: 0;
    padding-bottom: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .canhotos-filters .col-9 {
    width: 100%;
  }

  .canhoto-image-container {
    max-height: 50vh;
  }

  .canhoto-image {
    max-height: 50vh;
  }
}
</style>
