import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { db } from "./services/db";

// O Vite PWA registra o Service Worker automaticamente via injectRegister: 'auto'

// Debug: Verificar versão do banco ao iniciar
db.open().then(() => {
  console.log('[DB] Database opened successfully');
  console.log('[DB] Current version:', db.verno);
}).catch(error => {
  console.error('[DB] Error opening database:', error);
  // Se houver erro de schema, força recriação
  if (error.name === 'SchemaError') {
    console.log('[DB] Schema error detected, deleting and recreating database...');
    db.delete().then(() => {
      console.log('[DB] Database deleted, reloading...');
      window.location.reload();
    });
  }
});

createRoot(document.getElementById("root")!).render(<App />);
