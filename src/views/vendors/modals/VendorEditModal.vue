<script setup>
import { computed, ref, watch } from "vue";
import DataTable from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import Swal from "sweetalert2";

import BaseModal from "../../components/BaseModal.vue";
import api from "@/services/api";

DataTable.use(DataTablesCore);

// ===== helpers =====
const verifiedPercent = (verified, total) => {
  const v = Number(verified ?? 0);
  const t = Number(total ?? 0);
  if (!t) return "0.00";
  return ((v / t) * 100).toFixed(2);
};

function formatBrWhatsapp(raw) {
  if (!raw) return "-";
  const digits = String(raw).replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits.slice(2) : digits;

  if (number.length !== 11) return raw;

  const ddd = number.slice(0, 2);
  const first = number.slice(2, 3);
  const middle = number.slice(3, 7);
  const last = number.slice(7);

  return `(${ddd}) ${first} ${middle}-${last}`;
}

// ===== props / emits =====
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  vendor: { type: Object, default: null },

  // ✅ necessário para o SelectElement de Comunidade no modal de range
  unitOptions: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:modelValue", "close", "reload-parent"]);

// v-model proxy do modal principal
const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// ===== DataTable: Ranges =====
const rangeDtRef = ref(null);

const rangeColumns = [
  { data: "group_name", title: "Comunidade", name: "group_name" },
  { data: "unit_name", title: "Paróquia", name: "unit_name" },
  {
    data: null,
    title: "Cartelas",
    name: "ticket_range",
    render: (row) => `${row.ticket_from} - ${row.ticket_to}`,
  },
  { data: "total", title: "Nº Cartelas", name: "total", defaultContent: "0" }
];

const rangeOptions = {
  processing: true,
  serverSide: false,
  searching: false,
  paging: false,
  info: false,
  ordering: false,
  responsive: true,
};

const reloadRangeTable = () => {
  const dt = rangeDtRef.value?.dt;
  if (dt) dt.ajax.reload();
  emit("reload-parent");
  fetchTickets()
};

function ajaxRanges(dtRequest, callback) {
  const controller = new AbortController();

  const run = async () => {
    try {
      const vendorId = props.vendor?.id;
      if (!vendorId) {
        callback({
          draw: dtRequest.draw,
          data: [],
          recordsTotal: 0,
          recordsFiltered: 0,
        });
        return;
      }

      const { data } = await api.get(`/vendors/${vendorId}/range`, {
        signal: controller.signal,
      });

      // esperado: data.data.groups = [{ unit_name, group_name, ranges:[...] }]
      const groups = data?.data?.groups || [];

      const rows = groups.flatMap((group) =>
        (group.ranges || []).map((range) => ({
          unit_name: group.unit_name,
          group_name: group.group_name,
          ticket_from: range.ticket_from,
          ticket_to: range.ticket_to,
          total: range.total,
          verified: range.verified ?? 0,
        }))
      );

      callback({
        draw: dtRequest.draw,
        data: rows,
        recordsTotal: rows.length,
        recordsFiltered: rows.length,
      });
    } catch (error) {
      if (error?.name !== "CanceledError") {
        console.error("Ranges ajax error:", error);
      }
      callback({
        draw: dtRequest.draw,
        data: [],
        recordsTotal: 0,
        recordsFiltered: 0,
      });
    }
  };

  run();

  return {
    abort: () => controller.abort(),
  };
}

// ===== Notifications =====
const requestTicketRegistration = async (vendorId) => {
  try {
    const { data } = await api.get(
      `/notifications/request-ticket-registration/${vendorId}`
    )

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Mensagem enviada!',
        text: 'A solicitação de registro foi enviada com sucesso.',
      })
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: data.message || 'Não foi possível enviar a mensagem.',
      })
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Erro ao comunicar com o servidor.',
    })
  }
}

// ===== Tickets (view estilo "retângulos") =====
const tickets = ref([])
const ticketsLoading = ref(false)

