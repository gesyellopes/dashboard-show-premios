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
          <sidenav-item to="/sorteios" :class="getRoute() === 'sorteios' ? 'active' : ''"
            navText="Sorteios">
            <template v-slot:icon>
              <i class="fa-solid fa-ticket text-sm opacity-10"></i>
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
        <sidenav-item to="/units" :class="getRoute() === 'units' ? 'active' : ''"
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
      
    </ul>
  </div>

  
</template>
