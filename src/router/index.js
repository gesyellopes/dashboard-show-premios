import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import Tables from "../views/Tables.vue";
import Billing from "../views/Billing.vue";
import VirtualReality from "../views/VirtualReality.vue";
import RTL from "../views/Rtl.vue";
import Profile from "../views/Profile.vue";
import Signup from "../views/Signup.vue";
import Signin from "../views/Signin.vue";
import MyAccount from "../views/MyAccount.vue";

//Componentes
import Tickets from "../views/Cartelas.vue";
import Canhotos from "../views/Canhotos.vue";
import Vendors from "../views/vendors/Vendors.vue";
import VendorDetails from "../views/vendors/VendorDetails.vue";

const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

const routes = [
  {
    path: "/",
    name: "/",
    redirect: "/dashboard",
  },
  {
    path: "/signin",
    name: "Signin",
    component: Signin,
    meta: { requiresAuth: false }
  },
  {
    path: "/signup",
    name: "Signup",
    component: Signup,
    meta: { requiresAuth: false }
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: "/tables",
    name: "Tables",
    component: Tables,
    meta: { requiresAuth: true }
  },
  {
    path: "/billing",
    name: "Billing",
    component: Billing,
    meta: { requiresAuth: true }
  },
  {
    path: "/virtual-reality",
    name: "Virtual Reality",
    component: VirtualReality,
    meta: { requiresAuth: true }
  },
  {
    path: "/rtl-page",
    name: "RTL",
    component: RTL,
    meta: { requiresAuth: true }
  },
  {
    path: "/profile",
    name: "Profile",
    component: Profile,
    meta: { requiresAuth: true }
  },
  {
    path: "/my-account",
    name: "MyAccount",
    component: MyAccount,
    meta: { requiresAuth: true }
  },
  {
    path: "/tickets",
    name: "Cartelas",
    component: Tickets,
    meta: { requiresAuth: true }
  },
  {
    path: "/canhotos",
    name: "Canhotos",
    component: Canhotos,
    meta: { requiresAuth: true, adminOnly: true }
  },
  {
    path: "/vendors",
    name: "Vendedores",
    component: Vendors,
    meta: { requiresAuth: true }
  },
  {
    path: "/vendors/:id",
    name: "VendorDetails",
    component: VendorDetails,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: "/units",
    name: "Comunidades",
    component: () => import("../views/Comunidades.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/sorteios",
    name: "Sorteios",
    component: () => import("../views/sorteio/List.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/sorteios/:id",
    name: "Rodadas Sorteio",
    component: () => import("../views/sorteio/Details.vue"),
    props: true,
    meta: { requiresAuth: true }
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

router.beforeEach((to, from, next) => {
  const isAuth = isAuthenticated();
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !isAuth) {
    next("/signin");
  } else if ((to.path === "/signin" || to.path === "/signup") && isAuth) {
    next("/dashboard");
  } else {
    next();
  }
});

export default router;
