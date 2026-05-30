import { createConfig, http } from "wagmi";
import { hardhat } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [hardhat],
  connectors: [
    metaMask(),
    injected()
  ],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545")
  }
});
