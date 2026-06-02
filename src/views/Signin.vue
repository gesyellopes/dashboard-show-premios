<script setup>
import { ref, onBeforeUnmount, onBeforeMount } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import ArgonInput from "@/components/ArgonInput.vue";
import ArgonButton from "@/components/ArgonButton.vue";

import { authService } from "@/services/authService";

const body = document.getElementsByTagName("body")[0];

const store = useStore();
const router = useRouter();

const phone = ref("");
const password = ref("");

const loading = ref(false);
const errorMsg = ref("");

// Formata telefone para (XX) X XXXX-XXXX
const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const handlePhoneInput = (e) => {
  phone.value = formatPhone(e.target.value);
};

onBeforeMount(() => {
  store.state.hideConfigButton = true;
  store.state.showNavbar = false;
  store.state.showSidenav = false;
  store.state.showFooter = false;
  body.classList.remove("bg-gray-100");
});

onBeforeUnmount(() => {
  store.state.hideConfigButton = false;
  store.state.showNavbar = true;
  store.state.showSidenav = true;
  store.state.showFooter = true;
  body.classList.add("bg-gray-100");
});

async function handleLogin() {
  errorMsg.value = "";

  if (!phone.value || !password.value) {
    errorMsg.value = "Informe telefone e senha.";
    return;
  }

  loading.value = true;

  try {
    const response = await authService.login(phone.value, password.value);

    if (!response.success) {
      errorMsg.value = response.message || "Credenciais inválidas";
      return;
    }

    store.commit("setAuth", {
      token: response.token,
      user: response.user,
      remember: true,
    });

    router.push("/dashboard");
  } catch (err) {
    errorMsg.value = "Erro ao autenticar. Tente novamente.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="mt-0 main-content">
    <section>
      <div class="page-header min-vh-100">
        <div class="container">
          <div class="row">
            <div
              class="mx-auto col-xl-4 col-lg-5 col-md-7 d-flex flex-column mx-lg-0"
            >
              <div class="card card-plain">
                <div class="pb-0 card-header text-start">
                  <h4 class="font-weight-bolder">Painel de Gerenciamento</h4>
                  <p class="mb-0">Digite seu telefone para continuar</p>
                </div>

                <div class="card-body">
                  <form role="form" @submit.prevent="handleLogin">
                    <div class="mb-3">
                      <argon-input
                        id="phone"
                        type="tel"
                        placeholder="(XX) X XXXX-XXXX"
                        name="phone"
                        size="lg"
                        v-model="phone"
                        @input="handlePhoneInput"
                      />
                    </div>

                    <div class="mb-3">
                      <argon-input
                        id="password"
                        type="password"
                        placeholder="Senha"
                        name="password"
                        size="lg"
                        v-model="password"
                      />
                    </div>

                    <p v-if="errorMsg" class="text-danger text-sm mt-2 mb-3">
                      {{ errorMsg }}
                    </p>

                    <div class="text-center">
                      <argon-button
                        class="mt-2"
                        variant="gradient"
                        color="success"
                        fullWidth
                        size="lg"
                        type="submit"
                        :disabled="loading"
                      >
                        {{ loading ? "Acessando..." : "Acessar" }}
                      </argon-button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div
              class="top-0 my-auto text-center col-6 d-lg-flex d-none h-100 pe-0 position-absolute end-0 justify-content-center flex-column"
            >
              <div
                class="position-relative bg-gradient-primary h-100 m-3 px-7 border-radius-lg d-flex flex-column justify-content-center overflow-hidden"
                style="
                  background-image: url('https://storage.showdepremios.cloud/file/1767064822587.png');
                  background-size: cover;
                "
              >
                <span class="mask bg-gradient-success opacity-2"></span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  </main>
</template>