const fetchTickets = async () => {
  const vendorId = props.vendor?.id
  if (!vendorId) {
    tickets.value = []
    return
  }

  ticketsLoading.value = true
  try {
    const { data } = await api.get(`/vendors/${vendorId}/tickets`)
    tickets.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error("fetchTickets error:", e)
    tickets.value = []
  } finally {
    ticketsLoading.value = false
  }
}

// 10 por linha (chunks)
const ticketRows = computed(() => {
  const list = tickets.value ?? []
  const rows = []
  for (let i = 0; i < list.length; i += 10) rows.push(list.slice(i, i + 10))
  return rows
})

// prioridade: paid > validated > warning
const ticketClass = (t) => {
  if (Number(t?.paid) === 1) return "bg-success text-white"
  if (Number(t?.validated) === 1) return "bg-info text-white"
  return "bg-warning text-dark"
}


// ===== Modal: Add Range =====
const showAddRangeModal = ref(false);
const addRangeLoading = ref(false);
const addRangeForm = ref(null);

function openAddRangeModal() {
  showAddRangeModal.value = true;
}

function closeAddRangeModal() {
  showAddRangeModal.value = false;
  addRangeForm.value?.reset();
}

async function handleAddRangeSubmit(form$) {
  const vendorId = props.vendor?.id;
  if (!vendorId) return;

  const payload = form$?.requestData ?? {};
  addRangeLoading.value = true;

  try {
    const { data } = await api.post(`/vendors/update-range/${vendorId}`, payload);

    const ok = data === true || data?.success === true;

    if (ok) {
      closeAddRangeModal();
      reloadRangeTable();
      return;
    }

    // se seu backend devolve {success:false,message:"..."}
    // aqui só loga, porque você não pediu SweetAlert neste modal.
    console.error("Failed to update range:", data?.message || data);
  } catch (error) {
    console.error("Failed to update range:", error);
  } finally {
    addRangeLoading.value = false;
  }
}

// ===== Modal principal close =====
function close() {
  isOpen.value = false;
  emit("close");
}

// recarrega ranges quando abrir e tiver vendor
watch(
  () => [props.vendor?.id, isOpen.value],
  ([vendorId, open]) => {
    if (vendorId && open)
      reloadRangeTable()
    fetchTickets()
  }
);

// quando abrir o modal de range, zera formulário
watch(
  () => showAddRangeModal.value,
  (open) => {
    if (open) addRangeForm.value?.reset();
  }
);
</script>

