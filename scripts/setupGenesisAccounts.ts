import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface GenesisAccount {
  address: string;
  privateKey: string;
  balance: string;
  name: string;
}

interface GenesisConfig {
  network: string;
  chainId: number;
  accounts: GenesisAccount[];
  totalSupply: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
}

class GenesisAccountSetup {
  private config: GenesisConfig;

  constructor(config: GenesisConfig) {
    this.config = config;
  }

  async setupGenesisAccounts(): Promise<void> {
    console.log("🚀 Setting up Genesis Accounts for Olym3Chain");
    console.log("=" .repeat(60));

    try {
      // 1. Validate addresses và private keys
      await this.validateAccounts();
      
      // 2. Tạo genesis configuration
      await this.createGenesisConfig();
      
      // 3. Tạo hardhat accounts file
      await this.createHardhatAccounts();
      
      // 4. Tạo deployment script cho token
      await this.createTokenDeploymentScript();
      
      // 5. Tạo script phân phối token
      await this.createTokenDistributionScript();
      
      // 6. Tạo documentation
      await this.createGenesisDocumentation();
      
      console.log("\n✅ Genesis accounts setup completed successfully!");
      this.printSetupSummary();
      
    } catch (error) {
      console.error("❌ Genesis setup failed:", error);
      throw error;
    }
  }

  private async validateAccounts(): Promise<void> {
    console.log("🔍 Validating genesis accounts...");
    
    for (const account of this.config.accounts) {
      try {
        // Validate address format
        if (!ethers.isAddress(account.address)) {
          throw new Error(`Invalid address format: ${account.address}`);
        }
        
        // Fix private key format if needed
        if (!account.privateKey.startsWith("0x")) {
          account.privateKey = "0x" + account.privateKey;
        }
        
        // Validate private key format
        if (account.privateKey.length !== 66) {
          throw new Error(`Invalid private key format: ${account.privateKey}`);
        }
        
        // Verify private key matches address
        const wallet = new ethers.Wallet(account.privateKey);
        if (wallet.address.toLowerCase() !== account.address.toLowerCase()) {
          throw new Error(`Private key does not match address for ${account.name}`);
        }
        
        console.log(`  ✅ Validated: ${account.name} (${account.address})`);
        
      } catch (error) {
        console.error(`  ❌ Validation failed for ${account.name}:`, error);
        throw error;
      }
    }
  }

  private async createGenesisConfig(): Promise<void> {
    console.log("📝 Creating genesis configuration...");
    
    const genesisConfig = {
      network: this.config.network,
      chainId: this.config.chainId,
      token: {
        name: this.config.tokenName,
        symbol: this.config.tokenSymbol,
        decimals: this.config.decimals,
        totalSupply: this.config.totalSupply
      },
      genesisAccounts: this.config.accounts.map(account => ({
        name: account.name,
        address: account.address,
        balance: account.balance,
        // Không lưu private key trong config file
        hasPrivateKey: true
      })),
      deploymentInfo: {
        createdAt: new Date().toISOString(),
        networkType: "genesis",
        totalAccounts: this.config.accounts.length,
        totalInitialBalance: this.config.accounts.reduce((sum, acc) => 
          sum + BigInt(acc.balance), BigInt(0)
        ).toString()
      }
    };

    const configFile = path.join(process.cwd(), "genesis-config.json");
    fs.writeFileSync(configFile, JSON.stringify(genesisConfig, null, 2));
    console.log("  ✅ Created: genesis-config.json");
  }

