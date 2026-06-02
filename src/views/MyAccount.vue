<script setup>
import { computed, onBeforeMount, onBeforeUnmount, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import ArgonButton from "@/components/ArgonButton.vue";
import { ROLE_PERMISSIONS } from "@/mocks/users";

const store = useStore();
const router = useRouter();

const user = computed(() => store.state.auth.user);

const roleLabel = computed(() => {
  const roleMap = {
    admin: "Administrador",
    manager: "Gerente",
    user: "Usuário"
  };
  return roleMap[user.value?.role] || "Usuário";
});

const permissions = computed(() => {
  return ROLE_PERMISSIONS[user.value?.role] || [];
});

const permissionLabels = computed(() => {
  const labels = {
    read: "Visualizar",
    write: "Editar",
    delete: "Deletar",
    manage_users: "Gerenciar Usuários",
    manage_vendors: "Gerenciar Vendedores"
  };
  return permissions.value.map(p => labels[p] || p);
});

const formatPhoneDisplay = (phone) => {
  if (!phone) return "";
  const cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.length !== 11) return phone;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
};

const handleLogout = () => {
  store.commit("clearAuth");
  router.push("/signin");
};

onBeforeMount(() => {
  store.state.showNavbar = true;
  store.state.showSidenav = true;
  store.state.showFooter = true;
  store.state.hideConfigButton = false;
});

onBeforeUnmount(() => {
  // cleanup
});

onMounted(() => {
  if (!user.value) {
    router.push("/signin");
  }
});
</script>

<template>
  <main class="mt-0 main-content" v-if="user">
    <section class="h-auto py-5">
      <div class="container">
        <div class="row">
          <div class="col-12">
            <!-- Header Card -->
            <div class="card shadow-lg mb-4 border-0">
              <div class="card-body p-4">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <div class="avatar avatar-xl">
                      <img
                        :src="user.avatar"
                        :alt="user.name"
                        class="shadow-sm w-100 border-radius-lg"
                        style="width: 100px; height: 100px"
                      />
                    </div>
                  </div>
                  <div class="col">
                    <div class="mb-2">
                      <h4 class="mb-1 font-weight-bold">{{ user.name }}</h4>
                      <p class="text-sm text-muted mb-0">
                        <span class="badge bg-success">{{ roleLabel }}</span>
                      </p>
                    </div>
                  </div>
                  <div class="col-auto">
                    <argon-button
                      color="danger"
                      variant="gradient"
                      @click="handleLogout"
                    >
                      <i class="fas fa-sign-out-alt me-2"></i>
                      Sair
                    </argon-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Profile Details - OCULTO -->
            <div class="row" v-if="false">
              <div class="col-lg-6">
                <div class="card shadow-lg mb-4 border-0">
                  <div class="card-header bg-gradient-success border-0">
                    <h5 class="text-white mb-0">Informações Pessoais</h5>
                  </div>
                  <div class="card-body">
                    <div class="mb-3 pb-3 border-bottom">
                      <p class="text-muted text-sm mb-1">Telefone</p>
                      <p class="font-weight-bold">{{ formatPhoneDisplay(user.phone) }}</p>
                    </div>
                    <div class="mb-3 pb-3 border-bottom">
                      <p class="text-muted text-sm mb-1">Departamento</p>
                      <p class="font-weight-bold">{{ user.department }}</p>
                    </div>
                    <div class="mb-3 pb-3 border-bottom">
                      <p class="text-muted text-sm mb-1">Telefone</p>
                      <p class="font-weight-bold">{{ user.phone }}</p>
                    </div>
                    <div>
                      <p class="text-muted text-sm mb-1">Localização</p>
                      <p class="font-weight-bold">{{ user.location }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-lg-6">
                <div class="card shadow-lg border-0">
                  <div class="card-header bg-gradient-info border-0">
                    <h5 class="text-white mb-0">Permissões</h5>
                  </div>
                  <div class="card-body">
                    <div class="mb-3">
                      <p class="text-muted text-sm mb-2">Função no Sistema</p>
                      <p class="font-weight-bold text-lg">{{ roleLabel }}</p>
                    </div>
                    <div class="mb-3">
                      <p class="text-muted text-sm mb-2">Acesso Permitido</p>
                      <div class="d-flex flex-wrap gap-2">
                        <span
                          v-for="perm in permissionLabels"
                          :key="perm"
                          class="badge bg-light text-dark"
                        >
                          {{ perm }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Account Stats -->
                <div class="card shadow-lg border-0 mt-4">
                  <div class="card-header bg-gradient-warning border-0">
                    <h5 class="text-white mb-0">Estatísticas da Conta</h5>
                  </div>
                  <div class="card-body">
                    <div class="row">
                      <div class="col-6 mb-3">
                        <p class="text-muted text-sm mb-1">ID do Usuário</p>
                        <p class="font-weight-bold">#{{ user.id }}</p>
                      </div>
                      <div class="col-6 mb-3">
                        <p class="text-muted text-sm mb-1">Status</p>
                        <p class="font-weight-bold">
                          <span class="badge bg-success">Ativo</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Demo Users Info - OCULTO -->
            <div class="card shadow-lg border-0 mt-4" v-if="false">
              <div class="card-header bg-gradient-secondary border-0">
                <h5 class="text-white mb-0">Usuários de Demonstração Disponíveis</h5>
              </div>
              <div class="card-body">
                <p class="text-muted mb-3 text-sm">
                  Este é um sistema com autenticação mockada. Você pode acessar com as seguintes credenciais:
                </p>
                <div class="table-responsive">
                  <table class="table table-sm table-hover mb-0">
                    <thead>
                      <tr>
                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder">Telefone</th>
                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder">Senha</th>
                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder">Função</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="text-sm">(11) 98765-4321</td>
                        <td class="text-sm"><code>admin123</code></td>
                        <td><span class="badge bg-success">Admin</span></td>
                      </tr>
                      <tr>
                        <td class="text-sm">(11) 98765-4322</td>
                        <td class="text-sm"><code>manager123</code></td>
                        <td><span class="badge bg-info">Gerente</span></td>
                      </tr>
                      <tr>
                        <td class="text-sm">(21) 98765-4323</td>
                        <td class="text-sm"><code>manager123</code></td>
                        <td><span class="badge bg-info">Gerente</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}

.badge {
  font-weight: 600;
  padding: 0.4rem 0.8rem;
  display: inline-block;
}

code {
  background-color: #f8f9fa;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  color: #e3165b;
  font-size: 0.875rem;
}
</style>
