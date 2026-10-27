<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";

const store = useStore();
const route = useRoute();

const userRole = computed(() => store.state.auth.user?.role);
const isAdmin = computed(() => userRole.value === "admin");

// Primeiro segmento da rota atual, ex.: "/tickets/12" -> "tickets"
const currentSection = computed(() => route.path.split("/")[1]);

const menuItems = [
  { to: "/dashboard", label: "Dashboard", section: "dashboard" },
  { to: "/sorteios", label: "Sorteios", section: "sorteios", adminOnly: true },
  { to: "/tickets", label: "Cartelas", section: "tickets" },
  { to: "/canhotos", label: "Canhotos", section: "canhotos", adminOnly: true },
  { to: "/vendors", label: "Vendedores", section: "vendors" },
];

const visibleItems = computed(() => menuItems.filter((item) => !item.adminOnly || isAdmin.value));

// Menu de Configurações (mockado: subitens ainda não possuem rotas)
const settingsOpen = ref(false);
const settingsChildren = ["WhatsApp", "Mensagens", "Configurações"];

const closeOnSmallScreen = () => {
  if (window.innerWidth < 1200) {
    store.commit("sidebarMinimize");
  }
};
</script>
<template>
  <div class="collapse navbar-collapse w-auto h-100 sn-wrapper" id="sidenav-collapse-main">
    <nav class="sn-menu">
      <p class="sn-label">Menu</p>
      <ul class="sn-list">
        <li v-for="item in visibleItems" :key="item.to">
          <router-link
            :to="item.to"
            class="sn-link"
            :class="{ 'is-active': currentSection === item.section }"
            @click="closeOnSmallScreen"
          >
            {{ item.label }}
          </router-link>
        </li>
      </ul>

      <p class="sn-label">Sistema</p>
      <ul class="sn-list">
        <li>
          <button
            type="button"
            class="sn-link sn-toggle"
            :class="{ 'is-open': settingsOpen }"
            :aria-expanded="settingsOpen"
            @click="settingsOpen = !settingsOpen"
          >
            <span>Configurações</span>
            <span class="sn-chevron">&#9662;</span>
          </button>

          <ul v-show="settingsOpen" class="sn-sublist">
            <li v-for="sub in settingsChildren" :key="sub">
              <button type="button" class="sn-sublink" title="Em breve">
                {{ sub }}
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
/* Este elemento é o mesmo .navbar-collapse que o Argon deixa com overflow: auto;
   sobrescrevemos aqui para não exibir barra de rolagem */
.sn-wrapper.navbar-collapse {
  padding: 0.25rem 0.75rem 0.5rem;
  overflow: hidden;
}

.sn-menu {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sn-label {
  margin: 1.25rem 0.75rem 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.55;
}

.sn-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

/* Item principal */
.sn-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.55rem 0.9rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.sn-link:hover {
  background-color: rgba(127, 127, 127, 0.12);
  color: inherit;
  text-decoration: none;
}

.sn-link.is-active {
  background: linear-gradient(310deg, #5e72e4 0%, #825ee4 100%);
  color: #fff;
  box-shadow: 0 6px 16px rgba(94, 114, 228, 0.35);
}

/* Configurações (sanfona) */
.sn-chevron {
  font-size: 0.75rem;
  opacity: 0.6;
  transition: transform 0.25s ease;
}

.sn-toggle.is-open .sn-chevron {
  transform: rotate(180deg);
}

.sn-sublist {
  list-style: none;
  margin: 0.2rem 0 0.2rem 0.9rem;
  padding: 0 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-left: 1px solid rgba(127, 127, 127, 0.25);
}

.sn-sublink {
  display: block;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  opacity: 0.8;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.sn-sublink:hover {
  background-color: rgba(127, 127, 127, 0.12);
  opacity: 1;
}
</style>
