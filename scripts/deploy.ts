import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  const Token = await ethers.getContractFactory("MockTUSD");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const VaultPay = await ethers.getContractFactory("VaultPay");
  const vault = await VaultPay.deploy(await token.getAddress());
  await vault.waitForDeployment();

  const addresses = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    token: await token.getAddress(),
    vaultPay: await vault.getAddress(),
    deployedBy: deployer.address,
    deployedAt: new Date().toISOString()
  };

  console.log("Deployment result:");
  console.log(addresses);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(addresses, null, 2));

  console.log("\nCopy these into frontend/src/config.ts:");
  console.log(`TOKEN_ADDRESS = '${addresses.token}'`);
  console.log(`VAULTPAY_ADDRESS = '${addresses.vaultPay}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
