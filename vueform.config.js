import { defineConfig } from "@vueform/vueform";
import PluginMask from '@vueform/plugin-mask'
import bootstrap from "@vueform/vueform/themes/bootstrap";
import ptBR from "@vueform/vueform/locales/pt_BR";


export default defineConfig({
  theme: bootstrap,
  locales: {
    pt_BR: ptBR,
  },
  locale: "pt_BR",
  plugins: [
    PluginMask,
  ],
});
