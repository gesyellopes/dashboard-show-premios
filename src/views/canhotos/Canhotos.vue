<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

import api from "@/services/api";
import BaseModal from "@/components/common/BaseModal.vue";
import Swal from "sweetalert2";
import { DateTime } from "luxon";

const store = useStore();
const isAdmin = computed(() => store.state.auth.user?.role === "admin");

DataTable.use(DataTablesCore);

// ===== Estado geral da página =====
const totalRecords = ref(0);
const isLoading = ref(false);
const filtersOpen = ref(true);

const FILTER_LABELS = {
  sender_number: "Telefone",
  sender_name: "Nome",
  sent_at: "Data",
};

// A API filtra um único dia por sent_at, então os atalhos são datas fixas
const DATE_PRESETS = [
  { key: "all", label: "Todos", icon: "fas fa-infinity", value: () => null },
  { key: "today", label: "Hoje", icon: "fas fa-sun", value: () => DateTime.now().toISODate() },
  {
    key: "yesterday",
    label: "Ontem",
    icon: "fas fa-moon",
    value: () => DateTime.now().minus({ days: 1 }).toISODate(),
  },
];

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ===== DataTables refs/helpers =====
const dtRef = ref(null);

// recarrega mantendo a página atual (botão Recarregar e após ações no modal)
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
const showCanhotoModal = ref(false);
const canhotoUrl = ref("");
const canhotoMessageId = ref("");
const canhotoSenderNumber = ref("");
const canhotoSenderName = ref("");
const canhotoSentAt = ref("");
const canhotoLoadError = ref(false);
const canhotoImageLoaded = ref(false);
const canhotoRowData = ref(null);
const canhotoOriginalUrl = ref("");
const canhotoAttemptedFallback = ref(false);
const manualTicketNumber = ref("");
const validatingManual = ref(false);
const rejectingMessage = ref(false);

// Zoom, pan e rotação
const canhotoZoom = ref(1);
const canhotoOffsetX = ref(0);
const canhotoOffsetY = ref(0);
const canhotoRotation = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartOffsetX = ref(0);
const dragStartOffsetY = ref(0);
const imgRef = ref(null);
const viewerRef = ref(null);

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const WHEEL_STEP = 0.2;
const PAN_STEP = 40;

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

