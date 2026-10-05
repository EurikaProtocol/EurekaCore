import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { SolanaWalletProvider } from './components/SolanaWalletProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <SolanaWalletProvider>
          <App />
        </SolanaWalletProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
