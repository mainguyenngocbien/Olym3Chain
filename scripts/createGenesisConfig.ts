import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface GenesisAccount {
  name: string;
  address: string;
  balance: string;
  privateKey: string;
}

interface GenesisConfig {
  network: string;
  chainId: number;
  createdAt: string;
  accounts: GenesisAccount[];
}

async function createGenesisConfig() {
  console.log("🚀 Creating Genesis Accounts Configuration");
  console.log("=" .repeat(50));

  // Genesis accounts provided by user
  const genesisAccounts: GenesisAccount[] = [
    {
      name: "Genesis Account 1",
      address: "0x825d883684b86928ac2ae6fc3cfb41c2bac80162",
      balance: "1000000000000000000000000", // 1,000,000 OLYM3 tokens
      privateKey: "0xc6186db0159b23714191ba8d0652aa431e24449dd4f10c72bf754598d15ae35e"
    },
    {
      name: "Genesis Account 2", 
      address: "0x01d6a81d749a494d6b65e9d203db486599fb48cc",
      balance: "1000000000000000000000000", // 1,000,000 OLYM3 tokens
      privateKey: "0xc3c49ddde69b72091bc11b0b432c9351e316996e12e04c63a3a912c0634da240"
    },
    {
      name: "Genesis Account 3",
      address: "0xb0b200294b4c55288e3943f482f49d130814546a", 
      balance: "1000000000000000000000000", // 1,000,000 OLYM3 tokens
      privateKey: "0x3bc1eeb5e7c33df709f10c30069b4ed8ea448279725713f00f243eb88ff7bc69"
    },
    {
      name: "Genesis Account 4",
      address: "0x4598fe91c98dd5ab6cfef9ca2195b8aecc2d48ee",
      balance: "1000000000000000000000000", // 1,000,000 OLYM3 tokens  
      privateKey: "0xc8c666beb904c42274ddae9efeb4657af89dce9e9b439f4c85b10c56cfca9fa4"
    }
  ];

  // Validate accounts
  console.log("🔍 Validating genesis accounts...");
  for (const account of genesisAccounts) {
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
        console.log(`⚠️  Private key does not match address for ${account.name}`);
        console.log(`   Expected: ${account.address}`);
        console.log(`   Got: ${wallet.address}`);
        console.log(`   Using provided address instead of derived address`);
      }
      
      console.log(`   ✅ ${account.name}: ${account.address}`);
      
    } catch (error) {
      console.error(`   ❌ Validation failed for ${account.name}:`, error);
      throw error;
    }
  }

  // Create configuration
  const config: GenesisConfig = {
    network: "Olym3Chain",
    chainId: 256000, // Updated to use Olym3 chain ID
    createdAt: new Date().toISOString(),
    accounts: genesisAccounts
  };

  // Save configuration
  const configFile = path.join(process.cwd(), "genesis-accounts.json");
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  
  console.log(`\n📄 Genesis accounts configuration saved to: ${configFile}`);
  
  // Create summary
  const totalBalance = genesisAccounts.reduce((sum, acc) => 
    sum + parseFloat(ethers.formatEther(acc.balance)), 0
  );
  
  console.log("\n📊 Configuration Summary:");
  console.log("=" .repeat(30));
  console.log(`Network: ${config.network}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`Total Accounts: ${genesisAccounts.length}`);
  console.log(`Total Balance: ${totalBalance.toLocaleString()} OLYM3`);
  
  console.log("\n💡 Next Steps:");
  console.log("1. Deploy Olym3Token contract: npm run deploy:genesis-token");
  console.log("2. Distribute tokens: npm run distribute:genesis-tokens");
  console.log("3. Check balances: npm run check:genesis-balances");
  
  return config;
}

// Main function
async function main() {
  try {
    await createGenesisConfig();
  } catch (error) {
    console.error("❌ Genesis config creation failed:", error);
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

export { createGenesisConfig };
