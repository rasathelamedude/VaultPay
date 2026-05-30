// Application Binary Interfaces

/**
 * A JSON document generated automatically by Hardhat during compilation
 *
 * Tells your frontend exactly what methods exist inside the smart contract, their arguments, and their return types.
 *
 */
export const tokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const vaultPayAbi = [
  {
    type: "function",
    name: "createPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "memoHash", type: "bytes32" },
    ],
    outputs: [{ name: "paymentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimPayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelPayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPayment",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "createdAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "memoHash", type: "bytes32" },
        ],
      },
    ],
  },
] as const;
