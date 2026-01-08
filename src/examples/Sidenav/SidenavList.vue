<script setup>
import { useRoute } from "vue-router";

import SidenavItem from "./SidenavItem.vue";
//import SidenavCard from "./SidenavCard.vue";


const getRoute = () => {
  const route = useRoute();
  const routeArr = route.path.split("/");
  return routeArr[1];
};
</script>
<template>
  <div class="collapse navbar-collapse w-auto h-auto h-100" id="sidenav-collapse-main">
    <ul class="navbar-nav">
      <li class="nav-item">
        <sidenav-item to="/dashboard" :class="getRoute() === 'dashboard-default' ? 'active' : ''"
          navText="Dashboard">
          <template v-slot:icon>
            <i class="fa-regular fa-compass text-primary text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/tickets" :class="getRoute() === 'tickets' ? 'active' : ''"
          navText="Cartelas">
          <template v-slot:icon>
            <i class="fa-regular fa-clipboard text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/tables" :class="getRoute() === 'units' ? 'active' : ''"
          navText="Comunidades">
          <template v-slot:icon>
            <i class="fa-regular fa-building text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/tables" :class="getRoute() === 'groups' ? 'active' : ''"
          navText="Pastorais">
          <template v-slot:icon>
            <i class="fa-regular fa-handshake text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/vendors" :class="getRoute() === 'vendors' ? 'active' : ''"
          navText="Vendedores">
          <template v-slot:icon>
            <i class="fa-regular fa-address-card text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/tables" :class="getRoute() === 'messages' ? 'active' : ''"
          navText="Mensagens">
          <template v-slot:icon>
            <i class="fa-regular fa-comment-dots text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/tables" :class="getRoute() === 'settings' ? 'active' : ''"
          navText="Configuracoes">
          <template v-slot:icon>
            <i class="fa-solid fa-gear text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <!--

      <li class="nav-item">
        <sidenav-item to="/tables" :class="getRoute() === 'tables' ? 'active' : ''"
          :navText="isRTL ? 'الجداول' : 'Tables'">
          <template v-slot:icon>
            <i class="ni ni-calendar-grid-58 text-white text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/billing" :class="getRoute() === 'billing' ? 'active' : ''"
          :navText="isRTL ? 'الفواتیر' : 'Billing'">
          <template v-slot:icon>
            <i class="ni ni-credit-card text-success text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/cartelas" :class="getRoute() === 'cartelas' ? 'active' : ''"
          navText="Cartelas">
          <template v-slot:icon>
            <i class="ni ni-tag text-info text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/virtual-reality" :class="getRoute() === 'virtual-reality' ? 'active' : ''"
          :navText="isRTL ? 'الواقع الافتراضي' : 'Virtual Reality'">
          <template v-slot:icon>
            <i class="ni ni-app text-info text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/rtl-page" :class="getRoute() === 'rtl-page' ? 'active' : ''" navText="RTL">
          <template v-slot:icon>
            <i class="ni ni-world-2 text-danger text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="mt-3 nav-item">
        <h6 v-if="isRTL" class="text-xs ps-4 text-uppercase font-weight-bolder opacity-6"
          :class="isRTL ? 'me-4' : 'ms-2'">
          صفحات المرافق
        </h6>

        <h6 v-else class="text-xs ps-4 text-uppercase font-weight-bolder opacity-6" :class="isRTL ? 'me-4' : 'ms-2'">
          ACCOUNT PAGES
        </h6>
      </li>

      <li class="nav-item">
        <sidenav-item to="/profile" :class="getRoute() === 'profile' ? 'active' : ''"
          :navText="isRTL ? 'حساب تعريفي' : 'Profile'">
          <template v-slot:icon>
            <i class="ni ni-single-02 text-dark text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/signin" :class="getRoute() === 'signin' ? 'active' : ''"
          :navText="isRTL ? 'تسجيل الدخول' : 'Sign In'">
          <template v-slot:icon>
            <i class="ni ni-single-copy-04 text-danger text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item to="/signup" :class="getRoute() === 'signup' ? 'active' : ''"
          :navText="isRTL ? 'اشتراك' : 'Sign Up'">
          <template v-slot:icon>
            <i class="ni ni-collection text-info text-sm opacity-10"></i>
          </template>
        </sidenav-item>
      </li>

      -->
    </ul>
  </div>

  
</template>
