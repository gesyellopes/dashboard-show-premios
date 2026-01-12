<script setup>
import { onMounted, ref } from "vue";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

import router from "@/router";

//Modals
import VendorCreateModal from "./modals/VendorCreateModal.vue";
import VendorEditModal from "./modals/VendorEditModal.vue";

import api from "@/services/api";
import Swal from "sweetalert2";

// registra o core (obrigatório)
DataTable.use(DataTablesCore);

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

// ===== DataTables refs/options =====
const dtRef = ref(null);
const filterForm = ref(null);
const filters = ref({});
const groupOptions = ref([]);
const groupLoading = ref(false);

function goToVendor(id) {
    const url = router.resolve({ name: "VendorDetails", params: { id } });
    window.open(url.href, "_blank"); 
}


function reloadTable() {
    const dt = dtRef.value?.dt;
    if (dt) dt.ajax.reload(null, false); // false = mantém página
}

function setTableLoading(isLoading) {
    const dt = dtRef.value?.dt;
    if (dt) dt.processing(isLoading);
}

const resetGroupFilter = () => {
    groupOptions.value = [];
    const form = filterForm.value;
    if (form?.el$) {
        form.el$("group_id_search")?.update(null);
    }
};

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
        groupOptions.value = groups.map((group) => ({
            value: group.id,
            label: group.name,
        }));
    } catch (error) {
        console.error("Failed to load groups by unit", error);
    } finally {
        groupLoading.value = false;
    }
};

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
        data: "unit",
        title: "Comunidade",
        name: "unit",
        defaultContent: "-",
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
        data: "group",
        title: "Paróquia",
        name: "group",
        defaultContent: "-",
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

        console.log(data)

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
    }
}

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
    <div class="py-4 container-fluid">
        <div class="row">
            <div class="col-md-12 mb-lg-0 mb-4">
                <div class="card">
                    <div class="card-header pb-0">
                        <div class="row">
                            <div class="col-6 d-flex align-items-center">
                                <h6 class="mb-0">Vendedores</h6>
                            </div>
                            <div class="col-6 text-end">
                                <button class="btn text-white bg-success mb-0" type="button" @click="openModal">
                                    <i class="fas fa-plus"></i>&nbsp;&nbsp;Adicionar Vendedor
                                </button>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <Vueform ref="filterForm" :endpoint="false" @submit="handleFilter">
                                    <GroupElement name="container4" :columns="{
                                    container: 10,
                                }">
                                        <GroupElement name="column1" :columns="{
                                    container: 3,
                                }">
                                            <TextElement name="vendor_name" label="Nome Vendedor" />
                                        </GroupElement>
                                        <GroupElement name="column2" :columns="{
                                    container: 3,
                                }">
                                            <TextElement name="vendor_whatsapp" label="Whatsapp Vendedor"
                                                :mask="('(00) 00000-0000')" />
                                        </GroupElement>

                                        <GroupElement name="column3" :columns="{ container: 3 }">
                                            <SelectElement name="unit_id_search" :items="unitOptions" :search="true"
                                                :native="false" label="Comunidade" input-type="search"
                                                autocomplete="off" @change="handleUnitFilterChange" />
                                        </GroupElement>

                                        <GroupElement name="column4" :columns="{
                                    container: 3,
                                }">
                                            <SelectElement name="group_id_search" :items="groupOptions" :search="true"
                                                :native="false" label="Paróquia" input-type="search" autocomplete="off"
                                                :disabled="groupLoading || groupOptions.length === 0" />
                                        </GroupElement>
                                    </GroupElement>
                                    <GroupElement name="column5" :columns="{ container: 2 }">

                                        <GroupElement name="column6" :columns="{ container: 6 }">

                                            <ButtonElement name="submit" button-label="<i class='fas fa-search'></i>"
                                                :submits="true" :add-class="'mt-4 pt-2'" />

                                        </GroupElement>

                                        <GroupElement name="column6" :columns="{ container: 6 }">

                                            <ButtonElement name="reset" button-label="<i class='fas fa-undo'></i>"
                                                :submits="false" secondary @click="handleResetFilters"
                                                :add-class="'mt-4 pt-2'" />

                                        </GroupElement>

                                    </GroupElement>
                                </Vueform>
                            </div>
                        </div>
                    </div>

                    <div class="card-body">

                        <!-- ✅ DATATABLES AQUI -->
                        <DataTable ref="dtRef" class="table table-striped table-hover align-items-center mb-0"
                            :columns="columns" :options="options" :ajax="ajaxVendors">
                            <!-- slot pro nome virar link -->
                            <template #nameCell="props">
                                <a href="#" class="text-decoration-none fw-bold"
                                    @click.prevent="goToVendor(props.rowData.id)">
                                    {{ props.cellData }}
                                </a>
                            </template>

                            <template #actionsCell="props">
                                <div class="d-flex gap-3 align-items-center">
                                    <a href="#" title="Editar" @click.prevent="openEditModal(props.rowData)">
                                        <i class="fas fa-pen text-primary"></i>
                                    </a>

                                    <a href="#" title="Excluir" @click.prevent="confirmDelete(props.rowData)">
                                        <i class="fas fa-trash text-danger"></i>
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
