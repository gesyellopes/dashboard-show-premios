<script setup>
import { computed, ref, watch } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false }, // v-model do pai
  unitOptions: { type: Array, default: () => [] },
  submitLoading: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "submit", "close"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const EMPTY_FORM = { vendor_name: "", vendor_whatsapp: "", ticket_from: "", ticket_to: "" };
const TICKET_DIGITS = 6;
const WHATSAPP_DIGITS = 11;

const form = ref({ ...EMPTY_FORM });
const errors = ref({});

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

// máscara do WhatsApp enquanto digita: (00) 0 0000-0000
function formatPhoneInput(digits) {
  const d = digits.slice(0, WHATSAPP_DIGITS);
  if (!d) return "";
  let out = `(${d.slice(0, 2)}`;
  if (d.length < 2) return out;
  out += ")";
  if (d.length > 2) out += ` ${d.slice(2, 3)}`;
  if (d.length > 3) out += ` ${d.slice(3, 7)}`;
  if (d.length > 7) out += `-${d.slice(7, 11)}`;
  return out;
}

function onPhoneInput(e) {
  const digits = digitsOnly(e.target.value).slice(0, WHATSAPP_DIGITS);
  form.value.vendor_whatsapp = digits;
  e.target.value = formatPhoneInput(digits);
}

// cartelas aceitam somente dígitos, até 6
function onTicketInput(key, e) {
  const digits = digitsOnly(e.target.value).slice(0, TICKET_DIGITS);
  form.value[key] = digits;
  e.target.value = digits;
}

function validate() {
  const next = {};
  if (!form.value.vendor_name.trim()) next.vendor_name = "Informe o nome do vendedor";
  if (form.value.vendor_whatsapp.length !== WHATSAPP_DIGITS) next.vendor_whatsapp = "Informe um WhatsApp válido";
  if (!form.value.ticket_from) next.ticket_from = "Informe a cartela inicial";
  if (!form.value.ticket_to) next.ticket_to = "Informe a cartela final";
  errors.value = next;
  return Object.keys(next).length === 0;
}

function submit() {
  if (props.submitLoading || !validate()) return;

  emit("submit", {
    requestData: {
      vendor_name: form.value.vendor_name.trim(),
      vendor_whatsapp: form.value.vendor_whatsapp,
      ticket_from: form.value.ticket_from,
      ticket_to: form.value.ticket_to,
    },
  });
}

function resetForm() {
  form.value = { ...EMPTY_FORM };
  errors.value = {};
}

function close() {
  isOpen.value = false;
  emit("close");
  resetForm();
}

// quando abrir, garante form limpo
watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm();
  }
);
</script>

