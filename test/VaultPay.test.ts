import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const parse = ethers.parseEther;
const ZERO_HASH = ethers.ZeroHash;

async function deployFixture() {
  const [deployer, payer, recipient, attacker] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MockTUSD");
  const token = await Token.deploy();

  const VaultPay = await ethers.getContractFactory("VaultPay");
  const vault = await VaultPay.deploy(await token.getAddress());

  await token.ownerMint(payer.address, parse("1000"));
  await token.connect(payer).approve(await vault.getAddress(), parse("1000"));

  return { deployer, payer, recipient, attacker, token, vault };
}

describe("VaultPay", function () {
  it("creates a payment and escrows tUSD", async function () {
    const { payer, recipient, token, vault } = await deployFixture();
    const deadline = BigInt(await time.latest()) + 3600n;

    await expect(vault.connect(payer).createPayment(recipient.address, parse("25"), deadline, ZERO_HASH))
      .to.emit(vault, "PaymentCreated")
      .withArgs(1, payer.address, recipient.address, parse("25"), deadline, ZERO_HASH);

    expect(await token.balanceOf(await vault.getAddress())).to.equal(parse("25"));

    const payment = await vault.getPayment(1);
    expect(payment.payer).to.equal(payer.address);
    expect(payment.recipient).to.equal(recipient.address);
    expect(payment.amount).to.equal(parse("25"));
    expect(payment.status).to.equal(1); // Created
  });

  it("lets the recipient claim an active payment", async function () {
    const { payer, recipient, token, vault } = await deployFixture();
    const deadline = BigInt(await time.latest()) + 3600n;

    await vault.connect(payer).createPayment(recipient.address, parse("10"), deadline, ZERO_HASH);

    await expect(vault.connect(recipient).claimPayment(1))
      .to.emit(vault, "PaymentClaimed")
      .withArgs(1, recipient.address, parse("10"));

    expect(await token.balanceOf(recipient.address)).to.equal(parse("10"));
    const payment = await vault.getPayment(1);
    expect(payment.status).to.equal(2); // Claimed
  });

  it("blocks claims from non-recipients", async function () {
    const { payer, recipient, attacker, vault } = await deployFixture();
    const deadline = BigInt(await time.latest()) + 3600n;

    await vault.connect(payer).createPayment(recipient.address, parse("10"), deadline, ZERO_HASH);

    await expect(vault.connect(attacker).claimPayment(1)).to.be.revertedWithCustomError(vault, "NotRecipient");
  });

  it("lets payer cancel only after deadline", async function () {
    const { payer, recipient, token, vault } = await deployFixture();
    const amount = parse("40");
    const deadline = BigInt(await time.latest()) + 100n;
    const payerBefore = await token.balanceOf(payer.address);

    await vault.connect(payer).createPayment(recipient.address, amount, deadline, ZERO_HASH);

    await expect(vault.connect(payer).cancelPayment(1)).to.be.revertedWithCustomError(vault, "PaymentNotExpired");

    await time.increaseTo(deadline + 1n);

    await expect(vault.connect(payer).cancelPayment(1))
      .to.emit(vault, "PaymentCancelled")
      .withArgs(1, payer.address, amount);

    expect(await token.balanceOf(payer.address)).to.equal(payerBefore);
    const payment = await vault.getPayment(1);
    expect(payment.status).to.equal(3); // Cancelled
  });

  it("prevents double claim or cancel", async function () {
    const { payer, recipient, vault } = await deployFixture();
    const deadline = BigInt(await time.latest()) + 3600n;

    await vault.connect(payer).createPayment(recipient.address, parse("10"), deadline, ZERO_HASH);
    await vault.connect(recipient).claimPayment(1);

    await expect(vault.connect(recipient).claimPayment(1)).to.be.revertedWithCustomError(vault, "PaymentNotActive");
    await expect(vault.connect(payer).cancelPayment(1)).to.be.revertedWithCustomError(vault, "PaymentNotActive");
  });

  it("rejects invalid payment creation inputs", async function () {
    const { payer, recipient, vault } = await deployFixture();
    const deadline = BigInt(await time.latest()) + 3600n;

    await expect(vault.connect(payer).createPayment(ethers.ZeroAddress, parse("1"), deadline, ZERO_HASH))
      .to.be.revertedWithCustomError(vault, "ZeroAddress");

    await expect(vault.connect(payer).createPayment(recipient.address, 0, deadline, ZERO_HASH))
      .to.be.revertedWithCustomError(vault, "ZeroAmount");

    await expect(vault.connect(payer).createPayment(recipient.address, parse("1"), 1, ZERO_HASH))
      .to.be.revertedWithCustomError(vault, "InvalidDeadline");
  });
});
