import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";
import router from "./router";
import "./assets/css/nucleo-icons.css";
import "./assets/css/nucleo-svg.css";
import ArgonDashboard from "./argon-dashboard";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@/assets/css/vueform.scoped.css"
import Vueform from "@vueform/vueform";
import vueformConfig from "../vueform.config";

import { DataTable } from "datatables.net-vue3";
import DataTablesCore from "datatables.net-bs5";
DataTable.use(DataTablesCore);

DataTablesCore.defaults.language = {
  url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json",
};

import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";

const appInstance = createApp(App);
appInstance.use(store);
appInstance.use(router);
appInstance.use(ArgonDashboard);
appInstance.use(Vueform, vueformConfig);
appInstance.mount("#app");