<template>
  <BaseModal v-model="isOpen" title="Detalhes do Vendedor" size="lg" contentClass="bg-default" @close="close">
    <div class="row">
      <div class="col-6">
        <div class="p-3">
          {{ vendor.id }}
          <p class="mb-2"><strong>Nome:</strong> {{ vendor?.name }}</p>
          <p class="mb-2"><strong>WhatsApp:</strong> {{ formatBrWhatsapp(vendor?.whatsapp) }}</p>
          <p class="mb-2"><strong>Total Cartelas:</strong> {{ vendor?.tickets_total ?? 0 }}</p>
          <p class="mb-2">
            <strong>Verificadas:</strong>
            {{ vendor?.tickets_verified ?? 0 }} |
            {{ verifiedPercent(vendor?.tickets_verified, vendor?.tickets_total) }}%
          </p>
        </div>
      </div>

      <!-- ✅ coluna direita com espaçamento lateral esquerdo -->
      <div class="col-6">
        <div class="p-3 ps-4 d-flex gap-2 justify-content-end flex-wrap">

          <a v-if="vendor.tickets_verified < vendor.tickets_total" class="btn btn-warning mb-0" href="#"
            @click.prevent="requestTicketRegistration(vendor.id)">
            Cobrar Registro
          </a>


          <button class="btn btn-info mb-0" type="button" @click="openAddRangeModal">
            Adicionar Range
          </button>
        </div>
      </div>
    </div>

    <h6 class="px-3 mt-3 mb-2">Cartelas</h6>

    <DataTable ref="rangeDtRef" class="table table-striped table-hover align-items-center mb-0" :columns="rangeColumns"
      :options="rangeOptions" :ajax="ajaxRanges" />

    <div class="px-3 mt-3">
      <div v-if="ticketsLoading" class="text-muted small">Carregando cartelas...</div>

      <div v-else-if="!tickets?.length" class="text-muted small">
        Nenhuma cartela encontrada para este vendedor.
      </div>

      <div class="tickets-wrap">
        <div v-for="(row, rIdx) in ticketRows" :key="`row-${rIdx}`" class="tickets-grid mb-2">
          <div v-for="t in row" :key="t.id" class="ticket-box fw-bold" :class="ticketClass(t)">
            {{ t.ticket_number }}
          </div>
        </div>
      </div>


    </div>

    <!-- ===== MODAL: ADD RANGE ===== -->
    <BaseModal v-model="showAddRangeModal" title="Adicionar Range" size="lg" contentClass="bg-default"
      @close="closeAddRangeModal">
      <div class="vf-scope p-3">
        <Vueform ref="addRangeForm" :endpoint="false" @submit="handleAddRangeSubmit">
          <!-- Comunidade + Paróquia -->
          <GroupElement name="container2_2">
            <GroupElement name="column1" :columns="{ container: 6 }">
              <SelectElement name="unit_id" :items="unitOptions" :search="true" :native="false" label="Comunidade"
                input-type="search" autocomplete="off" :rules="['required']" />
            </GroupElement>

            <GroupElement name="column2" :columns="{ container: 6 }">
              <TextElement name="group_name" label="Paróquia" :rules="['required']" />
            </GroupElement>
          </GroupElement>

          <!-- 🔥 removido Nome e WhatsApp -->

          <StaticElement name="h4" tag="h4" content="Cartelas" />
          <StaticElement name="p" tag="p"
            content="<div>Indique o intervalo das cartelas entregues ao vendedor. <br>Exemplo: Se passou as cartelas de <strong>000001 </strong>até a cartela <strong>000100 </strong>indique no campo abaixo:</div>" />

          <GroupElement name="container2_1">
            <GroupElement name="column1" :columns="{ container: 6 }">
              <StaticElement name="p_1" tag="p" content="<div><strong>Cartela Inicial:</strong> 000001</div>" />
            </GroupElement>

            <GroupElement name="column2" :columns="{ container: 6 }">
              <StaticElement name="p_2" tag="p" content="<div><strong>Cartela Final:</strong> 000100</div>" />
            </GroupElement>
          </GroupElement>

          <GroupElement name="container2">
            <GroupElement name="column1" :columns="{ container: 6 }">
              <TextElement name="ticket_from" input-type="text" :rules="['required']" autocomplete="off"
                label="Cartela Inicial" mask="000000" />
            </GroupElement>

            <GroupElement name="column2" :columns="{ container: 6 }">
              <TextElement name="ticket_to" input-type="text" :rules="['required']" autocomplete="off"
                label="Cartela Final" mask="000000" />
            </GroupElement>
          </GroupElement>

          <ButtonElement name="submit" button-label="Salvar Range" :submits="true" size="lg" align="center" :full="true"
            :loading="addRangeLoading" />
        </Vueform>
      </div>

      <template #footer>
        <button class="btn btn-outline-dark mb-0" type="button" @click="closeAddRangeModal">
          Cancelar
        </button>
      </template>
    </BaseModal>
    <!-- ===== /MODAL: ADD RANGE ===== -->

    <template #footer>
      <button class="btn btn-primary mb-0" type="button" @click="close">
        Fechar
      </button>
    </template>
  </BaseModal>
</template>


<style>
/* wrapper que segura dentro do modal */
.tickets-wrap {
  max-width: 100%;
  overflow-x: auto;
  /* se faltar espaço, rola ao invés de vazar */
  overflow-y: hidden;
  padding-bottom: 6px;
  /* espaço pro scroll não colar nos blocos */
}

/* grid fixo com 10 colunas, mas SEM estourar o container */
.tickets-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  /* minmax(0) evita overflow */
  gap: 8px;
  width: 100%;
}

/* blocos não podem forçar largura */
.ticket-box {
  height: 42px;
  min-width: 0;
  /* importante */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
  user-select: none;
}
</style>