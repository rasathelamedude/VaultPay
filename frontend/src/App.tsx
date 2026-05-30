import { useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import {
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToBytes,
  zeroHash,
  type Address
} from "viem";
import { tokenAbi, vaultPayAbi } from "./abis";
import { LOCAL_CHAIN_ID, TOKEN_ADDRESS, TOKEN_SYMBOL, VAULTPAY_ADDRESS } from "./config";

/** Hardhat node block cap is 16.7M; MetaMask/viem sometimes estimates 21M — cap writes locally. */
const TX_GAS_LIMIT = 500_000n;

function isConfigured(address: string) {
  return address !== "0x0000000000000000000000000000000000000000";
}

/** Accept any valid 0x address; normalize checksum (strict isAddress rejects lowercase paste). */
function parseRecipientAddress(input: string): Address | null {
  const trimmed = input.trim();
  if (!isAddress(trimmed, { strict: false })) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("10");
  const [expiryMinutes, setExpiryMinutes] = useState("30");
  const [memo, setMemo] = useState("");
  const [paymentId, setPaymentId] = useState("1");
  const [status, setStatus] = useState<string>("");

  const configured = isConfigured(TOKEN_ADDRESS) && isConfigured(VAULTPAY_ADDRESS);
  const amountInBaseUnits = useMemo(() => {
    try {
      return parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const parsedRecipient = useMemo(() => parseRecipientAddress(recipient), [recipient]);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && configured) }
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "allowance",
    args: address ? [address, VAULTPAY_ADDRESS] : undefined,
    query: { enabled: Boolean(address && configured) }
  });

  async function runTransaction(label: string, fn: () => Promise<`0x${string}`>) {
    try {
      setStatus(`${label}: waiting for wallet confirmation...`);
      const hash = await fn();
      setStatus(`${label}: submitted ${hash}`);
      await refetchBalance();
      await refetchAllowance();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function faucet() {
    await runTransaction("Faucet", () =>
      writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: tokenAbi,
        functionName: "faucet",
        gas: TX_GAS_LIMIT
      })
    );
  }

  async function approve() {
    await runTransaction("Approve", () =>
      writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: tokenAbi,
        functionName: "approve",
        args: [VAULTPAY_ADDRESS, amountInBaseUnits],
        gas: TX_GAS_LIMIT
      })
    );
  }

  async function createPayment() {
    const recipientAddress = parseRecipientAddress(recipient);
    if (!recipientAddress) {
      setStatus("Error: Recipient address is invalid. Use a full 0x address (40 hex digits).");
      return;
    }
    const minutes = Number(expiryMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setStatus("Expiry must be a positive number of minutes.");
      return;
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
    const memoHash = memo ? keccak256(stringToBytes(memo)) : zeroHash;

    await runTransaction("Create payment", () =>
      writeContractAsync({
        address: VAULTPAY_ADDRESS,
        abi: vaultPayAbi,
        functionName: "createPayment",
        args: [recipientAddress, amountInBaseUnits, deadline, memoHash],
        gas: TX_GAS_LIMIT
      })
    );
  }

  async function claimPayment() {
    await runTransaction("Claim payment", () =>
      writeContractAsync({
        address: VAULTPAY_ADDRESS,
        abi: vaultPayAbi,
        functionName: "claimPayment",
        args: [BigInt(paymentId || "0")],
        gas: TX_GAS_LIMIT
      })
    );
  }

  async function cancelPayment() {
    await runTransaction("Cancel payment", () =>
      writeContractAsync({
        address: VAULTPAY_ADDRESS,
        abi: vaultPayAbi,
        functionName: "cancelPayment",
        args: [BigInt(paymentId || "0")],
        gas: TX_GAS_LIMIT
      })
    );
  }

  const balanceDisplay =
    balance !== undefined ? `${formatUnits(balance, 18)} ${TOKEN_SYMBOL}` : "—";
  const allowanceDisplay =
    allowance !== undefined ? `${formatUnits(allowance, 18)} ${TOKEN_SYMBOL}` : "—";

  return (
    <main className="page">
      <header className="hero">
        <article className="prose prose-2xl prose-invert max-w-none">
          <span className="hero__badge">Local Hardhat · tUSD escrow</span>
          <h1 className="!mt-0 !mb-2">VaultPay</h1>
          <p className="lead !mt-0">
            Mint virtual tUSD, approve spending, and run escrowed payments on your local chain — no
            mainnet or real assets.
          </p>
          <ul className="hero__list">
            <li>
              <strong>Payers</strong> lock tUSD in escrow with a deadline and optional memo.
            </li>
            <li>
              <strong>Recipients</strong> claim active payments before they expire.
            </li>
            <li>
              <strong>Payers</strong> cancel and recover funds after the deadline passes.
            </li>
          </ul>
        </article>
      </header>

      {!configured && (
        <div className="alert alert--warning" role="alert">
          <p>
            Contract addresses are not configured. Deploy locally and update{" "}
            <code>frontend/src/config.ts</code>.
          </p>
        </div>
      )}

      {chainId !== LOCAL_CHAIN_ID && (
        <div className="alert alert--warning" role="alert">
          <p>
            Current chain ID: {chainId}. Connect MetaMask to Hardhat (chain ID {LOCAL_CHAIN_ID}).
          </p>
        </div>
      )}

      <section className="card" aria-labelledby="wallet-heading">
        <div className="card__header">
          <h2 id="wallet-heading" className="card__title">
            Wallet
          </h2>
        </div>

        {isConnected ? (
          <>
            <p className="address">{address}</p>
            <div className="stats">
              <div className="stat">
                <span className="stat__label">Balance</span>
                <span className="stat__value">{balanceDisplay}</span>
              </div>
              <div className="stat">
                <span className="stat__label">Allowance to VaultPay</span>
                <span className="stat__value">{allowanceDisplay}</span>
              </div>
            </div>
            <div className="btn-row card__actions">
              <button type="button" className="btn btn--ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <div className="btn-row">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                className="btn btn--primary"
                disabled={isConnecting}
                onClick={() => connect({ connector })}
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        )}
        {connectError && <p className="text-error">{connectError.message}</p>}
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="step-1-heading">
          <div className="card__header">
            <span className="card__step" aria-hidden>
              1
            </span>
            <h2 id="step-1-heading" className="card__title">
              Get virtual currency
            </h2>
          </div>
          <p className="card__desc">Mint test tUSD from the faucet.</p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!isConnected || !configured || isPending}
            onClick={faucet}
          >
            Claim faucet tUSD
          </button>
        </section>

        <section className="card" aria-labelledby="step-2-heading">
          <div className="card__header">
            <span className="card__step" aria-hidden>
              2
            </span>
            <h2 id="step-2-heading" className="card__title">
              Approve spending
            </h2>
          </div>
          <p className="card__desc">Allow VaultPay to move tUSD on your behalf.</p>
          <div className="field">
            <label className="field__label" htmlFor="approve-amount">
              Amount ({TOKEN_SYMBOL})
            </label>
            <input
              id="approve-amount"
              className="field__input"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!isConnected || !configured || amountInBaseUnits <= 0n || isPending}
              onClick={approve}
            >
              Approve VaultPay
            </button>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="step-3-heading">
        <div className="card__header">
          <span className="card__step" aria-hidden>
            3
          </span>
          <h2 id="step-3-heading" className="card__title">
            Create payment
          </h2>
        </div>
        <p className="card__desc">Escrow tUSD for a recipient with an expiry and optional memo.</p>
        <div className="form-grid form-grid--create">
          <div className="field field--address">
            <label className="field__label" htmlFor="recipient">
              Recipient address
            </label>
            <input
              id="recipient"
              className="field__input field__input--address"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0xf39Fd6e51aad88f6f4ce6aB88c7279cFfFb92266"
              autoComplete="off"
              spellCheck={false}
            />
            {recipient.trim() && (
              <p className={`field__hint ${parsedRecipient ? "field__hint--ok" : "field__hint--warn"}`}>
                {parsedRecipient
                  ? `Valid address: ${parsedRecipient}`
                  : "Address format not recognized — check length and characters."}
              </p>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="pay-amount">
              Amount ({TOKEN_SYMBOL})
            </label>
            <input
              id="pay-amount"
              className="field__input"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="expiry">
              Expiry (minutes)
            </label>
            <input
              id="expiry"
              className="field__input"
              type="number"
              min={1}
              value={expiryMinutes}
              onChange={(event) => setExpiryMinutes(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="memo">
              Memo (optional)
            </label>
            <input
              id="memo"
              className="field__input"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Payment reference"
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!isConnected || !configured || isPending}
          onClick={createPayment}
        >
          Create escrowed payment
        </button>
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="step-4-heading">
          <div className="card__header">
            <span className="card__step" aria-hidden>
              4
            </span>
            <h2 id="step-4-heading" className="card__title">
              Claim payment
            </h2>
          </div>
          <p className="card__desc">Recipients claim funds from an active escrow.</p>
          <div className="field">
            <label className="field__label" htmlFor="claim-id">
              Payment ID
            </label>
            <input
              id="claim-id"
              className="field__input"
              type="number"
              min={1}
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
            />
          </div>
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!isConnected || !configured || isPending}
              onClick={claimPayment}
            >
              Claim payment
            </button>
          </div>
        </section>

        <section className="card" aria-labelledby="step-5-heading">
          <div className="card__header">
            <span className="card__step" aria-hidden>
              5
            </span>
            <h2 id="step-5-heading" className="card__title">
              Cancel expired payment
            </h2>
          </div>
          <p className="card__desc">Payers recover escrowed tUSD after the deadline.</p>
          <div className="field">
            <label className="field__label" htmlFor="cancel-id">
              Payment ID
            </label>
            <input
              id="cancel-id"
              className="field__input"
              type="number"
              min={1}
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
            />
          </div>
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!isConnected || !configured || isPending}
              onClick={cancelPayment}
            >
              Cancel payment
            </button>
          </div>
        </section>
      </div>

      <section className="card status-panel" aria-labelledby="status-heading">
        <h2 id="status-heading" className="card__title">
          Transaction status
        </h2>
        <p
          className={`status-panel__body ${!status ? "is-empty" : ""} ${status.startsWith("Error:") ? "status-panel__body--error" : ""}`}
          role="status"
        >
          {status || "No transaction yet."}
        </p>
        {txHash && <p className="status-panel__tx">Last tx: {txHash}</p>}
        {receipt.isLoading && (
          <p className="status-panel__hint status-panel__hint--loading">Waiting for confirmation…</p>
        )}
        {receipt.isSuccess && (
          <p className="status-panel__hint status-panel__hint--success">Transaction confirmed.</p>
        )}
      </section>
    </main>
  );
}
