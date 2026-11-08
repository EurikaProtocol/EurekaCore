# Active Eureka primary token integration

## Owner selection

The owner explicitly selected the existing
`0x4042973c0863cca0d73f028ca98465f44f0e6f97` contract as the primary Eureka
ecosystem token. This supersedes the proposed migration to the 33-million
V1 candidate. No contract deployment or address migration is performed.

- Network: Ethereum Mainnet, chain ID 1.
- On-chain name: **Eurika Protocol**.
- On-chain symbol: **EURIKA** (not renamed to EUREKA).
- Decimals: 18, validated against live metadata before balance display.
- Observed supply: 1,000,000,000 EURIKA. Supply is read live, not hardcoded
  as a successful result.
- Role: primary ecosystem token. This is an ERC-20, **not Ethereum's native
  gas currency**. Gas remains ETH; Ethereum chain metadata is unchanged.
- Public source verification is not established. No fixed-supply,
  no-mint/no-burn, price, liquidity, or comprehensive security claim is made.

## Implemented in the canonical EurekaCore workspace

- Central configuration, read-only ABI, amount formatting and explorer
  links in `src/lib/eureka-token.ts`.
- `/apps/eureka-token`: dedicated token overview/dashboard, discoverable
  through navigation and the home ecosystem card.
- Existing `/apps/wallet` and `/apps/tokenization` use the same token
  component/configuration rather than separate addresses or data models.
- Live metadata and supply, loading, retry, metadata-mismatch and RPC
  error states.
- Connected wallet `balanceOf` on Mainnet, exact BigInt formatting,
  zero-balance support, background refresh, account-keyed queries and
  removal of wallet-specific content on disconnect.
- If a wallet is on another network, reads remain explicitly Mainnet.
  No chain switch is requested automatically.
- Standard indexed `Transfer` event reads for the connected wallet, with
  self-transfer deduplication, removed-log exclusion, result validation,
  transaction links, older-window pagination, and refresh.
- History is a bounded 2,000-block window, not a complete indexed history.
  At most 100 events per window are displayed, with an explicit truncation
  notice. Full token/account explorer history is linked.
- Errors never become successful zero balances or empty histories.
- Live read of the separate registry's immutable `eurekaToken()`, with a
  mismatch/unavailable notice. The registry references the selected token;
  no registry write is needed or made.
- Lithuanian and English UI, responsive layout, accessible status/error
  messages, and keyboard-operable controls.

`Transfer` event rows represent token event logs, not all ETH activity,
transaction receipts, or claims of final settlement. Latest-chain reads
can change during a reorganization.

## Safety and application boundaries

There is no token `transfer`, `approve`, `transferFrom`, mint, burn, deploy,
signing, or liquidity operation in the application read ABI or this
integration. Wallet connection uses the existing wagmi connectors.
No uploaded scripts or private keys are used.

RPC requests expose the public contract/account being queried to the
public RPC provider. No RPC credential is bundled. The provider may rate
limit or be unavailable; those states are visible and an independent
explorer is available.

Swap, bridge, private-project CRUD, prices, fiat values and other prototype
modules are not silently activated by this change.

TINAN AI is a separate application whose repository is not present here.
This change does **not** claim to update TINAN AI or establish an API
connection to it.

The GitHub main application and canonical Replit workspace have unrelated
histories/layouts. The existing draft PR is documentation-only; canonical
workspace implementation must not be force-pushed over that different app.
No merge, deployment, DNS, secret, production database, or blockchain write
is performed.

## Verification

Unit coverage includes exact address/chain, read-only ABI, gas/token
distinction, BigInt precision, account-scoped log filters, bounded windows,
deduplication, malformed/unrelated log rejection, and RPC error propagation.

Browser coverage uses a synthetic injected wallet and controlled RPC
responses (not a real funded wallet) for metadata, balance, account change,
disconnect, another wallet network, history pagination and failures. Mock
fixtures are test-only and never used as production fallbacks.

### Actual results

- `pnpm run build`: PASS, exit 0. Workspace typecheck and production builds
  completed.
- Token/configuration/history unit tests: **8 passed**.
- Browser tests: **14 passed** across the configured, unpublished and
  missing-URL scenarios. The 4 token tests run in the configured scenario;
  their 8 duplicate runs in the two TINAN-unavailable scenarios are
  intentionally skipped.
- `pnpm --filter @workspace/api-server run test`: **1 passed**, zero
  failures or skips.
- Public Mainnet RPC: `balanceOf` returned a correctly decoded zero for
  the synthetic test account; a bounded indexed log read completed
  successfully; the registry's `eurekaToken()` matched the selected token.
  No actual user's private key or funded wallet was used.
- Desktop (1280px) and mobile (402px) running-preview screenshots showed
  real contract metadata, the selected address, gas distinction, registry
  match and disconnected wallet state. No browser errors were reported.
- The web workflow was restarted once and serves normally.
- Existing third-party annotation/chunk-size and test color warnings are
  non-fatal and remain.
