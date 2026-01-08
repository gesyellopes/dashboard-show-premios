<script setup>
import { ref, onBeforeUnmount, onBeforeMount } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import ArgonInput from "@/components/ArgonInput.vue";
import ArgonSwitch from "@/components/ArgonSwitch.vue";
import ArgonButton from "@/components/ArgonButton.vue";

import api from "@/services/api"; // ✅ crie esse arquivo (te passo abaixo)

const body = document.getElementsByTagName("body")[0];

const store = useStore();
const router = useRouter();

// ✅ form state
const email = ref("");
const password = ref("");
const rememberMe = ref(true);

const loading = ref(false);
const errorMsg = ref("");

// ✅ layout toggles (igual seu original)
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

// ✅ login handler
async function handleLogin() {
  errorMsg.value = "";

  if (!email.value || !password.value) {
    errorMsg.value = "Informe e-mail e senha.";
    return;
  }

  loading.value = true;

  try {
    const { data } = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });

    if (!data?.success) {
      errorMsg.value = data?.message || "Credenciais inválidas";
      return;
    }

    // ✅ salva no Vuex + storage (precisa das mutations no store)
    store.commit("setAuth", {
      token: data.token,
      user: data.user,
      remember: rememberMe.value,
    });

    // ✅ manda pro dashboard (ajuste se sua rota for outra)
    router.push("/dashboard-default");
  } catch (err) {
    errorMsg.value =
      err?.response?.data?.message || "Erro ao autenticar (rede/servidor).";
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
                  <p class="mb-0">Digite seu e-mail para continuar</p>
                </div>

                <div class="card-body">
                  <!-- ✅ submit.prevent chama o login -->
                  <form role="form" @submit.prevent="handleLogin">
                    <div class="mb-3">
                      <argon-input
                        id="email"
                        type="email"
                        placeholder="E-mail"
                        name="email"
                        size="lg"
                        v-model="email"
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

                    <!-- ✅ lembrar-me -->
                    <argon-switch id="rememberMe" name="remember-me" v-model="rememberMe">
                      lembrar-me
                    </argon-switch>

                    <!-- ✅ erro -->
                    <p v-if="errorMsg" class="text-danger text-sm mt-2 mb-0">
                      {{ errorMsg }}
                    </p>

                    <div class="text-center">
                      <argon-button
                        class="mt-4"
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

                <div class="px-1 pt-0 text-center card-footer px-lg-2">
                  <p class="mx-auto mb-4 text-sm">
                    Don't have an account?
                    <a
                      href="javascript:;"
                      class="text-success text-gradient font-weight-bold"
                    >
                      Sign up
                    </a>
                  </p>
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
