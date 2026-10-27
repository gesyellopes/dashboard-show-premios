<script setup>
import { computed, onMounted, ref, watch } from "vue";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

//Modals
import VendorCreateModal from "./modals/VendorCreateModal.vue";
import VendorEditModal from "./modals/VendorEditModal.vue";

import api from "@/services/api";
import Swal from "sweetalert2";

// registra o core (obrigatório)
DataTable.use(DataTablesCore);

// ===== Estado geral da página =====
const totalRecords = ref(0);
const isLoading = ref(false);
const filtersOpen = ref(true);

const FILTER_LABELS = {
    vendor_name: "Nome",
    vendor_whatsapp: "Telefone",
};

// a busca só começa com 3 caracteres, para não pesar a consulta
const MIN_SEARCH_CHARS = 3;

// ===== Modal / Form =====
const showModal = ref(false);
const submitLoading = ref(false);
const vendorForm = ref(null);
const unitOptions = ref([]);

const openModal = () => {
    showModal.value = true;
};

const closeModal = () => {
    showModal.value = false;
    if (vendorForm.value) vendorForm.value.reset();
};

// ===== DataTables refs/helpers =====
const dtRef = ref(null);

// recarrega mantendo a página atual (botão Recarregar e após ações nos modais)
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

// formata o telefone enquanto digita: (00) 00000-0000
function formatPhoneInput(digits) {
    const d = digits.slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ===== Filters =====
// `draft` é o que o usuário está digitando; `filters` é o que já foi aplicado na tabela
const filters = ref({});
const draft = ref({ vendor_name: "", vendor_whatsapp: "" });
const lastApplied = ref("");
let applyTimer = null;

const activeChips = computed(() =>
    Object.keys(FILTER_LABELS).reduce((acc, key) => {
        const value = filters.value[key];
        if (!value) return acc;

        acc.push({
            key,
            label: FILTER_LABELS[key],
            text: key === "vendor_whatsapp" ? formatBrWhatsapp(value) : String(value),
        });
        return acc;
    }, [])
);

const activeFilterCount = computed(() => activeChips.value.length);

function buildFilters() {
    const name = draft.value.vendor_name.trim();
    const digits = draft.value.vendor_whatsapp; // somente dígitos
    return {
        vendor_name: name.length >= MIN_SEARCH_CHARS ? name : null,
        vendor_whatsapp: digits.length >= MIN_SEARCH_CHARS ? digits : null,
    };
}

// quantos caracteres ainda faltam para a busca começar (vazio se já pode buscar)
function missingChars(value) {
    const length = value.length;
    return length > 0 && length < MIN_SEARCH_CHARS ? MIN_SEARCH_CHARS - length : 0;
}

const nameMissing = computed(() => missingChars(draft.value.vendor_name.trim()));
const phoneMissing = computed(() => missingChars(draft.value.vendor_whatsapp));
const phoneDisplay = computed(() => formatPhoneInput(draft.value.vendor_whatsapp));

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

watch(() => draft.value.vendor_name, scheduleApply);
watch(() => draft.value.vendor_whatsapp, scheduleApply);

function onPhoneInput(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    draft.value.vendor_whatsapp = digits;
    e.target.value = formatPhoneInput(digits);
}

const handleResetFilters = () => {
    draft.value = { vendor_name: "", vendor_whatsapp: "" };
    applyDraft();
};

// limpa um campo (botão × do input ou chip da toolbar)
function removeChip(key) {
    draft.value[key] = "";
    applyDraft();
}

// colunas (map data => column)
const columns = [
    {
        data: "name",
        title: "Nome Vendedor",
        name: "name",
        render: "#nameCell", // slot Vue
    },
    {
        data: "whatsapp",
        title: "Telefone vendedor",
        name: "whatsapp",
        render: (data) => formatBrWhatsapp(data),
    },
    {
        data: "tickets_total",
        title: "Cartelas",
        name: "tickets_total",
        defaultContent: "0",
    },
    {
        data: "tickets_verified",
        title: "Verificadas",
        name: "tickets_verified",
        defaultContent: "0",
    },
    {
        data: null,
        title: "Opções",
        name: "actions",
        orderable: false,
        searchable: false,
        render: "#actionsCell", // slot Vue
    },
];

// options do DataTables
const options = {
    processing: true,
    serverSide: true,
    searching: false,
    lengthChange: false,
    pageLength: 20,
    ordering: false,
    responsive: true,
    stateSave: false,   // não salva estado na URL/storage
    language: {
        emptyTable: "Nenhum vendedor cadastrado",
        zeroRecords: "Nenhum vendedor encontrado com esses filtros",
        info: "Exibindo _START_ a _END_ de _TOTAL_ vendedores",
        infoEmpty: "Exibindo 0 a 0 de 0 vendedores",
        processing: "Carregando vendedores...",
        paginate: { previous: "Anterior", next: "Próxima" },
    },
};

const showEditModal = ref(false)
const editingVendor = ref(null)

function openEditModal(row) {
    editingVendor.value = row
    showEditModal.value = true
}

function closeEditModal() {
    showEditModal.value = false
    editingVendor.value = null
}

async function confirmDelete(row) {
    const result = await Swal.fire({
        icon: "warning",
        title: "Confirmar exclusão",
        text: `Deseja remover o vendedor "${row.name}" da comunidade "${row.unit}" responsável pela paróquia "${row.group}"?`,
        showCancelButton: true,
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar",
    })

    if (result.isConfirmed) {

        try {
            const { data } = await api.delete(`/vendors/${row.id}`)

            if (data?.success) {
                await Swal.fire({
                    icon: "success",
                    title: "Sucesso",
                    text: data.message || "Vendedor excluído com sucesso.",
                })

                // recarrega a tabela sem perder página
                reloadTable()
                return
            }

            await Swal.fire({
                icon: "error",
                title: "Erro",
                text: data?.message || "Erro ao excluir o vendedor.",
            })
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                "Erro ao excluir o vendedor. Contate o suporte."

            await Swal.fire({
                icon: "error",
                title: "Erro",
                text: message,
            })
        }

    }
}


// ajax server-side
async function ajaxVendors(dtRequest, callback) {
    try {
        const length = dtRequest.length || 20;
        const page = Math.floor((dtRequest.start || 0) / length) + 1;
        const endpoint = "/vendors";
        const rawFilters = filters.value || {};
        const params = Object.keys(rawFilters).reduce((acc, key) => {
            const value = rawFilters[key];
            if (value === null || value === undefined || value === "") return acc;
            acc[key] = value;
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
        const rows = data?.data || [];
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

// submit
const handleSubmit = async (form$) => {
    const payload = form$.requestData;
    submitLoading.value = true;

    try {
        const { data } = await api.post("/vendors", payload);

        const success = data === true || data?.success === true;
        if (success) {
            await Swal.fire({
                icon: "success",
                title: "Sucesso",
                text: "Vendedor cadastrado com sucesso.",
            });

            closeModal();

            // 🔥 recarrega tabela
            reloadTable();
            return;
        }

        await Swal.fire({
            icon: "error",
            title: "Erro",
            text: data?.message ?? "Erro ao cadastrar vendedor.",
        });
    } catch (error) {
        console.error("Failed to create vendor", error);
        await Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Nao foi possivel cadastrar o vendedor.",
        });
    } finally {
        submitLoading.value = false;
    }
};

// load units
const loadUnits = async () => {
    try {
        const { data } = await api.get("/units/list");
        const units = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        unitOptions.value = units.map((unit) => ({
            value: unit.id,
            label: unit.name,
        }));
    } catch (error) {
        console.error("Failed to load units", error);
    }
};

onMounted(loadUnits);
</script>

<template>
    <div class="py-4 container-fluid vd-page">
        <!-- HERO -->
        <section class="vd-hero mb-4">
            <div class="vd-hero-main">
                <div class="vd-hero-icon"><i class="fas fa-user-tie"></i></div>
                <div>
                    <h4 class="vd-hero-title">Vendedores</h4>
                    <p class="vd-hero-sub mb-0">Cadastro e acompanhamento dos vendedores</p>
                </div>
            </div>

            <div class="vd-hero-stats">
                <div class="vd-stat">
                    <span :key="totalRecords" class="vd-stat-value">{{ totalRecords.toLocaleString("pt-BR") }}</span>
                    <span class="vd-stat-label">cadastrados</span>
                </div>
                <div class="vd-stat">
                    <span :key="activeFilterCount" class="vd-stat-value">{{ activeFilterCount }}</span>
                    <span class="vd-stat-label">filtros ativos</span>
                </div>
            </div>

            <button type="button" class="vd-refresh" :class="{ 'is-spinning': isLoading }" :disabled="isLoading"
                @click="reloadTable">
                <i class="fas fa-rotate"></i> Recarregar
            </button>
        </section>

        <div class="row">
            <!-- FILTROS -->
            <aside class="col-lg-3 mb-4 mb-lg-0">
                <div class="card vd-filters-card" :class="{ 'is-collapsed': !filtersOpen }">
                    <button type="button" class="vd-filters-head" :aria-expanded="filtersOpen"
                        @click="filtersOpen = !filtersOpen">
                        <span class="vd-filters-title">
                            <span class="vd-filters-title-icon"><i class="fas fa-sliders"></i></span>
                            Filtros
                            <span v-if="activeFilterCount" class="vd-filters-badge">{{ activeFilterCount }}</span>
                        </span>
                        <i class="fas fa-chevron-down vd-chevron"></i>
                    </button>

                    <div class="vd-filters-body">
                        <!-- Nome -->
                        <div class="vd-field">
                            <label class="vd-field-label" for="vdVendorName">Nome do vendedor</label>
                            <div class="vd-input-wrap" :class="{ 'has-value': draft.vendor_name }">
                                <i class="fas fa-user vd-input-icon"></i>
                                <input id="vdVendorName" v-model="draft.vendor_name" type="text" class="vd-input-field"
                                    placeholder="Ex.: João Souza" autocomplete="off" @keydown.enter.prevent="applyDraft" />
                                <button v-if="draft.vendor_name" type="button" class="vd-input-clear"
                                    aria-label="Limpar nome" @click="removeChip('vendor_name')">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </div>
                            <small v-if="nameMissing" class="vd-field-hint">
                                Digite mais {{ nameMissing }} {{ nameMissing === 1 ? "caractere" : "caracteres" }} para pesquisar
                            </small>
                        </div>

                        <!-- Telefone -->
                        <div class="vd-field">
                            <label class="vd-field-label" for="vdVendorPhone">Telefone</label>
                            <div class="vd-input-wrap" :class="{ 'has-value': draft.vendor_whatsapp }">
                                <i class="fas fa-phone vd-input-icon"></i>
                                <input id="vdVendorPhone" :value="phoneDisplay" type="text" inputmode="tel"
                                    class="vd-input-field" placeholder="(00) 00000-0000" autocomplete="off"
                                    @input="onPhoneInput" @keydown.enter.prevent="applyDraft" />
                                <button v-if="draft.vendor_whatsapp" type="button" class="vd-input-clear"
                                    aria-label="Limpar telefone" @click="removeChip('vendor_whatsapp')">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </div>
                            <small v-if="phoneMissing" class="vd-field-hint">
                                Digite mais {{ phoneMissing }} {{ phoneMissing === 1 ? "dígito" : "dígitos" }} para pesquisar
                            </small>
                        </div>

                        <div class="vd-filters-foot">
                            <span class="vd-filters-status"><i class="fas fa-bolt me-1"></i>Atualiza enquanto você digita</span>
                            <button type="button" class="vd-clear-filters" :disabled="!activeFilterCount"
                                @click="handleResetFilters">
                                <i class="fas fa-eraser me-1"></i>Limpar
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- TABELA -->
            <div class="col-lg-9">
                <div class="card vd-card">
                    <div class="vd-toolbar">
                        <div class="vd-chips">
                            <span v-for="chip in activeChips" :key="chip.key" class="vd-chip">
                                {{ chip.label }}: <strong>{{ chip.text }}</strong>
                                <button type="button" class="vd-chip-x" :aria-label="`Remover filtro ${chip.label}`"
                                    @click="removeChip(chip.key)">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </span>
                            <button v-if="activeFilterCount" type="button" class="vd-clear-all"
                                @click="handleResetFilters">Limpar tudo</button>
                        </div>

                        <button class="vd-add" type="button" @click="openModal">
                            <i class="fas fa-plus me-1"></i>Adicionar Vendedor
                        </button>
                    </div>

                    <div class="vd-table-wrap">
                        <!-- ✅ DATATABLES AQUI -->
                        <DataTable ref="dtRef" class="table vd-table align-items-center mb-0" :columns="columns"
                            :options="options" :ajax="ajaxVendors">
                            <!-- slot pro nome virar link -->
                            <template #nameCell="props">
                                <a href="#" class="vd-name-link" @click.prevent="openEditModal(props.rowData)">
                                    {{ props.cellData }}
                                </a>
                            </template>

                            <template #actionsCell="props">
                                <div class="vd-actions">
                                    <a href="#" class="vd-icon-btn vd-icon-edit" title="Editar"
                                        @click.prevent="openEditModal(props.rowData)">
                                        <i class="fas fa-pen"></i>
                                    </a>

                                    <a href="#" class="vd-icon-btn vd-icon-delete" title="Excluir"
                                        @click.prevent="confirmDelete(props.rowData)">
                                        <i class="fas fa-trash"></i>
                                    </a>
                                </div>
                            </template>
                        </DataTable>
                        <!-- ✅ /DATATABLES -->
                    </div>
                </div>
            </div>
        </div>

        <!-- Modais -->
        <VendorEditModal
            v-model="showEditModal"
            :vendor="editingVendor"
            :unitOptions="unitOptions"
            @close="closeEditModal"
            @reload-parent="reloadTable"
        />

        <VendorCreateModal v-model="showModal" :unitOptions="unitOptions" :submitLoading="submitLoading"
            @submit="handleSubmit" @close="closeModal" />

    </div>
</template>

<style>
/* Estilos não-scoped: o DataTables gera o HTML das células fora do alcance do data-v do Vue */
.vd-page {
    --vd-primary: #5e72e4;
    --vd-primary-2: #825ee4;
    --vd-success: #2dce89;
    --vd-danger: #f5365c;
    --vd-text: #f1f3f9;
    --vd-muted: rgba(255, 255, 255, 0.55);
    --vd-border: rgba(255, 255, 255, 0.08);
    --vd-surface: rgba(255, 255, 255, 0.04);
    --vd-surface-2: rgba(255, 255, 255, 0.08);
}

/* HERO */
.vd-page .vd-hero {
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
    background: linear-gradient(135deg, var(--vd-primary) 0%, var(--vd-primary-2) 100%);
    box-shadow: 0 12px 28px -12px rgba(94, 114, 228, 0.6);
}
.vd-page .vd-hero::before,
.vd-page .vd-hero::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    pointer-events: none;
}
.vd-page .vd-hero::before {
    width: 280px;
    height: 280px;
    top: -140px;
    right: -60px;
}
.vd-page .vd-hero::after {
    width: 180px;
    height: 180px;
    bottom: -110px;
    left: 35%;
}
.vd-page .vd-hero > * {
    position: relative;
    z-index: 1;
}
.vd-page .vd-hero-main {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.vd-page .vd-hero-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    font-size: 1.5rem;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(4px);
}
.vd-page .vd-hero-title {
    margin: 0;
    font-weight: 700;
    color: #fff;
}
.vd-page .vd-hero-sub {
    opacity: 0.85;
    font-size: 0.9rem;
}
.vd-page .vd-hero-stats {
    display: flex;
    gap: 0.75rem;
}
.vd-page .vd-stat {
    min-width: 110px;
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(6px);
    display: flex;
    flex-direction: column;
}
.vd-page .vd-stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    animation: vd-pop 0.35s ease;
}
.vd-page .vd-stat-label {
    font-size: 0.75rem;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.vd-page .vd-refresh {
    border: 0;
    border-radius: 999px;
    padding: 0.55rem 1.2rem;
    font-weight: 600;
    color: var(--vd-primary);
    background: #fff;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.vd-page .vd-refresh:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.25);
}
.vd-page .vd-refresh:disabled {
    opacity: 0.8;
}
.vd-page .vd-refresh.is-spinning i {
    animation: vd-spin 0.9s linear infinite;
}

/* FILTROS */
.vd-page .vd-filters-card {
    position: sticky;
    top: 90px;
    overflow: hidden;
    border: 1px solid var(--vd-border);
}
.vd-page .vd-filters-head {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 1.1rem;
    border: 0;
    background: linear-gradient(135deg, rgba(94, 114, 228, 0.3), rgba(130, 94, 228, 0.18));
    font-weight: 700;
    color: var(--vd-text);
    text-align: left;
}
.vd-page .vd-filters-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}
.vd-page .vd-filters-title-icon {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    color: #fff;
    background: linear-gradient(135deg, var(--vd-primary), var(--vd-primary-2));
}
.vd-page .vd-filters-badge {
    min-width: 22px;
    height: 22px;
    padding: 0 0.45rem;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    font-size: 0.72rem;
    color: var(--vd-primary);
    background: #fff;
    animation: vd-pop 0.25s ease;
}
.vd-page .vd-chevron {
    color: var(--vd-muted);
    transition: transform 0.25s;
}
.vd-page .vd-filters-card.is-collapsed .vd-chevron {
    transform: rotate(-180deg);
}
.vd-page .vd-filters-body {
    padding: 1rem 1.1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}
.vd-page .vd-filters-card.is-collapsed .vd-filters-body {
    display: none;
}

/* Campos */
.vd-page .vd-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.vd-page .vd-field-label {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vd-muted);
}
.vd-page .vd-field-hint {
    font-size: 0.72rem;
    color: var(--vd-muted);
}
.vd-page .vd-input-wrap {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.6rem 0.5rem 0.8rem;
    border: 1px solid var(--vd-border);
    border-radius: 0.85rem;
    background: var(--vd-surface);
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.vd-page .vd-input-wrap:focus-within {
    border-color: var(--vd-primary);
    box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.25);
    background: rgba(94, 114, 228, 0.06);
}
.vd-page .vd-input-icon {
    width: 14px;
    text-align: center;
    font-size: 0.85rem;
    color: var(--vd-muted);
    transition: color 0.2s;
}
.vd-page .vd-input-wrap.has-value .vd-input-icon,
.vd-page .vd-input-wrap:focus-within .vd-input-icon {
    color: var(--vd-primary);
}
.vd-page .vd-input-field {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--vd-text);
    font-size: 0.92rem;
}
.vd-page .vd-input-field::placeholder {
    color: rgba(255, 255, 255, 0.35);
}
.vd-page .vd-input-clear {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border: 0;
    border-radius: 50%;
    font-size: 0.6rem;
    color: var(--vd-muted);
    background: var(--vd-surface-2);
    display: grid;
    place-items: center;
    transition: background 0.2s, color 0.2s;
}
.vd-page .vd-input-clear:hover {
    color: #fff;
    background: var(--vd-danger);
}