  private async createHardhatAccounts(): Promise<void> {
    console.log("🔐 Creating Hardhat accounts configuration...");
    
    const accountsConfig = {
      network: this.config.network,
      chainId: this.config.chainId,
      accounts: this.config.accounts.map(account => ({
        name: account.name,
        address: account.address,
        privateKey: account.privateKey,
        balance: account.balance
      })),
      deployer: {
        address: this.config.accounts[0].address,
        privateKey: this.config.accounts[0].privateKey,
        name: this.config.accounts[0].name
      }
    };

    const accountsFile = path.join(process.cwd(), "genesis-accounts.json");
    fs.writeFileSync(accountsFile, JSON.stringify(accountsConfig, null, 2));
    console.log("  ✅ Created: genesis-accounts.json");
  }

  private async createTokenDeploymentScript(): Promise<void> {
    console.log("📜 Creating token deployment script...");
    
    const deploymentScript = `import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying Olym3Chain Genesis Token");
  console.log("=" .repeat(50));

  try {
    // Load genesis accounts
    const accountsFile = path.join(process.cwd(), "genesis-accounts.json");
    if (!fs.existsSync(accountsFile)) {
      throw new Error("Genesis accounts file not found. Run setup first.");
    }
    
    const accountsConfig = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
    const deployer = accountsConfig.deployer;
    
    console.log(\`📋 Deployer: \${deployer.name} (\${deployer.address})\`);
    
    // Get deployer wallet
    const deployerWallet = new ethers.Wallet(deployer.privateKey, ethers.provider);
    console.log(\`💰 Deployer balance: \${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\`);
    
    // Deploy token contract
    console.log("📦 Deploying Olym3Token...");
    const Olym3Token = await ethers.getContractFactory("Olym3Token");
    const token = await Olym3Token.connect(deployerWallet).deploy(
      accountsConfig.accounts[0].balance, // Initial supply
      "Olym3Chain Token",
      "OLYM3",
      18
    );
    
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    
    console.log(\`✅ Token deployed at: \${tokenAddress}\`);
    
    // Save deployment info
    const deploymentInfo = {
      network: accountsConfig.network,
      chainId: accountsConfig.chainId,
      tokenAddress: tokenAddress,
      tokenName: "Olym3Chain Token",
      tokenSymbol: "OLYM3",
      decimals: 18,
      totalSupply: accountsConfig.accounts[0].balance,
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      transactionHash: token.deploymentTransaction()?.hash
    };
    
    const deploymentFile = path.join(process.cwd(), "deployments", \`\${accountsConfig.network}-token-deployment.json\`);
    fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(\`📄 Deployment info saved to: \${deploymentFile}\`);
    
    // Verify token info
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    
    console.log("\\n📊 Token Information:");
    console.log(\`Name: \${name}\`);
    console.log(\`Symbol: \${symbol}\`);
    console.log(\`Decimals: \${decimals}\`);
    console.log(\`Total Supply: \${ethers.formatUnits(totalSupply, decimals)} \${symbol}\`);
    
    console.log("\\n✅ Token deployment completed successfully!");
    
  } catch (error) {
    console.error("❌ Token deployment failed:", error);
    throw error;
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default main;
`;

    const scriptFile = path.join(process.cwd(), "scripts", "deployGenesisToken.ts");
    fs.writeFileSync(scriptFile, deploymentScript);
    console.log("  ✅ Created: scripts/deployGenesisToken.ts");
  }

