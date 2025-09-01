import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface GenesisAccount {
  name: string;
  address: string;
  balance: string;
  privateKey: string;
}

interface BalanceInfo {
  account: string;
  address: string;
  ethBalance: string;
  tokenBalance: string;
  tokenBalanceFormatted: string;
  isGenesisAccount: boolean;
}

class GenesisBalanceChecker {
  private network: string;
  private chainId: number;

  constructor(network: string, chainId: number) {
    this.network = network;
    this.chainId = chainId;
  }

  async checkAllBalances(): Promise<void> {
    console.log("💰 Checking Genesis Account Balances");
    console.log("=" .repeat(60));

    try {
      // Load genesis accounts
      const accountsFile = path.join(process.cwd(), "genesis-accounts.json");
      if (!fs.existsSync(accountsFile)) {
        throw new Error("Genesis accounts file not found. Run setup first.");
      }
      
      const accountsConfig = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
      const genesisAccounts: GenesisAccount[] = accountsConfig.accounts;
      
      console.log(`📋 Network: ${accountsConfig.network}`);
      console.log(`📋 Chain ID: ${accountsConfig.chainId}`);
      console.log(`📋 Total Genesis Accounts: ${genesisAccounts.length}\n`);

      // Load token deployment info
      const deploymentFile = path.join(process.cwd(), "deployments", `${this.network}-token-deployment.json`);
      let tokenAddress: string | null = null;
      
      if (fs.existsSync(deploymentFile)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        tokenAddress = deploymentInfo.tokenAddress;
        console.log(`📋 Token Address: ${tokenAddress}`);
        console.log(`📋 Token Name: ${deploymentInfo.tokenName}`);
        console.log(`📋 Token Symbol: ${deploymentInfo.tokenSymbol}\n`);
      } else {
        console.log("⚠️  Token deployment file not found. Only ETH balances will be shown.\n");
      }

      // Check balances for each genesis account
      const balanceResults: BalanceInfo[] = [];
      
      for (const account of genesisAccounts) {
        try {
          const balanceInfo = await this.checkAccountBalance(account, tokenAddress);
          balanceResults.push(balanceInfo);
          
          console.log(`👤 ${account.name}`);
          console.log(`   Address: ${account.address}`);
          console.log(`   ETH Balance: ${balanceInfo.ethBalance} ETH`);
          
          if (tokenAddress) {
            console.log(`   Token Balance: ${balanceInfo.tokenBalanceFormatted}`);
            console.log(`   Is Genesis Account: ${balanceInfo.isGenesisAccount ? "✅ Yes" : "❌ No"}`);
          }
          
          console.log("");
          
        } catch (error) {
          console.error(`❌ Error checking balance for ${account.name}:`, error);
        }
      }

      // Generate summary report
      await this.generateBalanceReport(balanceResults, tokenAddress);
      
      // Show summary
      this.printBalanceSummary(balanceResults, tokenAddress);
      
    } catch (error) {
      console.error("❌ Balance check failed:", error);
      throw error;
    }
  }

  private async checkAccountBalance(account: GenesisAccount, tokenAddress: string | null): Promise<BalanceInfo> {
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(account.address);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    
    let tokenBalance = "0";
    let tokenBalanceFormatted = "0";
    let isGenesisAccount = false;
    
    if (tokenAddress) {
      try {
        // Get token contract
        const token = await ethers.getContractAt("Olym3Token", tokenAddress);
        
        // Check token balance
        const balance = await token.balanceOf(account.address);
        tokenBalance = balance.toString();
        tokenBalanceFormatted = ethers.formatUnits(balance, 18);
        
        // Check if it's a genesis account
        isGenesisAccount = await token.isGenesisAccount(account.address);
        
      } catch (error) {
        console.warn(`⚠️  Could not check token balance for ${account.name}:`, error);
      }
    }
    
    return {
      account: account.name,
      address: account.address,
      ethBalance: ethBalanceFormatted,
      tokenBalance: tokenBalance,
      tokenBalanceFormatted: tokenBalanceFormatted,
      isGenesisAccount: isGenesisAccount
    };
  }

  private async generateBalanceReport(balanceResults: BalanceInfo[], tokenAddress: string | null): Promise<void> {
    const report = {
      network: this.network,
      chainId: this.chainId,
      tokenAddress: tokenAddress,
      checkedAt: new Date().toISOString(),
      accounts: balanceResults,
      summary: {
        totalAccounts: balanceResults.length,
        totalEthBalance: balanceResults.reduce((sum, acc) => 
          sum + parseFloat(acc.ethBalance), 0
        ).toFixed(6),
        totalTokenBalance: balanceResults.reduce((sum, acc) => 
          sum + parseFloat(acc.tokenBalanceFormatted), 0
        ).toFixed(6),
        genesisAccounts: balanceResults.filter(acc => acc.isGenesisAccount).length,
        nonGenesisAccounts: balanceResults.filter(acc => !acc.isGenesisAccount).length
      }
    };

    const reportFile = path.join(process.cwd(), "reports", `genesis-balances-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Balance report saved to: ${reportFile}`);
  }

