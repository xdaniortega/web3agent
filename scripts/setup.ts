/**
 * First-run setup script.
 *
 * Generates a master wallet private key, writes it to .env,
 * and displays a QR code of the public address so the user
 * can send ETH from a mobile wallet.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ethers } from "ethers";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";

const ENV_PATH = path.resolve(process.cwd(), ".env");
const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), ".env.example");

// Load existing .env if present
dotenv.config();

// ---------------------------------------------------------------------------
// 1. Ensure .env exists (copy from .env.example if missing)
// ---------------------------------------------------------------------------
if (!fs.existsSync(ENV_PATH)) {
  if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
    console.log("Created .env from .env.example\n");
  } else {
    fs.writeFileSync(ENV_PATH, "", "utf-8");
    console.log("Created empty .env\n");
  }
}

// ---------------------------------------------------------------------------
// 2. Generate or load the master wallet
// ---------------------------------------------------------------------------
let envContent = fs.readFileSync(ENV_PATH, "utf-8");

let privateKey = process.env.MASTER_PRIVATE_KEY;
let generated = false;

if (privateKey) {
  console.log("Master wallet already configured in .env — skipping generation.\n");
} else {
  const wallet = ethers.Wallet.createRandom();
  privateKey = wallet.privateKey;
  generated = true;

  // Write the private key into .env
  if (envContent.includes("MASTER_PRIVATE_KEY=")) {
    envContent = envContent.replace(
      /MASTER_PRIVATE_KEY=.*/,
      `MASTER_PRIVATE_KEY=${privateKey}`
    );
  } else {
    envContent += `\nMASTER_PRIVATE_KEY=${privateKey}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent, "utf-8");
}

// ---------------------------------------------------------------------------
// 3. Derive the public address and display info
// ---------------------------------------------------------------------------
const wallet = new ethers.Wallet(privateKey);
const address = wallet.address;

// Resolve the active network for display
const network = process.env.NETWORK || "arbitrum-sepolia";
const networkLabels: Record<string, string> = {
  "arbitrum-sepolia": "Arbitrum Sepolia (testnet)",
  "arbitrum-one": "Arbitrum One (mainnet)",
  "robinhood-testnet": "Robinhood Testnet",
};
const networkLabel = networkLabels[network] ?? network;

const faucets: Record<string, string> = {
  "arbitrum-sepolia": "https://www.alchemy.com/faucets/arbitrum-sepolia",
  "robinhood-testnet": "Check Robinhood Testnet docs for faucet availability",
};

// ---------------------------------------------------------------------------
// 4. Print everything
// ---------------------------------------------------------------------------
console.log("=".repeat(60));
if (generated) {
  console.log("  MASTER WALLET GENERATED");
} else {
  console.log("  MASTER WALLET");
}
console.log("=".repeat(60));
console.log();
console.log(`  Network : ${networkLabel}`);
console.log(`  Address : ${address}`);
console.log();

if (generated) {
  console.log("  Private key saved to .env (MASTER_PRIVATE_KEY)");
  console.log("  WARNING: Never commit .env to version control.");
  console.log();
}

console.log("-".repeat(60));
console.log("  Scan this QR code to send ETH to the master wallet:");
console.log("-".repeat(60));
console.log();

qrcode.generate(address, { small: true }, (code: string) => {
  // Indent each line for nicer formatting
  const indented = code
    .split("\n")
    .map((line) => "  " + line)
    .join("\n");
  console.log(indented);
  console.log();
  console.log("=".repeat(60));
  console.log("  NEXT STEPS");
  console.log("=".repeat(60));
  console.log();
  console.log(`  1. Send ETH on ${networkLabel} to:`);
  console.log(`     ${address}`);
  console.log();

  if (network in faucets) {
    console.log(`  Faucet: ${faucets[network]}`);
    console.log();
  }

  if (network === "arbitrum-one") {
    console.log("  You need real ETH on Arbitrum One to fund agents.");
    console.log();
  }

  console.log("  2. Fill in the remaining .env values:");
  console.log("     - ANTHROPIC_API_KEY  (from https://console.anthropic.com)");
  console.log("     - RPC_URL           (from https://dashboard.alchemy.com)");
  console.log();
  console.log("  3. Run the test workflow:");
  console.log("     npm test");
  console.log();
  console.log("=".repeat(60));
});
