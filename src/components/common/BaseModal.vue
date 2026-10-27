<script setup>
import { onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false }, // v-model
  title: { type: String, default: "" },
  size: { type: String, default: "lg" }, // sm | lg | xl
  centered: { type: Boolean, default: true },
  contentClass: { type: String, default: "bg-default" },
  closeOnBackdrop: { type: Boolean, default: true },
});

const emit = defineEmits(["update:modelValue", "close"]);

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function lockBodyScroll(lock) {
  if (lock) {
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
  } else {
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
  }
}

watch(
  () => props.modelValue,
  (isOpen) => lockBodyScroll(isOpen),
  { immediate: true }
);

onBeforeUnmount(() => lockBodyScroll(false));

function onBackdropClick() {
  if (props.closeOnBackdrop) close();
}

function onKeydown(e) {
  if (e.key === "Escape" && props.modelValue) close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="modelValue">
    <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true">
      <div
        class="modal-dialog"
        :class="[size ? `modal-${size}` : '', centered ? 'modal-dialog-centered' : '']"
        role="document"
      >
        <div class="modal-content" :class="contentClass">
          <div class="modal-header">
            <slot name="header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" aria-label="Close" @click="close"></button>
            </slot>
          </div>

          <div class="modal-body">
            <slot />
          </div>

          <div class="modal-footer">
            <slot name="footer">
              <button class="btn btn-outline-dark mb-0" type="button" @click="close">
                Fechar
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-backdrop fade show" @click="onBackdropClick"></div>
  </div>
</template>