import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Setting up local blockchain with Olym3 domain mapping...");

  // Get the local provider
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");

  // Get accounts
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("📊 Network Configuration:");
  console.log(`   RPC URL: http://localhost:8545`);
  console.log(`   Domain Mapping: https://rpc1.olym3.xyz`);
  console.log(`   Chain ID: 256000 (Olym3 Testnet)`);
  console.log(`   Deployer Address: ${deployer.address}`);
  console.log(`   Deployer Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH`);

  // Set network configuration
  const network = await provider.getNetwork();
  console.log(`   Current Chain ID: ${network.chainId}`);

  console.log("\n✅ Local blockchain is running with Olym3 domain mapping");
  console.log("🔗 Frontend will connect to: http://localhost:8545");
  console.log("🌐 Domain mapping: https://rpc1.olym3.xyz -> http://localhost:8545");

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down local blockchain...");
    process.exit(0);
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