  private printBalanceSummary(balanceResults: BalanceInfo[], tokenAddress: string | null): void {
    console.log("📊 Balance Summary:");
    console.log("=" .repeat(40));
    
    const totalEthBalance = balanceResults.reduce((sum, acc) => 
      sum + parseFloat(acc.ethBalance), 0
    );
    
    const totalTokenBalance = balanceResults.reduce((sum, acc) => 
      sum + parseFloat(acc.tokenBalanceFormatted), 0
    );
    
    const genesisAccounts = balanceResults.filter(acc => acc.isGenesisAccount).length;
    
    console.log(`Total Accounts: ${balanceResults.length}`);
    console.log(`Total ETH Balance: ${totalEthBalance.toFixed(6)} ETH`);
    
    if (tokenAddress) {
      console.log(`Total Token Balance: ${totalTokenBalance.toFixed(6)} OLYM3`);
      console.log(`Genesis Accounts: ${genesisAccounts}`);
      console.log(`Non-Genesis Accounts: ${balanceResults.length - genesisAccounts}`);
    }
    
    console.log("\n💡 Recommendations:");
    
    if (totalEthBalance === 0) {
      console.log("⚠️  No ETH balances found. Ensure accounts are funded for gas fees.");
    }
    
    if (tokenAddress && totalTokenBalance === 0) {
      console.log("⚠️  No token balances found. Run token distribution script.");
    }
    
    if (tokenAddress && genesisAccounts === 0) {
      console.log("⚠️  No genesis accounts found. Check token contract configuration.");
    }
    
    if (totalEthBalance > 0 && totalTokenBalance > 0 && genesisAccounts > 0) {
      console.log("✅ All systems operational!");
    }
  }

  async checkSpecificAccount(address: string): Promise<void> {
    console.log(`🔍 Checking specific account: ${address}`);
    console.log("=" .repeat(50));

    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error("Invalid address format");
      }

      // Check ETH balance
      const ethBalance = await ethers.provider.getBalance(address);
      console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

      // Check token balance if token is deployed
      const deploymentFile = path.join(process.cwd(), "deployments", `${this.network}-token-deployment.json`);
      if (fs.existsSync(deploymentFile)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        const token = await ethers.getContractAt("Olym3Token", deploymentInfo.tokenAddress);
        
        const tokenBalance = await token.balanceOf(address);
        const isGenesisAccount = await token.isGenesisAccount(address);
        
        console.log(`Token Balance: ${ethers.formatUnits(tokenBalance, 18)} OLYM3`);
        console.log(`Is Genesis Account: ${isGenesisAccount ? "✅ Yes" : "❌ No"}`);
      }

    } catch (error) {
      console.error("❌ Account check failed:", error);
      throw error;
    }
  }

  async getTokenStats(): Promise<void> {
    console.log("📊 Token Statistics");
    console.log("=" .repeat(40));

    try {
      const deploymentFile = path.join(process.cwd(), "deployments", `${this.network}-token-deployment.json`);
      if (!fs.existsSync(deploymentFile)) {
        throw new Error("Token deployment file not found");
      }

      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
      const token = await ethers.getContractAt("Olym3Token", deploymentInfo.tokenAddress);

      // Get token stats
      const [
        name,
        symbol,
        decimals,
        totalSupply,
        maxSupply,
        maxGenesisSupply,
        genesisDistributed
      ] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.totalSupply(),
        token.maxSupply(),
        token.maxGenesisSupply(),
        token.genesisDistributed()
      ]);

      console.log(`Token Name: ${name}`);
      console.log(`Token Symbol: ${symbol}`);
      console.log(`Decimals: ${decimals}`);
      console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
      console.log(`Max Supply: ${ethers.formatUnits(maxSupply, decimals)} ${symbol}`);
      console.log(`Max Genesis Supply: ${ethers.formatUnits(maxGenesisSupply, decimals)} ${symbol}`);
      console.log(`Genesis Distributed: ${ethers.formatUnits(genesisDistributed, decimals)} ${symbol}`);
      console.log(`Remaining Genesis Supply: ${ethers.formatUnits(maxGenesisSupply - genesisDistributed, decimals)} ${symbol}`);

    } catch (error) {
      console.error("❌ Token stats check failed:", error);
      throw error;
    }
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "all";
  const address = args[1];
  
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const chainId = 256000; // All networks now use Olym3 chain ID
  
  const checker = new GenesisBalanceChecker(network, chainId);

  try {
    switch (command) {
      case "all":
        await checker.checkAllBalances();
        break;
        
      case "account":
        if (!address) {
          console.error("❌ Please provide an address");
          process.exit(1);
        }
        await checker.checkSpecificAccount(address);
        break;
        
      case "stats":
        await checker.getTokenStats();
        break;
        
      default:
        console.log("Usage:");
        console.log("  npm run check:genesis-balances        - Check all genesis account balances");
        console.log("  npm run check:genesis-balances account <address> - Check specific account");
        console.log("  npm run check:genesis-balances stats  - Show token statistics");
        break;
    }
    
  } catch (error) {
    console.error("❌ Balance check failed:", error);
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

export { GenesisBalanceChecker };
