# EurekaToken V1 — Ethereum Mainnet verification

**Checked:** 2026-11-08  
**Candidate:** `0x861a27DBeDcEFc2d0bdFea359431be683D95195b`  
**Network:** Ethereum Mainnet, chain ID `1`  
**Activation status:** **STOPPED — supplied owner source is a different contract.**

The latest instruction supersedes the earlier proposal to use
`0xA34aDeA96853bc696463bde7Aab4Cd71068E930F` as an ERC-20 address. That
address is the separate EurekaCore Proof-of-Data registry, not the token.

## Decision

The candidate's verified public source, runtime bytecode, ABI, metadata,
supply, and constructor allocation match the supplied **specification**.
The owner subsequently uploaded `Eurika_Prorocol_token_1794158950598.sol`,
but that file declares `EurikaTinanLink`, not `EurekaToken`. Its ABI has
link/metadata getter and update functions, but none of the required ERC-20
functions. Its `eurikaProtocol` reference is the previous
`0x4042973c0863CCA0D73F028cA98465F44F0e6F97` address.

This is a source/contract identity mismatch, so the owner's source does not
verify the candidate token. Per the explicit verification gate, migration is
**stopped**: the current token configuration and existing application
behavior are unchanged. No other contract is substituted.

**Security note:** the uploaded link-registry source contains hard-coded
unlock/backup-like values in private Solidity storage. Solidity `private`
does not make deployed contract storage secret. If these values are actual
credentials and this contract/source has been deployed or shared publicly,
revoke or rotate them. Their values are intentionally not repeated here.

## Read-only on-chain results

| Check | Result |
| --- | --- |
| RPC chain ID | `0x1` / Ethereum Mainnet |
| Deployed runtime bytecode | Present, 3,618 bytes |
| Runtime bytecode hash, keccak256 | `0xf7d5bd6bc8a02530c2d46551aeaf980259aec726bf82565151a82428715ffd94` |
| `name()` | `Eureka` |
| `symbol()` | `EUREKA` |
| `decimals()` | `18` |
| `totalSupply()` | `33000000000000000000000000` base units |
| Human-readable supply | `33,000,000 EUREKA`, using integer arithmetic |
| `balanceOf(address(0))` | `0` |
| `allowance(address(0), address(0))` | `0` |

Calls used `https://ethereum-rpc.publicnode.com`. The endpoint reported
Mainnet. Metadata was read at `latest`; an observed head during the check
was block `26371572`. These latest-state calls were not an atomic
block-pinned snapshot.

## Verified public source and ABI

