import { ethers } from "ethers";

async function testOlym3Rpc() {
  console.log("🏓 Testing Olym3 RPC Endpoint");
  console.log("=" .repeat(40));

  const rpcUrl = "https://rpc1.olym3.xyz";
  
  try {
    // Test with JSON-RPC request
    console.log(`🌐 Testing RPC URL: ${rpcUrl}`);
    
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1
      })
    });

    console.log(`📡 HTTP Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ RPC endpoint is responding");
      console.log(`📋 Response:`, JSON.stringify(data, null, 2));
      
      if (data.result) {
        const chainId = parseInt(data.result, 16);
        console.log(`🆔 Chain ID: ${chainId}`);
        
        if (chainId === 256000) {
          console.log("✅ Correct Chain ID for Olym3 testnet!");
        } else {
          console.log(`⚠️  Unexpected Chain ID. Expected: 256000, Got: ${chainId}`);
        }
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      console.log(`📋 Error Response:`, errorText);
    }
    
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

async function testWithEthers() {
  console.log("\n🔧 Testing with Ethers.js");
  console.log("=" .repeat(40));

  const rpcUrl = "https://rpc1.olym3.xyz";
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    console.log("📡 Testing eth_chainId...");
    const network = await provider.getNetwork();
    console.log(`✅ Chain ID: ${network.chainId}`);
    
    if (Number(network.chainId) === 256000) {
      console.log("✅ Correct Chain ID for Olym3 testnet!");
    } else {
      console.log(`⚠️  Unexpected Chain ID. Expected: 256000, Got: ${network.chainId}`);
    }
    
    console.log("📡 Testing eth_blockNumber...");
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Block Number: ${blockNumber}`);
    
    console.log("📡 Testing eth_gasPrice...");
    const gasPrice = await provider.getFeeData();
    console.log(`✅ Gas Price: ${gasPrice.gasPrice?.toString() || "0"} wei`);
    
    console.log("\n✅ Olym3 testnet is running and accessible!");
    
  } catch (error) {
    console.error("❌ Ethers.js test failed:", error);
  }
}

async function testGenesisAccounts() {
  console.log("\n👥 Testing Genesis Accounts");
  console.log("=" .repeat(40));

  const genesisAccounts = [
    "0x825d883684b86928ac2ae6fc3cfb41c2bac80162",
    "0x01d6a81d749a494d6b65e9d203db486599fb48cc",
    "0xb0b200294b4c55288e3943f482f49d130814546a",
    "0x4598fe91c98dd5ab6cfef9ca2195b8aecc2d48ee"
  ];

  try {
    const provider = new ethers.JsonRpcProvider("https://rpc1.olym3.xyz");
    
    for (let i = 0; i < genesisAccounts.length; i++) {
      const address = genesisAccounts[i];
      console.log(`\n👤 Genesis Account ${i + 1}: ${address}`);
      
      try {
        const balance = await provider.getBalance(address);
        const txCount = await provider.getTransactionCount(address);
        
        console.log(`   ETH Balance: ${ethers.formatEther(balance)} ETH`);
        console.log(`   Transaction Count: ${txCount}`);
        
      } catch (error) {
        console.error(`   ❌ Error:`, error);
      }
    }
    
  } catch (error) {
    console.error("❌ Genesis accounts test failed:", error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "all";

  switch (command) {
    case "ping":
      await testOlym3Rpc();
      break;
    case "ethers":
      await testWithEthers();
      break;
    case "genesis":
      await testGenesisAccounts();
      break;
    case "all":
      await testOlym3Rpc();
      await testWithEthers();
      await testGenesisAccounts();
      break;
    default:
      console.log("Usage:");
      console.log("  npm run test:olym3-rpc ping    - Test RPC with fetch");
      console.log("  npm run test:olym3-rpc ethers  - Test RPC with ethers.js");
      console.log("  npm run test:olym3-rpc genesis - Test genesis accounts");
      console.log("  npm run test:olym3-rpc all     - Run all tests");
      break;
  }
}

main().catch(console.error);
