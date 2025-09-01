import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface NetworkInfo {
  name: string;
  rpcUrl: string;
  chainId: number;
  blockExplorer?: string;
}

interface ConnectionResult {
  network: string;
  rpcUrl: string;
  chainId: number;
  isConnected: boolean;
  blockNumber?: number;
  gasPrice?: string;
  networkId?: number;
  error?: string;
  responseTime?: number;
}

class Olym3ConnectionChecker {
  private networks: NetworkInfo[] = [
    {
      name: "olym3Testnet",
      rpcUrl: "https://rpc1.olym3.xyz",
      chainId: 256000
    },
    {
      name: "olym3Local",
      rpcUrl: "http://localhost:8545",
      chainId: 256000
    },
    {
      name: "localhost",
      rpcUrl: "http://localhost:8545",
      chainId: 256000 // Updated to match Olym3 testnet
    }
  ];

  async checkAllNetworks(): Promise<void> {
    console.log("🔍 Checking Olym3Chain Network Connections");
    console.log("=" .repeat(60));

    const results: ConnectionResult[] = [];

    for (const network of this.networks) {
      console.log(`\n🌐 Testing ${network.name}...`);
      console.log(`   RPC URL: ${network.rpcUrl}`);
      console.log(`   Expected Chain ID: ${network.chainId}`);
      
      const result = await this.checkNetworkConnection(network);
      results.push(result);
      
      if (result.isConnected) {
        console.log(`   ✅ Connected successfully!`);
        console.log(`   📊 Block Number: ${result.blockNumber}`);
        console.log(`   ⛽ Gas Price: ${result.gasPrice} wei`);
        console.log(`   🆔 Network ID: ${result.networkId}`);
        console.log(`   ⏱️  Response Time: ${result.responseTime}ms`);
      } else {
        console.log(`   ❌ Connection failed: ${result.error}`);
      }
    }

    // Generate report
    await this.generateConnectionReport(results);
    
    // Show summary
    this.printConnectionSummary(results);
  }

  private async checkNetworkConnection(network: NetworkInfo): Promise<ConnectionResult> {
    const startTime = Date.now();
    
    try {
      // Create provider for this network
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      // Test basic connection
      const blockNumber = await provider.getBlockNumber();
      const gasPrice = await provider.getFeeData();
      const networkId = await provider.getNetwork();
      
      const responseTime = Date.now() - startTime;
      
      return {
        network: network.name,
        rpcUrl: network.rpcUrl,
        chainId: network.chainId,
        isConnected: true,
        blockNumber: blockNumber,
        gasPrice: gasPrice.gasPrice?.toString() || "0",
        networkId: Number(networkId.chainId),
        responseTime: responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        network: network.name,
        rpcUrl: network.rpcUrl,
        chainId: network.chainId,
        isConnected: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: responseTime
      };
    }
  }

  async checkOlym3Testnet(): Promise<void> {
    console.log("🎯 Checking Olym3 Testnet Specifically");
    console.log("=" .repeat(50));

    const olym3Network = this.networks.find(n => n.name === "olym3Testnet");
    if (!olym3Network) {
      throw new Error("Olym3 testnet configuration not found");
    }

    try {
      console.log(`🌐 RPC URL: ${olym3Network.rpcUrl}`);
      console.log(`🆔 Expected Chain ID: ${olym3Network.chainId}`);
      
      // Test with different methods
      await this.testRpcMethods(olym3Network);
      
      // Test with Hardhat configuration
      await this.testHardhatConnection(olym3Network);
      
    } catch (error) {
      console.error("❌ Olym3 testnet check failed:", error);
    }
  }

  private async testRpcMethods(network: NetworkInfo): Promise<void> {
    console.log("\n📡 Testing RPC Methods...");
    
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    try {
      // Test eth_chainId
      console.log("   Testing eth_chainId...");
      const chainId = await provider.getNetwork();
      console.log(`   ✅ Chain ID: ${chainId.chainId}`);
      
      if (Number(chainId.chainId) !== network.chainId) {
        console.log(`   ⚠️  Chain ID mismatch! Expected: ${network.chainId}, Got: ${chainId.chainId}`);
      }
      
      // Test eth_blockNumber
      console.log("   Testing eth_blockNumber...");
      const blockNumber = await provider.getBlockNumber();
      console.log(`   ✅ Block Number: ${blockNumber}`);
      
      // Test eth_gasPrice
      console.log("   Testing eth_gasPrice...");
      const gasPrice = await provider.getFeeData();
      console.log(`   ✅ Gas Price: ${gasPrice.gasPrice?.toString() || "0"} wei`);
      
      // Test eth_accounts (should return empty for public RPC)
      console.log("   Testing eth_accounts...");
      const accounts = await provider.listAccounts();
      console.log(`   ✅ Accounts: ${accounts.length} (expected 0 for public RPC)`);
      
    } catch (error) {
      console.error(`   ❌ RPC method test failed:`, error);
    }
  }