<template>
  <BaseModal
    v-model="isOpen"
    title="Cadastrar Vendedor"
    size="lg"
    contentClass="bg-default"
    hideFooter
    class="vd-page vd-modal-form"
    @close="close"
  >
    <form class="vd-form" novalidate @submit.prevent="submit">
      <section class="vd-form-section">
        <h6 class="vd-form-section-title"><i class="fas fa-user-tie"></i>Dados do vendedor</h6>

        <div class="row g-3">
          <div class="col-md-6">
            <div class="vd-field">
              <label class="vd-field-label" for="vdCreateName">Nome do vendedor</label>
              <div class="vd-input-wrap" :class="{ 'has-value': form.vendor_name, 'is-invalid': errors.vendor_name }">
                <i class="fas fa-user vd-input-icon"></i>
                <input id="vdCreateName" v-model="form.vendor_name" type="text" class="vd-input-field"
                  placeholder="Ex.: João Souza" autocomplete="off" />
              </div>
              <small v-if="errors.vendor_name" class="vd-field-error">{{ errors.vendor_name }}</small>
            </div>
          </div>

          <div class="col-md-6">
            <div class="vd-field">
              <label class="vd-field-label" for="vdCreateWhatsapp">Whatsapp do vendedor</label>
              <div class="vd-input-wrap" :class="{ 'has-value': form.vendor_whatsapp, 'is-invalid': errors.vendor_whatsapp }">
                <i class="fas fa-phone vd-input-icon"></i>
                <input id="vdCreateWhatsapp" :value="formatPhoneInput(form.vendor_whatsapp)" type="text"
                  inputmode="tel" class="vd-input-field" placeholder="(00) 0 0000-0000" autocomplete="off"
                  @input="onPhoneInput" />
              </div>
              <small v-if="errors.vendor_whatsapp" class="vd-field-error">{{ errors.vendor_whatsapp }}</small>
            </div>
          </div>
        </div>
      </section>

      <section class="vd-form-section">
        <h6 class="vd-form-section-title"><i class="fas fa-ticket"></i>Cartelas</h6>
        <p class="vd-form-help">
          Indique o intervalo das cartelas entregues ao vendedor. Exemplo: se passou das cartelas
          <strong>000001</strong> até a <strong>000100</strong>, preencha:
        </p>

        <div class="row g-3">
          <div class="col-md-6">
            <div class="vd-field">
              <label class="vd-field-label" for="vdCreateTicketFrom">Cartela inicial</label>
              <div class="vd-input-wrap" :class="{ 'has-value': form.ticket_from, 'is-invalid': errors.ticket_from }">
                <i class="fas fa-hashtag vd-input-icon"></i>
                <input id="vdCreateTicketFrom" :value="form.ticket_from" type="text" inputmode="numeric"
                  class="vd-input-field vd-input-mono" placeholder="000001" autocomplete="off"
                  @input="onTicketInput('ticket_from', $event)" />
              </div>
              <small v-if="errors.ticket_from" class="vd-field-error">{{ errors.ticket_from }}</small>
            </div>
          </div>

          <div class="col-md-6">
            <div class="vd-field">
              <label class="vd-field-label" for="vdCreateTicketTo">Cartela final</label>
              <div class="vd-input-wrap" :class="{ 'has-value': form.ticket_to, 'is-invalid': errors.ticket_to }">
                <i class="fas fa-hashtag vd-input-icon"></i>
                <input id="vdCreateTicketTo" :value="form.ticket_to" type="text" inputmode="numeric"
                  class="vd-input-field vd-input-mono" placeholder="000100" autocomplete="off"
                  @input="onTicketInput('ticket_to', $event)" />
              </div>
              <small v-if="errors.ticket_to" class="vd-field-error">{{ errors.ticket_to }}</small>
            </div>
          </div>
        </div>
      </section>

      <div class="vd-form-actions">
        <button class="vd-btn-cancel" type="button" @click="close">
          <i class="fas fa-xmark me-1"></i>Cancelar
        </button>

        <button class="vd-submit" type="submit" :disabled="submitLoading">
          <i v-if="!submitLoading" class="fas fa-check me-1"></i>
          <i v-else class="fas fa-spinner fa-spin me-1"></i>
          Cadastrar Vendedor
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style>
/* Estilos do formulário seguem os campos do painel de filtros (.vd-field / .vd-input-wrap, definidos em Vendors.vue) */
.vd-modal-form .vd-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.vd-modal-form .vd-form-section {
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--vd-border);
  border-radius: 0.75rem;
  background: var(--vd-surface);
}
.vd-modal-form .vd-form-section-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
  font-weight: 700;
  color: var(--vd-text);
}
.vd-modal-form .vd-form-section-title i {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  color: #fff;
  background: linear-gradient(135deg, var(--vd-primary), var(--vd-primary-2));
}
.vd-modal-form .vd-form-help {
  margin-bottom: 0.9rem;
  font-size: 0.85rem;
  color: var(--vd-muted);
}
.vd-modal-form .vd-input-wrap.is-invalid {
  border-color: var(--vd-danger);
}
.vd-modal-form .vd-field-error {
  font-size: 0.72rem;
  color: #fda4af;
}
.vd-modal-form .vd-input-mono {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}
.vd-modal-form .vd-form-actions {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 2fr;
  gap: 0.75rem;
}
.vd-modal-form .vd-submit {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--vd-success), #26b87a);
  box-shadow: 0 6px 14px -6px rgba(45, 206, 137, 0.6);
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.vd-modal-form .vd-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -8px rgba(45, 206, 137, 0.7);
}
.vd-modal-form .vd-submit:disabled {
  opacity: 0.7;
}
/* Header com divisória discreta, no mesmo tom das bordas do painel */
.vd-modal-form .modal-header {
  border-color: var(--vd-border) !important;
}
.vd-modal-form .vd-btn-cancel {
  padding: 0.75rem 1rem;
  border: 1px solid var(--vd-border);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vd-muted);
  background: transparent;
  transition: background 0.2s, color 0.2s;
}
.vd-modal-form .vd-btn-cancel:hover {
  color: var(--vd-text);
  background: var(--vd-surface-2);
}
</style>
