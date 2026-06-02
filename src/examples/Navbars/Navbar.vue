<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import Breadcrumbs from "../Breadcrumbs.vue";

const store = useStore();
const router = useRouter();
const isRTL = computed(() => store.state.isRTL);

const route = useRoute();

const user = computed(() => store.state.auth.user);
const isAuthenticated = computed(() => !!store.state.auth.token);

const currentRouteName = computed(() => {
  return route.name;
});

const currentDirectory = computed(() => {
  let dir = route.path.split("/")[1];
  return dir.charAt(0).toUpperCase() + dir.slice(1);
});

const minimizeSidebar = () => store.commit("sidebarMinimize");

const handleLogout = () => {
  store.commit("clearAuth");
  router.push("/signin");
};

const handleMyAccount = () => {
  router.push("/my-account");
};
</script>
<template>
  <nav
    class="navbar navbar-main navbar-expand-lg px-0 mx-4 shadow-none border-radius-xl"
    :class="isRTL ? 'top-0 position-sticky z-index-sticky' : ''"
    v-bind="$attrs"
    id="navbarBlur"
    data-scroll="true"
  >
    <div class="px-3 py-1 container-fluid">
      <breadcrumbs
        :current-page="currentRouteName"
        :current-directory="currentDirectory"
      />

      <div
        class="mt-2 collapse navbar-collapse mt-sm-0 me-md-0 me-sm-4"
        :class="isRTL ? 'px-0' : 'me-sm-4'"
        id="navbar"
      >
        <div
          class="pe-md-3 d-flex align-items-center"
          :class="isRTL ? 'me-md-auto' : 'ms-md-auto'"
        >
        </div>
        <ul class="navbar-nav justify-content-end">
          <!-- User Menu -->
          <li class="nav-item d-flex align-items-center" v-if="isAuthenticated">
            <div class="dropdown">
              <button
                class="btn btn-link nav-link font-weight-bold text-white dropdown-toggle p-0"
                type="button"
                id="userMenuDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <img
                  v-if="user?.avatar"
                  :src="user.avatar"
                  :alt="user?.name"
                  class="avatar avatar-sm me-2"
                  style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover"
                />
                <span class="d-sm-inline d-none">{{ user?.name }}</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end" :aria-labelledby="`userMenuDropdown`">
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="handleMyAccount">
                    <i class="fa fa-user me-2"></i>
                    Minha Conta
                  </a>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item text-danger" href="#" @click.prevent="handleLogout">
                    <i class="fa fa-sign-out-alt me-2"></i>
                    Sair
                  </a>
                </li>
              </ul>
            </div>
          </li>

          <!-- Login Link -->
          <li class="nav-item d-flex align-items-center" v-else>
            <router-link
              :to="{ name: 'Signin' }"
              class="px-0 nav-link font-weight-bold text-white"
            >
              <i class="fa fa-user" :class="isRTL ? 'ms-sm-2' : 'me-sm-2'"></i>
              <span class="d-sm-inline d-none">{{ isRTL ? 'يسجل دخول' : 'Acessar' }}</span>
            </router-link>
          </li>

          <!-- Sidebar Toggle -->
          <li class="nav-item d-xl-none ps-3 d-flex align-items-center">
            <a
              href="#"
              @click="minimizeSidebar"
              class="p-0 nav-link text-white"
              id="iconNavbarSidenav"
            >
              <div class="sidenav-toggler-inner">
                <i class="sidenav-toggler-line bg-white"></i>
                <i class="sidenav-toggler-line bg-white"></i>
                <i class="sidenav-toggler-line bg-white"></i>
              </div>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