  private async testHardhatConnection(network: NetworkInfo): Promise<void> {
    console.log("\n🔧 Testing Hardhat Configuration...");
    
    try {
      // Switch to olym3Testnet network
      const hre = await import("hardhat");
      await hre.hre.run("compile");
      
      console.log("   ✅ Hardhat compilation successful");
      
      // Test with hardhat network configuration
      const config = hre.hre.network.config;
      console.log(`   📋 Network Config:`, {
        url: config.url,
        chainId: config.chainId,
        accounts: config.accounts ? "configured" : "not configured"
      });
      
    } catch (error) {
      console.error(`   ❌ Hardhat test failed:`, error);
    }
  }

  async testGenesisAccountsOnOlym3(): Promise<void> {
    console.log("👥 Testing Genesis Accounts on Olym3 Testnet");
    console.log("=" .repeat(50));

    try {
      // Load genesis accounts
      const accountsFile = path.join(process.cwd(), "genesis-accounts.json");
      if (!fs.existsSync(accountsFile)) {
        console.log("⚠️  Genesis accounts file not found. Run setup first.");
        return;
      }
      
      const accountsConfig = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
      const genesisAccounts = accountsConfig.accounts;
      
      console.log(`📋 Testing ${genesisAccounts.length} genesis accounts...`);
      
      // Create provider for Olym3 testnet
      const provider = new ethers.JsonRpcProvider("https://rpc1.olym3.xyz");
      
      for (const account of genesisAccounts) {
        try {
          console.log(`\n👤 ${account.name} (${account.address})`);
          
          // Check ETH balance
          const ethBalance = await provider.getBalance(account.address);
          console.log(`   ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
          
          // Check if account has any transaction history
          const txCount = await provider.getTransactionCount(account.address);
          console.log(`   Transaction Count: ${txCount}`);
          
        } catch (error) {
          console.error(`   ❌ Error checking ${account.name}:`, error);
        }
      }
      
    } catch (error) {
      console.error("❌ Genesis accounts test failed:", error);
    }
  }

  private async generateConnectionReport(results: ConnectionResult[]): Promise<void> {
    const report = {
      checkedAt: new Date().toISOString(),
      networks: results,
      summary: {
        totalNetworks: results.length,
        connectedNetworks: results.filter(r => r.isConnected).length,
        failedNetworks: results.filter(r => !r.isConnected).length,
        olym3TestnetStatus: results.find(r => r.network === "olym3Testnet")?.isConnected || false
      }
    };

    const reportFile = path.join(process.cwd(), "reports", `network-connection-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Connection report saved to: ${reportFile}`);
  }

  private printConnectionSummary(results: ConnectionResult[]): void {
    console.log("\n📊 Connection Summary:");
    console.log("=" .repeat(40));
    
    const connected = results.filter(r => r.isConnected);
    const failed = results.filter(r => !r.isConnected);
    
    console.log(`Total Networks: ${results.length}`);
    console.log(`Connected: ${connected.length}`);
    console.log(`Failed: ${failed.length}`);
    
    const olym3Testnet = results.find(r => r.network === "olym3Testnet");
    if (olym3Testnet) {
      console.log(`\n🎯 Olym3 Testnet Status: ${olym3Testnet.isConnected ? "✅ Connected" : "❌ Failed"}`);
      if (olym3Testnet.isConnected) {
        console.log(`   Block Number: ${olym3Testnet.blockNumber}`);
        console.log(`   Chain ID: ${olym3Testnet.networkId}`);
        console.log(`   Response Time: ${olym3Testnet.responseTime}ms`);
      } else {
        console.log(`   Error: ${olym3Testnet.error}`);
      }
    }
    
    console.log("\n💡 Recommendations:");
    
    if (olym3Testnet?.isConnected) {
      console.log("✅ Olym3 testnet is running and accessible!");
      console.log("   You can now deploy contracts and interact with the network.");
    } else {
      console.log("⚠️  Olym3 testnet is not accessible.");
      console.log("   Check if the network is running and RPC endpoint is correct.");
      console.log("   Try running: npm run chain:olym3-local for local testing.");
    }
    
    if (failed.length > 0) {
      console.log("\n❌ Failed Networks:");
      failed.forEach(network => {
        console.log(`   - ${network.network}: ${network.error}`);
      });
    }
  }

  async pingOlym3Rpc(): Promise<void> {
    console.log("🏓 Pinging Olym3 RPC Endpoint");
    console.log("=" .repeat(40));

    const rpcUrl = "https://rpc1.olym3.xyz";
    
    try {
      // Test with curl-like request
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
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.error("❌ Ping failed:", error);
    }
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "all";
  
  const checker = new Olym3ConnectionChecker();

  try {
    switch (command) {
      case "all":
        await checker.checkAllNetworks();
        break;
        
      case "olym3":
        await checker.checkOlym3Testnet();
        break;
        
      case "genesis":
        await checker.testGenesisAccountsOnOlym3();
        break;
        
      case "ping":
        await checker.pingOlym3Rpc();
        break;
        
      default:
        console.log("Usage:");
        console.log("  npm run check:olym3-connection        - Check all network connections");
        console.log("  npm run check:olym3-connection olym3  - Check Olym3 testnet specifically");
        console.log("  npm run check:olym3-connection genesis - Test genesis accounts on Olym3");
        console.log("  npm run check:olym3-connection ping   - Ping Olym3 RPC endpoint");
        break;
    }
    
  } catch (error) {
    console.error("❌ Connection check failed:", error);
    process.exit(1);
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { Olym3ConnectionChecker };