  private async createTokenDistributionScript(): Promise<void> {
    console.log("💰 Creating token distribution script...");
    
    const distributionScript = `import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("💰 Distributing Olym3Chain Genesis Tokens");
  console.log("=" .repeat(50));

  try {
    // Load genesis accounts và deployment info
    const accountsFile = path.join(process.cwd(), "genesis-accounts.json");
    const deploymentFile = path.join(process.cwd(), "deployments", "localhost-token-deployment.json");
    
    if (!fs.existsSync(accountsFile)) {
      throw new Error("Genesis accounts file not found. Run setup first.");
    }
    
    if (!fs.existsSync(deploymentFile)) {
      throw new Error("Token deployment file not found. Deploy token first.");
    }
    
    const accountsConfig = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    console.log(\`📋 Token Address: \${deploymentInfo.tokenAddress}\`);
    
    // Get token contract
    const Olym3Token = await ethers.getContractFactory("Olym3Token");
    const token = Olym3Token.attach(deploymentInfo.tokenAddress);
    
    // Get deployer wallet
    const deployer = accountsConfig.deployer;
    const deployerWallet = new ethers.Wallet(deployer.privateKey, ethers.provider);
    
    console.log(\`📋 Distributor: \${deployer.name} (\${deployer.address})\`);
    
    // Distribute tokens to each genesis account
    const distributionResults = [];
    
    for (const account of accountsConfig.accounts) {
      try {
        console.log(\`\\n💸 Distributing to \${account.name} (\${account.address})...\`);
        
        // Check current balance
        const currentBalance = await token.balanceOf(account.address);
        console.log(\`   Current balance: \${ethers.formatUnits(currentBalance, 18)} OLYM3\`);
        
        // Calculate amount to distribute
        const targetBalance = BigInt(account.balance);
        const amountToDistribute = targetBalance - currentBalance;
        
        if (amountToDistribute > 0) {
          // Transfer tokens
          const tx = await token.connect(deployerWallet).transfer(
            account.address,
            amountToDistribute
          );
          
          await tx.wait();
          
          console.log(\`   ✅ Transferred \${ethers.formatUnits(amountToDistribute, 18)} OLYM3\`);
          console.log(\`   📄 Transaction: \${tx.hash}\`);
          
          distributionResults.push({
            account: account.name,
            address: account.address,
            amount: amountToDistribute.toString(),
            transactionHash: tx.hash,
            success: true
          });
        } else {
          console.log(\`   ⚠️  Already has sufficient balance\`);
          
          distributionResults.push({
            account: account.name,
            address: account.address,
            amount: "0",
            transactionHash: null,
            success: true,
            note: "Already has sufficient balance"
          });
        }
        
        // Verify final balance
        const finalBalance = await token.balanceOf(account.address);
        console.log(\`   Final balance: \${ethers.formatUnits(finalBalance, 18)} OLYM3\`);
        
      } catch (error) {
        console.error(\`   ❌ Failed to distribute to \${account.name}:\`, error);
        
        distributionResults.push({
          account: account.name,
          address: account.address,
          amount: "0",
          transactionHash: null,
          success: false,
          error: error.message
        });
      }
    }
    
    // Save distribution results
    const distributionInfo = {
      network: accountsConfig.network,
      chainId: accountsConfig.chainId,
      tokenAddress: deploymentInfo.tokenAddress,
      distributedAt: new Date().toISOString(),
      distributor: deployer.address,
      results: distributionResults,
      summary: {
        totalAccounts: distributionResults.length,
        successfulDistributions: distributionResults.filter(r => r.success).length,
        failedDistributions: distributionResults.filter(r => !r.success).length,
        totalAmountDistributed: distributionResults
          .filter(r => r.success)
          .reduce((sum, r) => sum + BigInt(r.amount), BigInt(0))
          .toString()
      }
    };
    
    const distributionFile = path.join(process.cwd(), "deployments", \`\${accountsConfig.network}-token-distribution.json\`);
    fs.writeFileSync(distributionFile, JSON.stringify(distributionInfo, null, 2));
    
    console.log("\\n📊 Distribution Summary:");
    console.log(\`Total Accounts: \${distributionInfo.summary.totalAccounts}\`);
    console.log(\`Successful: \${distributionInfo.summary.successfulDistributions}\`);
    console.log(\`Failed: \${distributionInfo.summary.failedDistributions}\`);
    console.log(\`Total Distributed: \${ethers.formatUnits(distributionInfo.summary.totalAmountDistributed, 18)} OLYM3\`);
    
    console.log("\\n✅ Token distribution completed!");
    
  } catch (error) {
    console.error("❌ Token distribution failed:", error);
    throw error;
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default main;
`;

    const scriptFile = path.join(process.cwd(), "scripts", "distributeGenesisTokens.ts");
    fs.writeFileSync(scriptFile, distributionScript);
    console.log("  ✅ Created: scripts/distributeGenesisTokens.ts");
  }

