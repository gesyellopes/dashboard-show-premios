import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import Tables from "../views/Tables.vue";
import Billing from "../views/Billing.vue";
import VirtualReality from "../views/VirtualReality.vue";
import RTL from "../views/Rtl.vue";
import Profile from "../views/Profile.vue";
import Signup from "../views/Signup.vue";
import Signin from "../views/Signin.vue";

//Componentes
import Tickets from "../views/Cartelas.vue";
import Vendors from "../views/vendors/Vendors.vue";
import VendorDetails from "../views/vendors/VendorDetails.vue";

const routes = [
  {
    path: "/",
    name: "/",
    redirect: "/dashboard",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
  },
  {
    path: "/tables",
    name: "Tables",
    component: Tables,
  },
  {
    path: "/billing",
    name: "Billing",
    component: Billing,
  },
  {
    path: "/virtual-reality",
    name: "Virtual Reality",
    component: VirtualReality,
  },
  {
    path: "/rtl-page",
    name: "RTL",
    component: RTL,
  },
  {
    path: "/profile",
    name: "Profile",
    component: Profile,
  },
  {
    path: "/signin",
    name: "Signin",
    component: Signin,
  },
  {
    path: "/signup",
    name: "Signup",
    component: Signup,
  },
  {
    path: "/tickets",
    name: "Cartelas",
    component: Tickets
  },
  {
    path: "/vendors",
    name: "Vendedores",
    component: Vendors
  },
  {
    path: "/vendors/:id",
    name: "VendorDetails",
    component: VendorDetails,
    props: true
  },
  {
    path: "/logout",
    name: "Logout",
    beforeEnter: (to, from, next) => {
      const store = require("@/store").default;
      store.commit("clearAuth");
      next("/signin");
    },
  }

];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  linkActiveClass: "active",
});

export default router;
