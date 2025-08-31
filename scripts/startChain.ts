import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting local blockchain on port 8081...");

  // Start local blockchain
  const provider = new ethers.JsonRpcProvider("http://localhost:8081");

  // Get accounts
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("📊 Network Info:");
  console.log(`   Chain ID: ${await provider.getNetwork().then(n => n.chainId)}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  console.log(`   Deployer Address: ${deployer.address}`);
  console.log(`   Deployer Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH`);

  console.log("\n✅ Local blockchain is running on http://localhost:8081");
  console.log("🔗 Frontend will connect to: https://rpc1.olym3.xyz:8081");

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
