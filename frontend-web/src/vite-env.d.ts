/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend (Spring Boot), sin barra final. Vacía = modo maqueta, sin servidor. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