/* Rodapé do painel */
.vd-page .vd-filters-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.2rem;
    padding-top: 0.8rem;
    border-top: 1px dashed var(--vd-border);
}
.vd-page .vd-filters-status {
    font-size: 0.75rem;
    color: var(--vd-muted);
}
.vd-page .vd-filters-status i {
    color: #fbbf24;
}
.vd-page .vd-clear-filters {
    border: 0;
    background: transparent;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--vd-danger);
    transition: opacity 0.2s;
}
.vd-page .vd-clear-filters:disabled {
    opacity: 0.35;
}

/* Desktop: filtros sempre visíveis */
@media (min-width: 992px) {
    .vd-page .vd-filters-head {
        cursor: default;
    }
    .vd-page .vd-chevron {
        display: none;
    }
    .vd-page .vd-filters-body,
    .vd-page .vd-filters-card.is-collapsed .vd-filters-body {
        display: flex;
    }
}

/* TOOLBAR */
.vd-page .vd-card {
    overflow: hidden;
}
.vd-page .vd-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--vd-border);
}
.vd-page .vd-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}
.vd-page .vd-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.3rem 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    color: #c7d2fe;
    background: rgba(94, 114, 228, 0.25);
    animation: vd-pop 0.25s ease;
}
.vd-page .vd-chip-x {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 50%;
    font-size: 0.6rem;
    color: #fff;
    background: var(--vd-primary);
    display: inline-grid;
    place-items: center;
}
.vd-page .vd-clear-all {
    border: 0;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--vd-danger);
    text-decoration: underline;
}
.vd-page .vd-add {
    border: 0;
    border-radius: 999px;
    padding: 0.5rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, var(--vd-success), #26b87a);
    box-shadow: 0 6px 14px -6px rgba(45, 206, 137, 0.6);
    transition: transform 0.2s, box-shadow 0.2s;
}
.vd-page .vd-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -8px rgba(45, 206, 137, 0.7);
}

