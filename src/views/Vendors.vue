<script setup>
import { onMounted, ref } from "vue";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

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

function reloadTable() {
    const dt = dtRef.value?.dt;
    if (dt) dt.ajax.reload(null, false); // false = mantém página
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
    searching: true,
    lengthChange: false,
    pageLength: 20,
    ordering: false,
    responsive: true,
    stateSave: false,   // não salva estado na URL/storage
    searchDelay: 400,   // debounce do search (reduz spam)
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
        const q = (dtRequest.search?.value || "").trim();

        const endpoint = q ? "/vendors/search" : "/vendors";

        const { data } = await api.get(endpoint, {
            params: {
                page,
                limit: length,
                ...(q ? { q } : {}),
            },
        });

        console.log(data)

        const meta = data?.meta || {};
        const rows = data?.data || [];

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
                                <button class="btn bg-gradient-dark mb-0" type="button" @click="openModal">
                                    <i class="fas fa-plus"></i>&nbsp;&nbsp;Adicionar Vendedor
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="card-body">

                        <!-- ✅ DATATABLES AQUI -->
                        <DataTable ref="dtRef" class="table table-striped table-hover align-items-center mb-0"
                            :columns="columns" :options="options" :ajax="ajaxVendors">
                            <!-- slot pro nome virar link -->
                            <template #nameCell="props">
                                {{ props.cellData }}
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

        <!-- MODAL EDIT -->
        <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true">
            <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                <div class="modal-content bg-default">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Vendedor</h5>
                        <button type="button" class="btn-close" aria-label="Close" @click="closeEditModal"></button>
                    </div>

                    <div class="modal-body">
                        <div class="p-3">
                            <p class="mb-2"><strong>ID:</strong> {{ editingVendor?.id }}</p>
                            <p class="mb-2"><strong>Nome:</strong> {{ editingVendor?.name }}</p>
                            <p class="mb-2"><strong>WhatsApp:</strong> {{ editingVendor?.whatsapp }}</p>
                            <p class="mb-0 text-secondary">Aqui você coloca o Vueform de edição depois.</p>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-outline-dark mb-0" type="button" @click="closeEditModal">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showEditModal" class="modal-backdrop fade show"></div>


        <!-- MODAL -->
        <div v-if="showModal" class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true">
            <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                <div class="modal-content bg-default">
                    <div class="modal-header">
                        <h5 class="modal-title">Cadastrar Vendedores</h5>
                        <button type="button" class="btn-close" aria-label="Close" @click="closeModal"></button>
                    </div>

                    <div class="modal-body">
                        <div class="vf-scope p-3">
                            <Vueform ref="vendorForm" :endpoint="false" @submit="handleSubmit">
                                <GroupElement name="container2_2">
                                    <GroupElement name="column1" :columns="{ container: 6 }">
                                        <SelectElement name="unit_id" :items="unitOptions" :search="true"
                                            :native="false" label="Comunidade" input-type="search" autocomplete="off"
                                            :rules="['required']" />
                                    </GroupElement>

                                    <GroupElement name="column2" :columns="{ container: 6 }">
                                        <TextElement name="group_name" label="Paróquia" :rules="['required']" />
                                    </GroupElement>
                                </GroupElement>

                                <GroupElement name="container2_3">
                                    <GroupElement name="column1" :columns="{ container: 6 }">
                                        <TextElement name="vendor_name" label="Nome do Vendedor" :rules="['required']" />
                                    </GroupElement>

                                    <GroupElement name="column2" :columns="{ container: 6 }">
                                        <TextElement name="vendor_whatsapp" label="Whatsapp Vendedor" input-type="text"
                                            mask="(00) 0 0000-0000" :rules="['required']" />
                                    </GroupElement>
                                </GroupElement>

                                <StaticElement name="h4" tag="h4" content="Cartelas" />
                                <StaticElement name="p" tag="p"
                                    content="<div>Indique o intervalo das cartelas entregues ao vendedor. <br>Exemplo: Se passou as cartelas de <strong>000001 </strong>até a cartela <strong>000100 </strong>indique no campo abaixo:</div>" />

                                <GroupElement name="container2_1">
                                    <GroupElement name="column1" :columns="{ container: 6 }">
                                        <StaticElement name="p_1" tag="p"
                                            content="<div><strong>Cartela Inicial:</strong> 000001</div>" />
                                    </GroupElement>

                                    <GroupElement name="column2" :columns="{ container: 6 }">
                                        <StaticElement name="p_2" tag="p"
                                            content="<div><strong>Cartela Final:</strong> 000100</div>" />
                                    </GroupElement>
                                </GroupElement>

                                <GroupElement name="container2">
                                    <GroupElement name="column1" :columns="{ container: 6 }">
                                        <TextElement name="ticket_from" input-type="text"
                                            :rules="['required']" autocomplete="off"
                                            label="Cartela Inicial" mask="000000" />
                                    </GroupElement>

                                    <GroupElement name="column2" :columns="{ container: 6 }">
                                        <TextElement name="ticket_to" input-type="text"
                                            :rules="['required']" autocomplete="off" label="Cartela Final" mask="000000" />
                                    </GroupElement>
                                </GroupElement>

                                <ButtonElement name="submit" button-label="Cadastrar Vendedor" :submits="true" size="lg"
                                    align="center" :full="true" :loading="submitLoading" />
                            </Vueform>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal-backdrop fade show"></div>
    </div>
</template>