function formatRelative(dateString) {
  if (!dateString) return "";
  const dt = DateTime.fromISO(dateString).setLocale("pt-BR");
  return dt.isValid ? dt.toRelative() : "";
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

const canhotoWhatsappLink = computed(() => whatsappLink(canhotoSenderNumber.value));

function openCanhotoModal(row) {
  if (!row?.filename) return;

  canhotoLoadError.value = false;
  canhotoAttemptedFallback.value = false;
  canhotoImageLoaded.value = false;
  canhotoMessageId.value = row.message_id ?? "";
  canhotoSenderNumber.value = row.sender_number ?? "";
  canhotoSenderName.value = row.sender_name ?? "";
  canhotoSentAt.value = row.sent_at ?? "";
  canhotoRowData.value = row;
  manualTicketNumber.value = "";
  validatingManual.value = false;
  resetView();

  const filename = encodeURIComponent(String(row.filename).trim());
  canhotoOriginalUrl.value = `${STORAGE_BASE}${filename}`;
  canhotoUrl.value = canhotoOriginalUrl.value;

  showCanhotoModal.value = true;
}

function onCanhotoImageLoad() {
  canhotoImageLoaded.value = true;
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
    canhotoImageLoaded.value = false;
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
  canhotoImageLoaded.value = false;
  canhotoAttemptedFallback.value = false;
  canhotoRowData.value = null;
  canhotoSenderNumber.value = "";
  canhotoSenderName.value = "";
  canhotoSentAt.value = "";
  manualTicketNumber.value = "";
  validatingManual.value = false;
  resetView();
}

// ===== Zoom, pan e rotação =====
function resetZoom() {
  canhotoZoom.value = 1;
  canhotoOffsetX.value = 0;
  canhotoOffsetY.value = 0;
}

function resetView() {
  resetZoom();
  canhotoRotation.value = 0;
}

// limite de arraste: o quanto da imagem ampliada passa da área visível
function getPanLimits(zoom) {
  const container = viewerRef.value;
  const img = imgRef.value;
  if (!container || !img) return { x: 0, y: 0 };

  const quarterTurn = Math.abs(canhotoRotation.value / 90) % 2 === 1;
  const imgW = quarterTurn ? img.offsetHeight : img.offsetWidth;
  const imgH = quarterTurn ? img.offsetWidth : img.offsetHeight;

  return {
    x: Math.max(0, (imgW * zoom - container.clientWidth) / 2),
    y: Math.max(0, (imgH * zoom - container.clientHeight) / 2),
  };
}

function clampOffsets() {
  const limit = getPanLimits(canhotoZoom.value);
  canhotoOffsetX.value = clamp(canhotoOffsetX.value, -limit.x, limit.x);
  canhotoOffsetY.value = clamp(canhotoOffsetY.value, -limit.y, limit.y);
}

// zoom que mantém o ponto sob o cursor parado (sem coordenadas, usa o centro)
function setZoom(value, clientX, clientY) {
  const from = canhotoZoom.value;
  const to = clamp(Number(value.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
  if (to === from) return;

  if (to === MIN_ZOOM) {
    resetZoom();
    return;
  }

  const container = viewerRef.value;
  if (container) {
    const rect = container.getBoundingClientRect();
    const cx = clientX === undefined ? 0 : clientX - (rect.left + rect.width / 2);
    const cy = clientY === undefined ? 0 : clientY - (rect.top + rect.height / 2);
    const k = to / from;
    canhotoOffsetX.value = cx - (cx - canhotoOffsetX.value) * k;
    canhotoOffsetY.value = cy - (cy - canhotoOffsetY.value) * k;
  }

  canhotoZoom.value = to;
  clampOffsets();
}

function zoomIn() {
  setZoom(canhotoZoom.value + ZOOM_STEP);
}

function zoomOut() {
  setZoom(canhotoZoom.value - ZOOM_STEP);
}

function onZoomSlider(e) {
  setZoom(Number(e.target.value));
}

function panBy(dx, dy) {
  if (canhotoZoom.value <= MIN_ZOOM) return;
  canhotoOffsetX.value += dx;
  canhotoOffsetY.value += dy;
  clampOffsets();
}

function rotate(delta) {
  canhotoRotation.value = (canhotoRotation.value + delta + 360) % 360;
  clampOffsets();
}

function handleImageWheel(e) {
  if (!imgRef.value) return;
  e.preventDefault();

  const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
  setZoom(canhotoZoom.value + delta, e.clientX, e.clientY);
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

  canhotoOffsetX.value = dragStartOffsetX.value + (e.clientX - dragStartX.value);
  canhotoOffsetY.value = dragStartOffsetY.value + (e.clientY - dragStartY.value);
  clampOffsets();
}

function handleImageMouseUp() {
  isDragging.value = false;
}

function handleImageDoubleClick(e) {
  setZoom(canhotoZoom.value > MIN_ZOOM ? MIN_ZOOM : 2.5, e.clientX, e.clientY);
}

// atalhos de teclado enquanto o modal está aberto (ignorados ao digitar)
function handleGlobalKeydown(e) {
  if (!showCanhotoModal.value) return;
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

const imageStyle = computed(() => ({
  transform: `translate(${canhotoOffsetX.value}px, ${canhotoOffsetY.value}px) scale(${canhotoZoom.value}) rotate(${canhotoRotation.value}deg)`,
  cursor: canhotoZoom.value > MIN_ZOOM ? (isDragging.value ? "grabbing" : "grab") : "zoom-in",
  transition: isDragging.value ? "none" : "transform 0.12s ease-out",
}));

const zoomPercent = computed(() => Math.round(canhotoZoom.value * 100));

// número da cartela aceita somente dígitos (também cola e arrasta sem sujeira)
function onManualTicketInput(e) {
  const digits = e.target.value.replace(/\D/g, "");
  manualTicketNumber.value = digits;
  e.target.value = digits;
}

function onManualTicketKeydown(e) {
  const isPrintable = e.key.length === 1;
  if (isPrintable && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
}

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
// `draft` é o que o usuário está digitando; `filters` é o que já foi aplicado na tabela
const filters = ref({});
const draft = ref({ sender_name: "", sender_number: "", sent_at: null });
const lastApplied = ref("");
let applyTimer = null;

// valor normalizado (string ISO ou null) — usado pelos atalhos e pelos chips
const normalizeFilter = (raw) => (raw && typeof raw === "object" && "value" in raw ? raw.value : raw);

const activeDate = computed(() => {
  const v = normalizeFilter(filters.value.sent_at);
  return v === undefined || v === "" || v === false ? null : v;
});

const activeChips = computed(() =>
  Object.keys(FILTER_LABELS).reduce((acc, key) => {
    const value = normalizeFilter(filters.value[key]);
    if (value === null || value === undefined || value === "" || value === false) return acc;

    let text = String(value);
    if (key === "sent_at") {
      const dt = DateTime.fromISO(String(value));
      text = dt.isValid ? dt.toFormat("dd/MM/yyyy") : text;
    }

    acc.push({ key, label: FILTER_LABELS[key], text });
    return acc;
  }, [])
);

const activeFilterCount = computed(() => activeChips.value.length);

// qual atalho de data está ativo (null se a data for personalizada)
const activePreset = computed(() => {
  if (activeDate.value === null) return "all";
  return DATE_PRESETS.find((p) => p.key !== "all" && p.value() === activeDate.value)?.key ?? null;
});

// a busca por texto só começa com 3 caracteres, para não pesar a consulta
const MIN_SEARCH_CHARS = 3;

function buildFilters() {
  const name = draft.value.sender_name.trim();
  const digits = draft.value.sender_number; // somente dígitos
  return {
    sender_name: name.length >= MIN_SEARCH_CHARS ? name : null,
    sender_number: digits.length >= MIN_SEARCH_CHARS ? digits : null,
    sent_at: draft.value.sent_at || null,
  };
}

// quantos caracteres ainda faltam para a busca começar (vazio se já pode buscar)
function missingChars(value) {
  const length = value.length;
  return length > 0 && length < MIN_SEARCH_CHARS ? MIN_SEARCH_CHARS - length : 0;
}

const nameMissing = computed(() => missingChars(draft.value.sender_name.trim()));
const phoneMissing = computed(() => missingChars(draft.value.sender_number));

// aplica os filtros à tabela; ignora se nada mudou para não recarregar à toa
function applyDraft() {
  clearTimeout(applyTimer);
  const next = buildFilters();
  const serialized = JSON.stringify(next);
  if (serialized === lastApplied.value) return;

  lastApplied.value = serialized;
  filters.value = next;
  setTableLoading(true);
  reloadToFirstPage();
}

// aplica enquanto digita, com um pequeno atraso para não disparar uma requisição por tecla
function scheduleApply() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyDraft, 400);
}

watch(() => draft.value.sender_name, scheduleApply);
watch(() => draft.value.sender_number, scheduleApply);
watch(() => draft.value.sent_at, applyDraft);

// formata o telefone enquanto digita: (00) 00000-0000
function formatPhoneInput(digits) {
  const d = digits.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const phoneDisplay = computed(() => formatPhoneInput(draft.value.sender_number));

function onPhoneInput(e) {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
  draft.value.sender_number = digits;
  e.target.value = formatPhoneInput(digits);
}

const handleResetFilters = () => {
  draft.value = { sender_name: "", sender_number: "", sent_at: null };
  applyDraft();
};

// atalho de data: aplica na hora
function setDatePreset(value) {
  draft.value.sent_at = value;
  applyDraft();
}

// limpa um campo (botão × do input ou chip da toolbar)
function removeChip(key) {
  draft.value[key] = key === "sent_at" ? null : "";
  applyDraft();
}

// ===== Columns =====
const columns = [
  {
    data: "message_id",
    title: "Mensagem",
    name: "message_id",
    render: (d) =>
      d
        ? `<span class="cn-msg-id" title="${esc(d)}">${esc(d)}</span>`
        : `<span class="cn-muted">-</span>`,
  },
  {
    data: null,
    title: "Remetente",
    name: "sender",
    defaultContent: "-",
    render: (_d, _t, row) => {
      const name = row?.sender_name;
      const phone = row?.sender_number;
      const shownName = name || "Sem nome";
      const avatar = name
        ? `<span class="cn-avatar">${esc(initials(name))}</span>`
        : `<span class="cn-avatar cn-avatar-empty"><i class="fas fa-user"></i></span>`;
      return `
        <div class="cn-sender">
          ${avatar}
          <div class="cn-sender-text">
            <span class="cn-sender-name${name ? "" : " cn-muted"}">${esc(shownName)}</span>
            <span class="cn-sender-phone">${esc(formatPhoneBR(phone))}</span>
          </div>
        </div>`;
    },
  },
  {
    data: "sent_at",
    title: "Enviado em",
    name: "sent_at",
    orderable: false,
    defaultContent: "-",
    render: (val) => {
      if (!val) return `<span class="cn-muted">-</span>`;
      const relative = formatRelative(val);
      return `
        <div class="cn-date">
          <span>${esc(formatDate(val))}</span>
          ${relative ? `<small class="cn-date-rel">${esc(relative)}</small>` : ""}
        </div>`;
    },
  },
  {
    data: null,
    title: "Canhoto",
    name: "filename",
    orderable: false,
    render: (_d, _t, row) => {
      if (!row?.filename) {
        return `<span class="cn-pill cn-pill-off is-disabled" title="Sem canhoto"><i class="fas fa-image"></i> Sem arquivo</span>`;
      }
      return `
        <button type="button" class="cn-pill cn-pill-info js-open-canhoto" title="Ver canhoto">
          <i class="fas fa-eye"></i> Ver canhoto
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
    emptyTable: "Nenhum canhoto aguardando validação",
    zeroRecords: "Nenhum canhoto encontrado com esses filtros",
    info: "Exibindo _START_ a _END_ de _TOTAL_ canhotos",
    infoEmpty: "Exibindo 0 a 0 de 0 canhotos",
    processing: "Carregando canhotos...",
    paginate: { previous: "Anterior", next: "Próxima" },
  },
};

// ===== server-side ajax =====
async function ajaxCanhotos(dtRequest, callback) {
  try {
    const length = dtRequest.length || 30;
    const page = Math.floor((dtRequest.start || 0) / length) + 1;

    const endpoint = "/ticket-whatsapp-messages";
    const rawFilters = filters.value || {};

    const params = Object.keys(rawFilters).reduce((acc, key) => {
      const normalized = normalizeFilter(rawFilters[key]);

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
  <div class="py-4 container-fluid cn-page">
    <!-- HERO -->
    <section class="cn-hero mb-4">
      <div class="cn-hero-main">
        <div class="cn-hero-icon"><i class="fas fa-file-image"></i></div>
        <div>
          <h4 class="cn-hero-title">Canhotos</h4>
          <p class="cn-hero-sub mb-0">Canhotos rejeitados aguardando validação manual</p>
        </div>
      </div>

      <div class="cn-hero-stats">
        <div class="cn-stat">
          <span :key="totalRecords" class="cn-stat-value">{{ totalRecords.toLocaleString("pt-BR") }}</span>
          <span class="cn-stat-label">pendentes</span>
        </div>
        <div class="cn-stat">
          <span :key="activeFilterCount" class="cn-stat-value">{{ activeFilterCount }}</span>
          <span class="cn-stat-label">filtros ativos</span>
        </div>
      </div>

      <button type="button" class="cn-refresh" :class="{ 'is-spinning': isLoading }" :disabled="isLoading"
        @click="reloadTable">
        <i class="fas fa-rotate"></i> Recarregar
      </button>
    </section>

    <div class="row">
      <!-- FILTROS -->
      <aside class="col-lg-3 mb-4 mb-lg-0">
        <div class="card cn-filters-card" :class="{ 'is-collapsed': !filtersOpen }">
          <button type="button" class="cn-filters-head" :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen">
            <span class="cn-filters-title">
              <span class="cn-filters-title-icon"><i class="fas fa-sliders"></i></span>
              Filtros
              <span v-if="activeFilterCount" class="cn-filters-badge">{{ activeFilterCount }}</span>
            </span>
            <i class="fas fa-chevron-down cn-chevron"></i>
          </button>

          <div class="cn-filters-body">
            <!-- Nome -->
            <div class="cn-field">
              <label class="cn-field-label" for="cnSenderName">Nome do remetente</label>
              <div class="cn-input-wrap" :class="{ 'has-value': draft.sender_name }">
                <i class="fas fa-user cn-input-icon"></i>
                <input id="cnSenderName" v-model="draft.sender_name" type="text" class="cn-input-field"
                  placeholder="Ex.: Maria Silva" autocomplete="off" @keydown.enter.prevent="applyDraft" />
                <button v-if="draft.sender_name" type="button" class="cn-input-clear" aria-label="Limpar nome"
                  @click="removeChip('sender_name')">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
              <small v-if="nameMissing" class="cn-field-hint">
                Digite mais {{ nameMissing }} {{ nameMissing === 1 ? "caractere" : "caracteres" }} para pesquisar
              </small>
            </div>

            <!-- Telefone -->
            <div class="cn-field">
              <label class="cn-field-label" for="cnSenderPhone">Telefone</label>
              <div class="cn-input-wrap" :class="{ 'has-value': draft.sender_number }">
                <i class="fas fa-phone cn-input-icon"></i>
                <input id="cnSenderPhone" :value="phoneDisplay" type="text" inputmode="tel"
                  class="cn-input-field" placeholder="(00) 00000-0000" autocomplete="off"
                  @input="onPhoneInput" @keydown.enter.prevent="applyDraft" />
                <button v-if="draft.sender_number" type="button" class="cn-input-clear" aria-label="Limpar telefone"
                  @click="removeChip('sender_number')">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
              <small v-if="phoneMissing" class="cn-field-hint">
                Digite mais {{ phoneMissing }} {{ phoneMissing === 1 ? "dígito" : "dígitos" }} para pesquisar
              </small>
            </div>

            <!-- Data -->
            <div class="cn-field">
              <label class="cn-field-label" for="cnSentAt">Dia do envio</label>
              <div class="cn-input-wrap" :class="{ 'has-value': draft.sent_at }">
                <i class="fas fa-calendar-day cn-input-icon"></i>
                <input id="cnSentAt" v-model="draft.sent_at" type="date" class="cn-input-field cn-input-date" />
                <button v-if="draft.sent_at" type="button" class="cn-input-clear" aria-label="Limpar data"
                  @click="removeChip('sent_at')">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
            </div>

            <div class="cn-filters-foot">
              <span class="cn-filters-status"><i class="fas fa-bolt me-1"></i>Atualiza enquanto você digita</span>
              <button type="button" class="cn-clear-filters" :disabled="!activeFilterCount" @click="handleResetFilters">
                <i class="fas fa-eraser me-1"></i>Limpar
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- TABELA -->
      <div class="col-lg-9">
        <div class="card cn-card">
          <div class="cn-toolbar">
            <div class="cn-segment" role="group" aria-label="Filtrar por data de envio">
              <button v-for="preset in DATE_PRESETS" :key="preset.key" type="button" class="cn-segment-btn"
                :class="{ 'is-active': activePreset === preset.key }" @click="setDatePreset(preset.value())">
                <i :class="preset.icon" class="me-1"></i>{{ preset.label }}
              </button>
            </div>

            <div v-if="activeFilterCount" class="cn-chips">
              <span v-for="chip in activeChips" :key="chip.key" class="cn-chip">
                {{ chip.label }}: <strong>{{ chip.text }}</strong>
                <button type="button" class="cn-chip-x" :aria-label="`Remover filtro ${chip.label}`"
                  @click="removeChip(chip.key)">
                  <i class="fas fa-xmark"></i>
                </button>
              </span>
              <button type="button" class="cn-clear-all" @click="handleResetFilters">Limpar tudo</button>
            </div>
          </div>

          <div class="cn-table-wrap" @click="onTableClick">
            <DataTable ref="dtRef" class="table cn-table align-items-center mb-0" :columns="columns"
              :options="options" :ajax="ajaxCanhotos" />
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL CANHOTO (teleportado para o body para ficar acima do sidebar) -->
    <Teleport to="body">
      <BaseModal class="cn-page cn-modal" v-model="showCanhotoModal" title="Validar Canhoto" size="xl"
        @close="closeCanhotoModal">
        <div class="cn-info-grid">
          <div class="cn-info-tile">
            <span class="cn-info-label"><i class="fas fa-user me-1"></i>Contato</span>
            <span class="cn-info-value">{{ canhotoSenderName || "-" }}</span>
            <a v-if="canhotoWhatsappLink" :href="canhotoWhatsappLink" target="_blank" rel="noopener"
              class="cn-wa-link">
              <i class="fab fa-whatsapp"></i> {{ formatPhoneBR(canhotoSenderNumber) }}
            </a>
          </div>
          <div class="cn-info-tile">
            <span class="cn-info-label"><i class="fas fa-calendar-day me-1"></i>Enviado em</span>
            <span class="cn-info-value">{{ formatDate(canhotoSentAt) }}</span>
          </div>
          <div class="cn-info-tile">
            <span class="cn-info-label"><i class="fas fa-hashtag me-1"></i>Mensagem</span>
            <span class="cn-info-value cn-msg-id-full">{{ canhotoMessageId || "-" }}</span>
          </div>
        </div>

        <div class="cn-layout">
          <!-- Visualizador -->
          <div class="cn-viewer-col">
            <div v-if="canhotoUrl && !canhotoLoadError" class="cn-viewer-wrap">
              <div class="cn-zoom-bar">
                <button class="cn-tool-btn" type="button" @click="zoomOut" :disabled="canhotoZoom <= MIN_ZOOM"
                  title="Diminuir zoom (-)">
                  <i class="fas fa-magnifying-glass-minus"></i>
                </button>

                <input type="range" class="cn-zoom-range" min="1" max="4" step="0.05" :value="canhotoZoom"
                  aria-label="Nível de zoom" @input="onZoomSlider" />

                <button class="cn-tool-btn" type="button" @click="zoomIn" :disabled="canhotoZoom >= MAX_ZOOM"
                  title="Aumentar zoom (+)">
                  <i class="fas fa-magnifying-glass-plus"></i>
                </button>

                <button class="cn-zoom-value" type="button" @click="resetZoom" title="Ajustar à tela (0)">
                  {{ zoomPercent }}%
                </button>

                <span class="cn-divider"></span>

                <button class="cn-tool-btn" type="button" @click="rotate(-90)" title="Girar à esquerda">
                  <i class="fas fa-rotate-left"></i>
                </button>
                <button class="cn-tool-btn" type="button" @click="rotate(90)" title="Girar à direita (R)">
                  <i class="fas fa-rotate-right"></i>
                </button>
              </div>

              <div ref="viewerRef" class="cn-image-container" @wheel="handleImageWheel"
                @mousedown="handleImageMouseDown" @mousemove="handleImageMouseMove" @mouseup="handleImageMouseUp"
                @mouseleave="handleImageMouseUp">
                <div v-if="!canhotoImageLoaded" class="cn-viewer-skeleton">
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  <span>Carregando canhoto…</span>
                </div>
                <img ref="imgRef" :src="canhotoUrl" alt="Canhoto" class="cn-image"
                  :class="{ 'is-visible': canhotoImageLoaded }" :style="imageStyle" draggable="false"
                  @load="onCanhotoImageLoad" @error="handleCanhotoImageError" @dblclick="handleImageDoubleClick" />
              </div>

              <small class="cn-viewer-hint">
                <i class="fas fa-computer-mouse me-1"></i>Scroll: zoom no cursor · Arraste: mover · Setas: navegar ·
                +/−: zoom · 0: ajustar · R: girar
              </small>
            </div>

            <div v-if="canhotoLoadError" class="alert alert-warning mb-0">
              Não foi possível carregar a imagem.
              <div class="mt-2">
                <a :href="canhotoUrl" target="_blank" rel="noopener">Abrir imagem em nova aba</a>
              </div>
            </div>

            <div v-if="!canhotoUrl && !canhotoLoadError" class="text-muted text-center py-4">Sem imagem.</div>
          </div>

          <!-- Ação de validação -->
          <div class="cn-action-col">
            <div class="cn-action-card">
              <h6 class="cn-action-title"><i class="fas fa-ticket me-2"></i>Validação manual</h6>
              <p class="cn-action-help">
                Informe o número da cartela impresso no canhoto para validá-lo manualmente.
              </p>

              <label class="cn-action-label" for="manualTicketInput">Número da cartela</label>
              <input id="manualTicketInput" :value="manualTicketNumber" type="text" class="form-control cn-input"
                placeholder="Somente números" @input="onManualTicketInput" @keydown="onManualTicketKeydown"
                @keypress.enter="confirmManualValidate" inputmode="numeric" pattern="[0-9]*" autocomplete="off" />

              <button v-if="isAdmin" class="btn btn-success w-100 mt-3 mb-0" type="button"
                @click="confirmManualValidate" :disabled="validatingManual || !manualTicketNumber">
                <i v-if="!validatingManual" class="fas fa-check me-1"></i>
                <i v-else class="fas fa-spinner fa-spin me-1"></i>
                Validar canhoto
              </button>

              <button v-if="isAdmin" class="btn btn-outline-danger w-100 mt-2 mb-0" type="button"
                @click="confirmRejectMessage" :disabled="rejectingMessage">
                <i v-if="!rejectingMessage" class="fas fa-times me-1"></i>
                <i v-else class="fas fa-spinner fa-spin me-1"></i>
                Rejeitar canhoto
              </button>

              <p v-if="!isAdmin" class="cn-action-help mt-3 mb-0">
                Somente administradores podem validar ou rejeitar canhotos.
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="cn-modal-footer">
            <a v-if="canhotoOriginalUrl" :href="canhotoOriginalUrl" target="_blank" rel="noopener"
              class="btn btn-outline-primary mb-0">
              <i class="fas fa-up-right-from-square me-1"></i>Abrir original
            </a>
            <button class="btn btn-outline-dark mb-0 ms-auto" type="button" @click="closeCanhotoModal">
              Fechar
            </button>
          </div>
        </template>
      </BaseModal>
    </Teleport>
  </div>
</template>

<style>
/* Estilos não-scoped: o DataTables gera o HTML das células fora do alcance do data-v do Vue */
.cn-page {
  --cn-primary: #5e72e4;
  --cn-primary-2: #825ee4;
  --cn-success: #2dce89;
  --cn-info: #11cdef;
  --cn-danger: #f5365c;
  --cn-text: #f1f3f9;
  --cn-muted: rgba(255, 255, 255, 0.55);
  --cn-border: rgba(255, 255, 255, 0.08);
  --cn-surface: rgba(255, 255, 255, 0.04);
  --cn-surface-2: rgba(255, 255, 255, 0.08);
}

/* HERO */
.cn-page .cn-hero {
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
  background: linear-gradient(135deg, var(--cn-primary) 0%, var(--cn-primary-2) 100%);
  box-shadow: 0 12px 28px -12px rgba(94, 114, 228, 0.6);
}
.cn-page .cn-hero::before,
.cn-page .cn-hero::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}
.cn-page .cn-hero::before {
  width: 280px;
  height: 280px;
  top: -140px;
  right: -60px;
}
.cn-page .cn-hero::after {
  width: 180px;
  height: 180px;
  bottom: -110px;
  left: 35%;
}
.cn-page .cn-hero > * {
  position: relative;
  z-index: 1;
}
.cn-page .cn-hero-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.cn-page .cn-hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}
.cn-page .cn-hero-title {
  margin: 0;
  font-weight: 700;
  color: #fff;
}
.cn-page .cn-hero-sub {
  opacity: 0.85;
  font-size: 0.9rem;
}
.cn-page .cn-hero-stats {
  display: flex;
  gap: 0.75rem;
}
.cn-page .cn-stat {
  min-width: 110px;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
}
.cn-page .cn-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  animation: cn-pop 0.35s ease;
}
.cn-page .cn-stat-label {
  font-size: 0.75rem;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cn-page .cn-refresh {
  border: 0;
  border-radius: 999px;
  padding: 0.55rem 1.2rem;
  font-weight: 600;
  color: var(--cn-primary);
  background: #fff;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.cn-page .cn-refresh:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.25);
}
.cn-page .cn-refresh:disabled {
  opacity: 0.8;
}
.cn-page .cn-refresh.is-spinning i {
  animation: cn-spin 0.9s linear infinite;
}

/* FILTROS */
.cn-page .cn-filters-card {
  position: sticky;
  top: 90px;
  overflow: hidden;
  border: 1px solid var(--cn-border);
}
.cn-page .cn-filters-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  border: 0;
  background: linear-gradient(135deg, rgba(94, 114, 228, 0.3), rgba(130, 94, 228, 0.18));
  font-weight: 700;
  color: var(--cn-text);
  text-align: left;
}
.cn-page .cn-filters-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.cn-page .cn-filters-title-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  color: #fff;
  background: linear-gradient(135deg, var(--cn-primary), var(--cn-primary-2));
}
.cn-page .cn-filters-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 0.45rem;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-size: 0.72rem;
  color: var(--cn-primary);
  background: #fff;
  animation: cn-pop 0.25s ease;
}
.cn-page .cn-chevron {
  color: var(--cn-muted);
  transition: transform 0.25s;
}
.cn-page .cn-filters-card.is-collapsed .cn-chevron {
  transform: rotate(-180deg);
}
.cn-page .cn-filters-body {
  padding: 1rem 1.1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.cn-page .cn-filters-card.is-collapsed .cn-filters-body {
  display: none;
}

/* Campos */
.cn-page .cn-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.cn-page .cn-field-label {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cn-muted);
}
.cn-page .cn-field-hint {
  font-size: 0.72rem;
  color: var(--cn-muted);
}
.cn-page .cn-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem 0.5rem 0.8rem;
  border: 1px solid var(--cn-border);
  border-radius: 0.85rem;
  background: var(--cn-surface);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.cn-page .cn-input-wrap:focus-within {
  border-color: var(--cn-primary);
  box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.25);
  background: rgba(94, 114, 228, 0.06);
}
.cn-page .cn-input-icon {
  width: 14px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--cn-muted);
  transition: color 0.2s;
}
.cn-page .cn-input-wrap.has-value .cn-input-icon,
.cn-page .cn-input-wrap:focus-within .cn-input-icon {
  color: var(--cn-primary);
}
.cn-page .cn-input-field {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--cn-text);
  font-size: 0.92rem;
}
.cn-page .cn-input-field::placeholder {
  color: rgba(255, 255, 255, 0.35);
}
.cn-page .cn-input-date {
  color-scheme: dark;
}
.cn-page .cn-input-clear {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  font-size: 0.6rem;
  color: var(--cn-muted);
  background: var(--cn-surface-2);
  display: grid;
  place-items: center;
  transition: background 0.2s, color 0.2s;
}
.cn-page .cn-input-clear:hover {
  color: #fff;
  background: var(--cn-danger);
}

/* Rodapé do painel */
.cn-page .cn-filters-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.2rem;
  padding-top: 0.8rem;
  border-top: 1px dashed var(--cn-border);
}
.cn-page .cn-filters-status {
  font-size: 0.75rem;
  color: var(--cn-muted);
}
.cn-page .cn-filters-status i {
  color: #fbbf24;
}
.cn-page .cn-clear-filters {
  border: 0;
  background: transparent;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--cn-danger);
  transition: opacity 0.2s;
}
.cn-page .cn-clear-filters:disabled {
  opacity: 0.35;
}

/* Desktop: filtros sempre visíveis */
@media (min-width: 992px) {
  .cn-page .cn-filters-head {
    cursor: default;
  }
  .cn-page .cn-chevron {
    display: none;
  }
  .cn-page .cn-filters-body,
  .cn-page .cn-filters-card.is-collapsed .cn-filters-body {
    display: flex;
  }
}

/* TOOLBAR */
.cn-page .cn-card {
  overflow: hidden;
}
.cn-page .cn-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--cn-border);
}
.cn-page .cn-segment {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background: var(--cn-surface-2);
}
.cn-page .cn-segment-btn {
  border: 0;
  padding: 0.4rem 0.9rem;
  border-radius: 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cn-muted);
  background: transparent;
  transition: all 0.2s;
}
.cn-page .cn-segment-btn:hover {
  color: var(--cn-text);
}
.cn-page .cn-segment-btn.is-active {
  color: var(--cn-primary);
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.cn-page .cn-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.cn-page .cn-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.3rem 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: #c7d2fe;
  background: rgba(94, 114, 228, 0.25);
  animation: cn-pop 0.25s ease;
}
.cn-page .cn-chip-x {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  font-size: 0.6rem;
  color: #fff;
  background: var(--cn-primary);
  display: inline-grid;
  place-items: center;
}
.cn-page .cn-clear-all {
  border: 0;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--cn-danger);
  text-decoration: underline;
}

/* TABELA */
.cn-page .cn-table-wrap {
  position: relative;
  padding: 0.5rem 1rem 1rem;
}
.cn-page .cn-table thead th {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--cn-muted);
  background: var(--cn-surface);
  border-bottom: 1px solid var(--cn-border) !important;
}
.cn-page .cn-table td {
  vertical-align: middle;
  font-size: 0.9rem;
  color: var(--cn-text);
}
.cn-page .cn-table tbody tr {
  transition: background 0.15s, box-shadow 0.15s;
  animation: cn-row-in 0.3s ease both;
}
.cn-page .cn-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 3px 0 0 var(--cn-primary);
}
.cn-page .cn-table-wrap .dt-processing {
  background: rgba(15, 23, 41, 0.6);
  backdrop-filter: blur(2px);
  border-radius: 0.75rem;
}
.cn-page .cn-muted {
  color: var(--cn-muted);
}
.cn-page .cn-msg-id {
  display: inline-block;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  padding: 0.2rem 0.55rem;
  border-radius: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  color: #fff;
  background: var(--cn-surface-2);
}
.cn-page .cn-sender {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.cn-page .cn-sender-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.cn-page .cn-sender-name {
  font-weight: 600;
}
.cn-page .cn-sender-phone {
  font-size: 0.78rem;
  color: var(--cn-muted);
  font-variant-numeric: tabular-nums;
}
.cn-page .cn-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--cn-primary), var(--cn-primary-2));
}
.cn-page .cn-avatar-empty {
  background: var(--cn-surface-2);
  color: var(--cn-muted);
}
.cn-page .cn-date {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}
.cn-page .cn-date-rel {
  color: var(--cn-muted);
  font-size: 0.75rem;
}
.cn-page .cn-pill {
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
.cn-page .cn-pill-info {
  color: #7fe3f5;
  background: rgba(17, 205, 239, 0.15);
}
.cn-page button.cn-pill-info:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(17, 205, 239, 0.3);
}
.cn-page .cn-pill-off {
  color: var(--cn-muted);
  background: var(--cn-surface-2);
}
.cn-page .cn-pill.is-disabled {
  opacity: 0.6;
}

/* ===== MODAL (tela cheia, sem scroll) ===== */
.cn-page.cn-modal .modal {
  overflow: hidden;
  z-index: 10000;
}
.cn-page.cn-modal .modal-backdrop {
  z-index: 9999;
}
/* Alertas do SweetAlert2 (enviados ao body) precisam ficar acima do modal do canhoto */
.swal2-container {
  z-index: 10100 !important;
}
.cn-page.cn-modal .modal-dialog {
  height: 100vh;
  height: 100dvh;
  max-width: min(1400px, 100vw);
  margin: 0 auto;
}
.cn-page.cn-modal .modal-content {
  height: 100%;
  border: 0;
  border-radius: 0;
}
.cn-page.cn-modal .modal-header,
.cn-page.cn-modal .modal-footer {
  padding: 0.75rem 1.25rem;
}
.cn-page.cn-modal .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1.25rem;
}

.cn-page .cn-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.cn-page .cn-info-tile {
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--cn-border);
  border-radius: 0.75rem;
  background: var(--cn-surface);
}
.cn-page .cn-info-label {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--cn-muted);
}
.cn-page .cn-info-value {
  display: block;
  font-weight: 600;
  color: var(--cn-text);
}
.cn-page .cn-msg-id-full {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  word-break: break-all;
}
.cn-page .cn-wa-link {
  display: inline-block;
  margin-top: 0.15rem;
  font-size: 0.85rem;
  color: #1a9f6b;
  text-decoration: none;
}
.cn-page .cn-wa-link:hover {
  text-decoration: underline;
}

/* Área principal ocupa todo o espaço restante do modal */
.cn-page .cn-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1rem;
}
.cn-page .cn-viewer-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cn-page .cn-viewer-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Barra de ferramentas do visualizador */
.cn-page .cn-zoom-bar {
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--cn-surface-2);
}
.cn-page .cn-tool-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  color: var(--cn-text);
  background: rgba(255, 255, 255, 0.1);
  display: grid;
  place-items: center;
  transition: background 0.2s, opacity 0.2s;
}
.cn-page .cn-tool-btn:hover:not(:disabled) {
  background: var(--cn-primary);
}
.cn-page .cn-tool-btn:disabled {
  opacity: 0.35;
}
.cn-page .cn-zoom-range {
  width: 150px;
  accent-color: var(--cn-primary);
  cursor: pointer;
}
.cn-page .cn-zoom-value {
  min-width: 60px;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--cn-text);
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: background 0.2s;
}
.cn-page .cn-zoom-value:hover {
  background: rgba(255, 255, 255, 0.1);
}
.cn-page .cn-divider {
  width: 1px;
  height: 22px;
  margin: 0 0.25rem;
  background: var(--cn-border);
}

/* Imagem ocupa o espaço disponível, sem altura fixa */
.cn-page .cn-image-container {
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
.cn-page .cn-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center;
  will-change: transform;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.cn-page .cn-image.is-visible {
  opacity: 1;
}
.cn-page .cn-viewer-skeleton {
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
.cn-page .cn-viewer-hint {
  text-align: center;
  color: var(--cn-muted);
}

/* Painel de ação */
.cn-page .cn-action-col {
  min-height: 0;
  overflow-y: auto;
}
.cn-page .cn-action-card {
  padding: 1.25rem;
  border: 1px solid var(--cn-border);
  border-radius: 0.75rem;
  background: var(--cn-surface);
}
.cn-page .cn-action-title {
  font-weight: 700;
  color: var(--cn-text);
}
.cn-page .cn-action-help {
  font-size: 0.85rem;
  color: var(--cn-muted);
}
.cn-page .cn-action-label {
  display: block;
  margin: 0.75rem 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--cn-muted);
}
.cn-page .cn-input {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}
.cn-page .cn-modal-footer {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

/* Telas estreitas: visualizador em cima, ações embaixo */
@media (max-width: 991px) {
  .cn-page .cn-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .cn-page .cn-action-col {
    overflow-y: visible;
  }
}

/* ANIMAÇÕES */
@keyframes cn-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cn-pop {
  0% {
    opacity: 0.4;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes cn-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cn-page *,
  .cn-page *::before,
  .cn-page *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
