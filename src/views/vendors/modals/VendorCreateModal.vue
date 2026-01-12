<script setup>
import { computed, ref, watch } from "vue";
import BaseModal from "../../components/BaseModal.vue";

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

const vendorForm = ref(null);

function close() {
  isOpen.value = false;
  emit("close");
  vendorForm.value?.reset();
}

function onSubmit(form$) {
  emit("submit", form$);
}

// quando abrir, garante form limpo
watch(
  () => props.modelValue,
  (open) => {
    if (open) vendorForm.value?.reset();
  }
);
</script>

<template>
  <BaseModal
    v-model="isOpen"
    title="Cadastrar Vendedores"
    size="lg"
    contentClass="bg-default"
    @close="close"
  >
    <div class="vf-scope p-3">
      <Vueform ref="vendorForm" :endpoint="false" @submit="onSubmit">
        <GroupElement name="container2_2">
          <GroupElement name="column1" :columns="{ container: 6 }">
            <SelectElement
              name="unit_id"
              :items="unitOptions"
              :search="true"
              :native="false"
              label="Comunidade"
              input-type="search"
              autocomplete="off"
              :rules="['required']"
            />
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
            <TextElement
              name="vendor_whatsapp"
              label="Whatsapp Vendedor"
              input-type="text"
              mask="(00) 0 0000-0000"
              :rules="['required']"
            />
          </GroupElement>
        </GroupElement>

        <StaticElement name="h4" tag="h4" content="Cartelas" />
        <StaticElement
          name="p"
          tag="p"
          content="<div>Indique o intervalo das cartelas entregues ao vendedor. <br>Exemplo: Se passou as cartelas de <strong>000001 </strong>até a cartela <strong>000100 </strong>indique no campo abaixo:</div>"
        />

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
            <TextElement
              name="ticket_from"
              input-type="text"
              :rules="['required']"
              autocomplete="off"
              label="Cartela Inicial"
              mask="000000"
            />
          </GroupElement>

          <GroupElement name="column2" :columns="{ container: 6 }">
            <TextElement
              name="ticket_to"
              input-type="text"
              :rules="['required']"
              autocomplete="off"
              label="Cartela Final"
              mask="000000"
            />
          </GroupElement>
        </GroupElement>

        <ButtonElement
          name="submit"
          button-label="Cadastrar Vendedor"
          :submits="true"
          size="lg"
          align="center"
          :full="true"
          :loading="submitLoading"
        />
      </Vueform>
    </div>

    <template #footer>
      <button class="btn btn-outline-dark mb-0" type="button" @click="close">
        Fechar
      </button>
    </template>
  </BaseModal>
</template>