[Sourcify's contract record](https://sourcify.dev/server/v2/contract/1/0x861a27DBeDcEFc2d0bdFea359431be683D95195b?fields=abi,metadata,compilation,sources)
reports:

- Contract: `EurekaToken`.
- Compiler: `solc 0.8.19+commit.7dd6d404`.
- Creation match: `exact_match`.
- Runtime match: `exact_match`.
- Source path: `Eureka EurikaCore/Eureka Token.sol`.
- Source keccak256:
  `0x1aa6963da08a30e298819669777a9a3fc9c375530bdd58d7852ce4ce885ccd1f`.
- The fetched source hash matches its compilation metadata.
- RPC runtime bytecode is byte-for-byte equal to Sourcify's recorded
  on-chain runtime bytecode.

The verified ABI has the standard ERC-20 functions with these signatures:

```text
name()                         view returns (string)
symbol()                       view returns (string)
decimals()                     view returns (uint8)
totalSupply()                  view returns (uint256)
balanceOf(address)             view returns (uint256)
allowance(address,address)     view returns (uint256)
transfer(address,uint256)      returns (bool)
approve(address,uint256)       returns (bool)
transferFrom(address,address,uint256) returns (bool)
```

The source also declares standard `Transfer` and `Approval` events.
Its constructor sets `33_000_000 * 10 ** 18`, assigns the entire initial
supply to `msg.sender`, and emits the initial `Transfer` from zero.
There is no mint, burn, ownership, upgrade, or externally callable supply
mutation function in the verified token source or ABI.

**ERC-20 compatibility:** the source and ABI expose the expected interface,
and read methods returned correctly encoded values. Write methods were
reviewed, **not invoked**, simulated, signed, or submitted. This is interface
and source verification, not a comprehensive smart-contract security audit.

## Deployment and initial allocation

- [Creation transaction](https://etherscan.io/tx/0x294777bb141543e1e17f53e28b474be06e35472d730c2188b76b198fd0273902):
  `0x294777bb141543e1e17f53e28b474be06e35472d730c2188b76b198fd0273902`.
- Deployment block: `23787114`.
- Receipt status: success.
- Receipt contract address matches the candidate.
- Deployer: `0x5D0435779b10234fD4941cc15fae8C7C86117E91`.
- The deployment receipt contains a token `Transfer` from zero to that
  deployer for exactly `33000000000000000000000000` base units.
- A separate historical `balanceOf(deployer)` at the deployment block was
  attempted, but this RPC returned an invalid-parameters error. That
  historical storage read is **not verified**. The constructor source and
  deployment receipt independently confirm the initial assignment.

Reading the existing deployment receipt did not create or send a transaction.

## EurekaCore registry connection

[Registry](https://etherscan.io/address/0xA34aDeA96853bc696463bde7Aab4Cd71068E930F):
`0xA34aDeA96853bc696463bde7Aab4Cd71068E930F`.

Sourcify reports an exact source and runtime match for contract `EurekaCore`,
whose verified source declares `address public immutable eurekaToken`.
The live `eurekaToken()` read returns:

```text
0x4042973c0863CCA0D73F028cA98465F44F0e6F97
```

It does **not** reference candidate
`0x861a27DBeDcEFc2d0bdFea359431be683D95195b`. Updating a web configuration
would not change that on-chain immutable reference. A new registry
deployment or another separately reviewed architecture may be necessary
if the registry must reference V1. No deployment or registry write was made.

## Address migration record

| Address | Role/status |
| --- | --- |
| `0x4042973c0863CCA0D73F028cA98465F44F0e6F97` | Existing application token configuration and current immutable registry reference; preserved |
| `0xA34aDeA96853bc696463bde7Aab4Cd71068E930F` | EurekaCore registry; must not be configured as the ERC-20 token |
| `0x861a27DBeDcEFc2d0bdFea359431be683D95195b` | EurekaToken V1 candidate; public verification matches the requested specification, but the uploaded owner source is a different contract; not activated |

Historical audit documents and uploaded instructions retain historical
addresses intentionally. They are not active configuration.

## Application and repository boundaries

- The existing central application token configuration and its regression
  tests still select the previous token.
- Wallet balance, dashboard, transaction history, token-page enhancements,
  and TINAN AI token integration have **not** been changed while activation
  is blocked. No balance, history, connection, or transaction is fabricated.
- TINAN AI is a separate application/repository and is not present in this
  workspace. No TINAN AI source or settings were modified.
- Local branch: `feature/eureka-primary-token-migration`, based on the
  current Replit workspace.
- The Replit workspace and public `EurikaProtocol/EurekaCore` GitHub main
  have unrelated Git histories and different application trees. Any draft
  PR for this report must be based on GitHub main and contain **this
  documentation only**; it must not copy or replace application files.
- Local test results apply to the Replit workspace, not the unrelated
  GitHub main application.

## Tests

- `pnpm run build`: **PASSED**, exit `0`. It runs the workspace TypeScript
  checks, API build, mockup build, EurekaCore production build, 2 token
  configuration tests, and 10 launch-link browser tests (4 configured,
  3 unpublished, 3 missing URL).
- `pnpm --filter @workspace/api-server run test`: **PASSED**, exit `0`;
  1 test, 0 failed, 0 skipped.
- Existing non-fatal production-build warnings remain: large frontend
  chunks, third-party Rollup annotation warnings, and test-runner color
  environment warnings.
- No application source changed for this report; existing token-config
  regression tests confirm that the previous working address is preserved.
- No tests were run against the unrelated GitHub main application or the
  separate TINAN AI application.

## Required before activation

1. Provide the owner's actual `EurekaToken` Solidity source. The uploaded
   `EurikaTinanLink` source is not the token and cannot pass this gate.
   Resolve any source differences explicitly before activation.
2. Confirm the desired treatment of the registry's immutable old-token
   reference. Do not deploy a replacement automatically.
3. Establish a shared-history GitHub application branch before submitting
   application-code changes. A documentation-only draft PR does not migrate
   the app.
4. Make and test the read-only application integration in the canonical
   EurekaCore workspace and separately in the actual TINAN AI repository.
5. Keep write methods out of the application integration; no deployment,
   mint, burn, transfer, approval, supply, ownership, or liquidity changes
   are authorized.