/* TABELA */
.vd-page .vd-table-wrap {
    position: relative;
    padding: 0.5rem 1rem 1rem;
}
.vd-page .vd-table thead th {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--vd-muted);
    background: var(--vd-surface);
    border-bottom: 1px solid var(--vd-border) !important;
}
.vd-page .vd-table td {
    vertical-align: middle;
    font-size: 0.9rem;
    color: var(--vd-text);
}
.vd-page .vd-table tbody tr {
    transition: background 0.15s, box-shadow 0.15s;
    animation: vd-row-in 0.3s ease both;
}
.vd-page .vd-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
    box-shadow: inset 3px 0 0 var(--vd-primary);
}
.vd-page .vd-table-wrap .dt-processing {
    background: rgba(15, 23, 41, 0.6);
    backdrop-filter: blur(2px);
    border-radius: 0.75rem;
}
.vd-page .vd-name-link {
    font-weight: 700;
    color: var(--vd-text);
    text-decoration: none;
}
.vd-page .vd-name-link:hover {
    color: var(--vd-primary);
    text-decoration: underline;
}
.vd-page .vd-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.vd-page .vd-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: inline-grid;
    place-items: center;
    font-size: 0.85rem;
    transition: transform 0.15s, background 0.2s;
}
.vd-page .vd-icon-btn:hover {
    transform: translateY(-1px);
}
.vd-page .vd-icon-edit {
    color: #a5b4fc;
    background: rgba(94, 114, 228, 0.18);
}
.vd-page .vd-icon-edit:hover {
    background: rgba(94, 114, 228, 0.35);
}
.vd-page .vd-icon-delete {
    color: #fda4af;
    background: rgba(245, 54, 92, 0.15);
}
.vd-page .vd-icon-delete:hover {
    background: rgba(245, 54, 92, 0.3);
}

/* ANIMAÇÕES */
@keyframes vd-row-in {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}
@keyframes vd-pop {
    0% {
        opacity: 0.4;
        transform: scale(0.85);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}
@keyframes vd-spin {
    to {
        transform: rotate(360deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .vd-page *,
    .vd-page *::before,
    .vd-page *::after {
        animation: none !important;
        transition: none !important;
    }
}
</style>
