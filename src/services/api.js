import axios from "axios";
import store from "@/store";

const api = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// anexa token automaticamente se existir
api.interceptors.request.use((config) => {
  const token = store.state.auth?.token || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;