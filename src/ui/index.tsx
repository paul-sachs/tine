import ReactDOM from "react-dom";
import React from "react";
import "@shopify/polaris/build/esm/styles.css";
import { QueryClientProvider, QueryClient } from "react-query";
import enTranslations from "@shopify/polaris/locales/en.json";
import { AppProvider } from "@shopify/polaris";
import { App } from "./app";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 10000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const app = document.getElementById("app");
const root = (ReactDOM as any).createRoot(app);

root.render(
  <AppProvider i18n={enTranslations}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </AppProvider>,
  app
);
