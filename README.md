# VaultPay

Build a small EVM payment dApp with virtual ERC20 `tUSD`. Use local Hardhat only — do not use mainnet or real assets.

## Requirements

Implement `contracts/VaultPay.sol`, tests in `test/VaultPay.test.ts`, and the React UI in `frontend/`.

**Contract**

- `createPayment` — escrow `tUSD`, store payment, emit `PaymentCreated`
- `claimPayment` — recipient only, emit `PaymentClaimed`
- `cancelPayment` — payer only after deadline, refund payer, emit `PaymentCancelled`
- `getPayment` — return payment details

**UI**

Wallet connect, balance, faucet, approve, create/claim/cancel payment, transaction status.

## Setup

From the repo root:

```bash
npm install
npm run compile
npm run test
```

Run the local stack in **three terminals** (keep each process running):

| Terminal | Command | Purpose |
|----------|---------|---------|
| 1 | `npm run node` | Hardhat JSON-RPC (port **8545**) |
| 2 | `npm run deploy:local` | Deploy `MockTUSD` + `VaultPay` (run after terminal 1 is up) |
| 3 | `cd frontend && npm install && npm run dev` | Vite dev server (port **5173**) |

After deploy, copy the printed contract addresses into `frontend/src/config.ts` (`TOKEN_ADDRESS`, `VAULTPAY_ADDRESS`).

**App (browser):** after `npm run dev`, open **[http://127.0.0.1:5173/](http://127.0.0.1:5173/)** (recommended on Windows). [http://localhost:5173/](http://localhost:5173/) should work as well once the server is listening on IPv4.

**Blockchain (MetaMask):** add a custom network with RPC `http://127.0.0.1:8545`, chain ID `31337`. Import a Hardhat test account private key from the `npm run node` output. Do not use port 5173 for MetaMask; that port is only the web UI.

**If you see `ERR_CONNECTION_REFUSED`:** the dev server is not running, or it was only bound to IPv6. Stop the frontend (`Ctrl+C`), run `npm run dev` again from `frontend/`, then use **http://127.0.0.1:5173/** (not port 8545). In a separate terminal, `netstat -ano | findstr 5173` should show `0.0.0.0:5173` or `127.0.0.1:5173`, not only `[::1]:5173`.

## Submit

Push your solution to GitHub and send the repository URL. Include:

- Completed code and passing tests
- A UI screenshot in the repo (e.g. `screenshot.png`)
- Setup notes in your README