  private async createGenesisDocumentation(): Promise<void> {
    console.log("📚 Creating genesis documentation...");
    
    const documentation = `# Olym3Chain Genesis Accounts

## Tổng Quan

Tài liệu này mô tả các tài khoản genesis của mạng lưới Olym3Chain và cách phân phối token ban đầu.

## Thông Tin Mạng Lưới

- **Network**: ${this.config.network}
- **Chain ID**: ${this.config.chainId}
- **Token Name**: ${this.config.tokenName}
- **Token Symbol**: ${this.config.tokenSymbol}
- **Decimals**: ${this.config.decimals}
- **Total Supply**: ${ethers.formatUnits(this.config.totalSupply, this.config.decimals)} ${this.config.tokenSymbol}

## Genesis Accounts

${this.config.accounts.map((account, index) => `
### ${index + 1}. ${account.name}

- **Address**: \`${account.address}\`
- **Initial Balance**: ${ethers.formatUnits(account.balance, this.config.decimals)} ${this.config.tokenSymbol}
- **Role**: Genesis Account
- **Private Key**: \`${account.privateKey}\` (⚠️ Keep secure)

`).join('')}

## Cách Sử Dụng

### 1. Thiết Lập Genesis Accounts

\`\`\`bash
npm run setup:genesis
\`\`\`

### 2. Deploy Token Contract

\`\`\`bash
npm run deploy:genesis-token
\`\`\`

### 3. Phân Phối Tokens

\`\`\`bash
npm run distribute:genesis-tokens
\`\`\`

### 4. Kiểm Tra Balances

\`\`\`bash
npm run check:genesis-balances
\`\`\`

## Bảo Mật

⚠️ **Cảnh Báo Quan Trọng**:
- Private keys được lưu trong file \`genesis-accounts.json\`
- Đảm bảo file này được bảo mật và không commit vào repository
- Chỉ sử dụng cho mạng lưới test/development
- Không sử dụng private keys này cho mainnet

## Files Được Tạo

- \`genesis-config.json\` - Cấu hình genesis accounts
- \`genesis-accounts.json\` - Thông tin chi tiết accounts (bao gồm private keys)
- \`scripts/deployGenesisToken.ts\` - Script deploy token
- \`scripts/distributeGenesisTokens.ts\` - Script phân phối tokens
- \`deployments/localhost-token-deployment.json\` - Thông tin deployment
- \`deployments/localhost-token-distribution.json\` - Thông tin phân phối

## Kiểm Tra Trạng Thái

Sau khi setup, bạn có thể kiểm tra trạng thái của các genesis accounts:

\`\`\`typescript
import { ethers } from "hardhat";
import * as fs from "fs";

async function checkGenesisBalances() {
  const accountsFile = JSON.parse(fs.readFileSync("genesis-accounts.json", "utf8"));
  const deploymentFile = JSON.parse(fs.readFileSync("deployments/localhost-token-deployment.json", "utf8"));
  
  const token = await ethers.getContractAt("Olym3Token", deploymentFile.tokenAddress);
  
  for (const account of accountsFile.accounts) {
    const balance = await token.balanceOf(account.address);
    console.log(\`\${account.name}: \${ethers.formatUnits(balance, 18)} OLYM3\`);
  }
}
\`\`\`

## Troubleshooting

### Lỗi "Insufficient Balance"
- Đảm bảo deployer account có đủ ETH để pay gas fees
- Kiểm tra network connection

### Lỗi "Invalid Address"
- Verify địa chỉ có đúng format
- Kiểm tra private key có match với address

### Lỗi "Token Not Deployed"
- Chạy deploy script trước khi distribute
- Kiểm tra deployment file có tồn tại

---

**Lưu ý**: Tài liệu này được tạo tự động bởi genesis setup script.
`;

    const docFile = path.join(process.cwd(), "GENESIS_ACCOUNTS.md");
    fs.writeFileSync(docFile, documentation);
    console.log("  ✅ Created: GENESIS_ACCOUNTS.md");
  }

  private printSetupSummary(): void {
    console.log("\n📊 Genesis Setup Summary:");
    console.log("=" .repeat(50));
    console.log(`Network: ${this.config.network}`);
    console.log(`Chain ID: ${this.config.chainId}`);
    console.log(`Token: ${this.config.tokenName} (${this.config.tokenSymbol})`);
    console.log(`Total Supply: ${ethers.formatUnits(this.config.totalSupply, this.config.decimals)} ${this.config.tokenSymbol}`);
    console.log(`Genesis Accounts: ${this.config.accounts.length}`);
    
    console.log("\n👥 Genesis Accounts:");
    this.config.accounts.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account.name}: ${ethers.formatUnits(account.balance, this.config.decimals)} ${this.config.tokenSymbol}`);
    });
    
    console.log("\n📁 Files Created:");
    console.log("  - genesis-config.json");
    console.log("  - genesis-accounts.json");
    console.log("  - scripts/deployGenesisToken.ts");
    console.log("  - scripts/distributeGenesisTokens.ts");
    console.log("  - GENESIS_ACCOUNTS.md");
    
    console.log("\n🚀 Next Steps:");
    console.log("  1. npm run deploy:genesis-token");
    console.log("  2. npm run distribute:genesis-tokens");
    console.log("  3. npm run check:genesis-balances");
  }
}

// Main function
async function main() {
  // Genesis accounts từ user input
  const genesisAccounts: GenesisAccount[] = [
    {
      address: "0x825d883684b86928ac2ae6fc3cfb41c2bac80162",
      privateKey: "c6186db0159b23714191ba8d0652aa431e24449dd4f10c72bf754598d15ae35e",
      balance: ethers.parseEther("1000000").toString(), // 1M tokens
      name: "Genesis Account 1"
    },
    {
      address: "0x01d6a81d749a494d6b65e9d203db486599fb48cc",
      privateKey: "c3c49ddde69b72091bc11b0b432c9351e316996e12e04c63a3a912c0634da240",
      balance: ethers.parseEther("1000000").toString(), // 1M tokens
      name: "Genesis Account 2"
    },
    {
      address: "0xb0b200294b4c55288e3943f482f49d130814546a",
      privateKey: "3bc1eeb5e7c33df709f10c30069b4ed8ea448279725713f00f243eb88ff7bc69",
      balance: ethers.parseEther("1000000").toString(), // 1M tokens
      name: "Genesis Account 3"
    },
    {
      address: "0x4598fe91c98dd5ab6cfef9ca2195b8aecc2d48ee",
      privateKey: "c8c666beb904c42274ddae9efeb4657af89dce9e9b439f4c85b10c56cfca9fa4",
      balance: ethers.parseEther("1000000").toString(), // 1M tokens
      name: "Genesis Account 4"
    }
  ];

  const config: GenesisConfig = {
    network: process.env.HARDHAT_NETWORK || "localhost",
    chainId: process.env.HARDHAT_NETWORK === "localhost" ? 31337 : 256000,
    accounts: genesisAccounts,
    totalSupply: ethers.parseEther("10000000").toString(), // 10M total supply
    tokenName: "Olym3Chain Token",
    tokenSymbol: "OLYM3",
    decimals: 18
  };

  const setup = new GenesisAccountSetup(config);
  
  try {
    await setup.setupGenesisAccounts();
  } catch (error) {
    console.error("❌ Genesis setup failed:", error);
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

export { GenesisAccountSetup, GenesisConfig };
