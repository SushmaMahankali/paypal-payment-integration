import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";

import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PayPalProvider
      clientId={import.meta.env.VITE_PAYPAL_CLIENT_ID}
      environment="sandbox"
      components={["paypal-payments"]}
      pageType="checkout"
    >
      <App />
    </PayPalProvider>
  </StrictMode>
);