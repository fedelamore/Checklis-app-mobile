// src/utils/connectivity.ts

// Checagem robusta sem depender de @capacitor/network
export async function isReallyOnline(): Promise<boolean> {
  // 1) Se estiver rodando em Capacitor e o plugin Network existir, use-o via window
  try {
    const cap = (window as any)?.Capacitor;
    // v3/v4: cap?.Plugins?.Network?.getStatus
    // v5+: alguns setups ainda expõem Plugins; se não, segue para fetch
    const net = cap?.Plugins?.Network;
    if (net?.getStatus) {
      const status = await net.getStatus();
      if (typeof status?.connected === "boolean") return status.connected;
    }
  } catch {
    /* ignora e tenta os fallbacks */
  }

  // 2) Teste de conectividade real por HTTP com timeout curto
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://clients3.google.com/generate_204", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(t);
    return res.ok;
  } catch {
    // 3) Último recurso: estado do navegador
    return typeof navigator !== "undefined" ? !!navigator.onLine : false;
  }
}
