import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          evm: ["ethers", "@walletconnect/ethereum-provider"],
          solana: [
            "@solana/web3.js",
            "@solana/wallet-adapter-react",
            "@solana/wallet-adapter-react-ui",
            "@solana/wallet-adapter-phantom",
          ],
        },
      },
    },
  },
});
