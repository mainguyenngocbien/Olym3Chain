import { ethers } from "ethers";

interface ChainIdCheck {
  timestamp: string;
  chainId: number;
  expectedChainId: number;
  isCorrect: boolean;
  blockNumber: number;
  gasPrice: string;
}

class ChainIdChecker {
  private rpcUrl: string = "https://rpc1.olym3.xyz";
  private expectedChainId: number = 256000;
  private checkInterval: number = 30000; // 30 seconds
  private isRunning: boolean = false;

  async checkChainId(): Promise<ChainIdCheck> {
    try {
      const provider = new ethers.JsonRpcProvider(this.rpcUrl);
      
      const [chainId, blockNumber, gasPrice] = await Promise.all([
        provider.getNetwork().then(network => Number(network.chainId)),
        provider.getBlockNumber(),
        provider.getFeeData().then(fee => fee.gasPrice?.toString() || "0")
      ]);

      const result: ChainIdCheck = {
        timestamp: new Date().toISOString(),
        chainId: chainId,
        expectedChainId: this.expectedChainId,
        isCorrect: chainId === this.expectedChainId,
        blockNumber: blockNumber,
        gasPrice: gasPrice
      };

      return result;
    } catch (error) {
      throw new Error(`Chain ID check failed: ${error}`);
    }
  }

  async runSingleCheck(): Promise<void> {
    console.log("🔍 Checking Olym3 Testnet Chain ID");
    console.log("=" .repeat(50));
    console.log(`🌐 RPC URL: ${this.rpcUrl}`);
    console.log(`🎯 Expected Chain ID: ${this.expectedChainId}`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

    try {
      const result = await this.checkChainId();
      
      console.log(`📊 Current Chain ID: ${result.chainId}`);
      console.log(`📦 Block Number: ${result.blockNumber}`);
      console.log(`⛽ Gas Price: ${result.gasPrice} wei`);
      
      if (result.isCorrect) {
        console.log("\n✅ SUCCESS! Chain ID is correct!");
        console.log("🎉 Olym3 testnet has been upgraded to chain ID 256000");
      } else {
        console.log("\n❌ Chain ID mismatch!");
        console.log(`   Expected: ${result.expectedChainId}`);
        console.log(`   Current: ${result.chainId}`);
        console.log("\n💡 Server needs to be restarted with new configuration");
      }
      
    } catch (error) {
      console.error("❌ Check failed:", error);
    }
  }

  async runContinuousCheck(): Promise<void> {
    console.log("🔄 Starting Continuous Chain ID Monitoring");
    console.log("=" .repeat(50));
    console.log(`🌐 RPC URL: ${this.rpcUrl}`);
    console.log(`🎯 Expected Chain ID: ${this.expectedChainId}`);
    console.log(`⏱️  Check Interval: ${this.checkInterval / 1000} seconds`);
    console.log("Press Ctrl+C to stop monitoring\n");

    this.isRunning = true;
    let checkCount = 0;

    while (this.isRunning) {
      try {
        checkCount++;
        const result = await this.checkChainId();
        
        const status = result.isCorrect ? "✅" : "❌";
        const time = new Date().toLocaleTimeString();
        
        console.log(`[${time}] Check #${checkCount}: ${status} Chain ID: ${result.chainId} | Block: ${result.blockNumber}`);
        
        if (result.isCorrect) {
          console.log("\n🎉 SUCCESS! Chain ID upgrade detected!");
          console.log("✅ Olym3 testnet is now using chain ID 256000");
          this.isRunning = false;
          break;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
        
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Check failed:`, error);
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("\n🛑 Monitoring stopped");
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "single";
  
  const checker = new ChainIdChecker();

  try {
    switch (command) {
      case "single":
        await checker.runSingleCheck();
        break;
        
      case "monitor":
        await checker.runContinuousCheck();
        break;
        
      default:
        console.log("Usage:");
        console.log("  npm run check:chain-id        - Single check");
        console.log("  npm run check:chain-id monitor - Continuous monitoring");
        break;
    }
    
  } catch (error) {
    console.error("❌ Chain ID check failed:", error);
    process.exit(1);
  }
}

// Handle Ctrl+C for continuous monitoring
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, stopping...');
  process.exit(0);
});

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { ChainIdChecker };
