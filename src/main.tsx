import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SolanaWalletProviders } from "./providers/SolanaWalletProviders";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SolanaWalletProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SolanaWalletProviders>
  </StrictMode>
);
