import { ethers } from "hardhat";
import { TransactionDatabaseManager } from "./databaseManager";
import { TransactionBackupManager } from "./backupTransactionLogs";
import * as fs from "fs";
import * as path from "path";

interface RecoveryConfig {
  network: string;
  chainId: number;
  recoveryMode: "full" | "incremental" | "selective";
  startBlock?: number;
  endBlock?: number;
  targetAddresses?: string[];
  enableStateReconstruction: boolean;
  enableTransactionReplay: boolean;
}

interface RecoveryStats {
  totalBlocksRecovered: number;
  totalTransactionsRecovered: number;
  totalAddressesRecovered: number;
  recoveryTime: number;
  errors: string[];
  warnings: string[];
}

class NetworkRecoveryManager {
  private config: RecoveryConfig;
  private dbManager: TransactionDatabaseManager;
  private backupManager: TransactionBackupManager;
  private recoveryStats: RecoveryStats;

  constructor(config: RecoveryConfig) {
    this.config = config;
    this.dbManager = new TransactionDatabaseManager({
      type: "json",
      databaseName: `${config.network}_recovery`
    });
    this.backupManager = new TransactionBackupManager(config.network, config.chainId);
    this.recoveryStats = {
      totalBlocksRecovered: 0,
      totalTransactionsRecovered: 0,
      totalAddressesRecovered: 0,
      recoveryTime: 0,
      errors: [],
      warnings: []
    };
  }

  async performRecovery(): Promise<RecoveryStats> {
    console.log(`🔄 Starting network recovery for: ${this.config.network}`);
    console.log(`📋 Recovery mode: ${this.config.recoveryMode}`);
    
    const startTime = Date.now();

    try {
      switch (this.config.recoveryMode) {
        case "full":
          await this.performFullRecovery();
          break;
        case "incremental":
          await this.performIncrementalRecovery();
          break;
        case "selective":
          await this.performSelectiveRecovery();
          break;
        default:
          throw new Error(`Unsupported recovery mode: ${this.config.recoveryMode}`);
      }

      this.recoveryStats.recoveryTime = Date.now() - startTime;
      
      console.log(`✅ Recovery completed in ${this.recoveryStats.recoveryTime}ms`);
      this.printRecoverySummary();
      
      return this.recoveryStats;
      
    } catch (error) {
      this.recoveryStats.errors.push(`Recovery failed: ${error}`);
      console.error("❌ Recovery failed:", error);
      throw error;
    }
  }

  private async performFullRecovery(): Promise<void> {
    console.log("🔄 Performing full network recovery");
    
    // 1. Restore từ tất cả backup files
    await this.restoreFromAllBackups();
    
    // 2. Reconstruct network state nếu được yêu cầu
    if (this.config.enableStateReconstruction) {
      await this.reconstructNetworkState();
    }
    
    // 3. Validate recovery
    await this.validateRecovery();
  }

  private async performIncrementalRecovery(): Promise<void> {
    console.log("🔄 Performing incremental network recovery");
    
    if (!this.config.startBlock || !this.config.endBlock) {
      throw new Error("Incremental recovery requires startBlock and endBlock");
    }
    
    // 1. Restore từ backup files trong range cụ thể
    await this.restoreFromBackupRange(this.config.startBlock, this.config.endBlock);
    
    // 2. Reconstruct state cho range này
    if (this.config.enableStateReconstruction) {
      await this.reconstructStateForRange(this.config.startBlock, this.config.endBlock);
    }
    
    // 3. Validate recovery
    await this.validateRecovery();
  }

  private async performSelectiveRecovery(): Promise<void> {
    console.log("🔄 Performing selective network recovery");
    
    if (!this.config.targetAddresses || this.config.targetAddresses.length === 0) {
      throw new Error("Selective recovery requires targetAddresses");
    }
    
    // 1. Restore transactions liên quan đến addresses cụ thể
    await this.restoreTransactionsForAddresses(this.config.targetAddresses);
    
    // 2. Reconstruct state cho addresses này
    if (this.config.enableStateReconstruction) {
      await this.reconstructStateForAddresses(this.config.targetAddresses);
    }
    
    // 3. Validate recovery
    await this.validateRecovery();
  }

  private async restoreFromAllBackups(): Promise<void> {
    console.log("📦 Restoring from all backup files");
    
    try {
      await this.backupManager.backupTransactions();
      this.recoveryStats.totalTransactionsRecovered = await this.getTotalTransactionsCount();
      console.log(`✅ Restored ${this.recoveryStats.totalTransactionsRecovered} transactions`);
    } catch (error) {
      this.recoveryStats.errors.push(`Backup restoration failed: ${error}`);
      throw error;
    }
  }

  private async restoreFromBackupRange(startBlock: number, endBlock: number): Promise<void> {
    console.log(`📦 Restoring from backup range: ${startBlock} - ${endBlock}`);
    
    try {
      await this.backupManager.backupTransactions(startBlock, endBlock);
      this.recoveryStats.totalTransactionsRecovered = await this.getTotalTransactionsCount();
      console.log(`✅ Restored ${this.recoveryStats.totalTransactionsRecovered} transactions`);
    } catch (error) {
      this.recoveryStats.errors.push(`Backup range restoration failed: ${error}`);
      throw error;
    }
  }

  private async restoreTransactionsForAddresses(addresses: string[]): Promise<void> {
    console.log(`📦 Restoring transactions for addresses: ${addresses.join(", ")}`);
    
    try {
      // Tìm tất cả backup files
      const backupFiles = await this.backupManager.listBackupFiles();
      let totalRestored = 0;
      
      for (const file of backupFiles) {
        const transactions = await this.loadTransactionsFromBackupFile(file);
        const filteredTransactions = transactions.filter(tx => 
          addresses.includes(tx.from) || addresses.includes(tx.to)
        );
        
        if (filteredTransactions.length > 0) {
          await this.dbManager.saveTransactions(filteredTransactions);
          totalRestored += filteredTransactions.length;
        }
      }
      
      this.recoveryStats.totalTransactionsRecovered = totalRestored;
      console.log(`✅ Restored ${totalRestored} transactions for target addresses`);
    } catch (error) {
      this.recoveryStats.errors.push(`Address-specific restoration failed: ${error}`);
      throw error;
    }
  }

  private async reconstructNetworkState(): Promise<void> {
    console.log("🔧 Reconstructing network state");
    
    try {
      const stats = await this.dbManager.getDatabaseStats();
      console.log(`📊 Reconstructing state for ${stats.totalTransactions} transactions`);
      
      // Tạo state reconstruction report
      const stateReport = {
        network: this.config.network,
        chainId: this.config.chainId,
        totalBlocks: stats.totalBlocks,
        totalTransactions: stats.totalTransactions,
        uniqueAddresses: stats.uniqueAddresses,
        reconstructionTime: new Date().toISOString(),
        stateHash: await this.calculateStateHash()
      };
      
      const reportFile = path.join(process.cwd(), "recovery", "state-reconstruction-report.json");
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify(stateReport, null, 2));
      
      console.log("✅ Network state reconstruction completed");
    } catch (error) {
      this.recoveryStats.warnings.push(`State reconstruction failed: ${error}`);
    }
  }

  private async reconstructStateForRange(startBlock: number, endBlock: number): Promise<void> {
    console.log(`🔧 Reconstructing state for range: ${startBlock} - ${endBlock}`);
    
    try {
      const transactions = await this.dbManager.searchTransactions({
        blockRange: { from: startBlock, to: endBlock }
      });
      
      console.log(`📊 Reconstructing state for ${transactions.length} transactions in range`);
      
      // Tạo state reconstruction report cho range
      const stateReport = {
        network: this.config.network,
        chainId: this.config.chainId,
        blockRange: { from: startBlock, to: endBlock },
        totalTransactions: transactions.length,
        reconstructionTime: new Date().toISOString(),
        stateHash: await this.calculateStateHash()
      };
      
      const reportFile = path.join(process.cwd(), "recovery", `state-reconstruction-${startBlock}-${endBlock}.json`);
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify(stateReport, null, 2));
      
      console.log("✅ State reconstruction for range completed");
    } catch (error) {
      this.recoveryStats.warnings.push(`Range state reconstruction failed: ${error}`);
    }
  }

  private async reconstructStateForAddresses(addresses: string[]): Promise<void> {
    console.log(`🔧 Reconstructing state for addresses: ${addresses.join(", ")}`);
    
    try {
      let totalTransactions = 0;
      
      for (const address of addresses) {
        const transactions = await this.dbManager.getTransactionsByAddress(address);
        totalTransactions += transactions.length;
      }
      
      console.log(`📊 Reconstructing state for ${totalTransactions} transactions`);
      
      // Tạo state reconstruction report cho addresses
      const stateReport = {
        network: this.config.network,
        chainId: this.config.chainId,
        targetAddresses: addresses,
        totalTransactions: totalTransactions,
        reconstructionTime: new Date().toISOString(),
        stateHash: await this.calculateStateHash()
      };
      
      const reportFile = path.join(process.cwd(), "recovery", `state-reconstruction-addresses.json`);
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify(stateReport, null, 2));
      
      console.log("✅ State reconstruction for addresses completed");
    } catch (error) {
      this.recoveryStats.warnings.push(`Address state reconstruction failed: ${error}`);
    }
  }

  private async validateRecovery(): Promise<void> {
    console.log("🔍 Validating recovery");
    
    try {
      const stats = await this.dbManager.getDatabaseStats();
      
      // Kiểm tra tính toàn vẹn dữ liệu
      if (stats.totalTransactions === 0) {
        this.recoveryStats.warnings.push("No transactions recovered");
      }
      
      if (stats.totalBlocks === 0) {
        this.recoveryStats.warnings.push("No blocks recovered");
      }
      
      // Tạo validation report
      const validationReport = {
        network: this.config.network,
        chainId: this.config.chainId,
        validationTime: new Date().toISOString(),
        stats: stats,
        isValid: this.recoveryStats.errors.length === 0,
        warnings: this.recoveryStats.warnings,
        errors: this.recoveryStats.errors
      };
      
      const reportFile = path.join(process.cwd(), "recovery", "validation-report.json");
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify(validationReport, null, 2));
      
      console.log("✅ Recovery validation completed");
    } catch (error) {
      this.recoveryStats.errors.push(`Validation failed: ${error}`);
    }
  }

  private async calculateStateHash(): Promise<string> {
    // Tính hash của state để đảm bảo tính toàn vẹn
    const stats = await this.dbManager.getDatabaseStats();
    const stateData = {
      network: this.config.network,
      chainId: this.config.chainId,
      totalTransactions: stats.totalTransactions,
      totalBlocks: stats.totalBlocks,
      uniqueAddresses: stats.uniqueAddresses,
      timestamp: Date.now()
    };
    
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(stateData)));
  }

  private async getTotalTransactionsCount(): Promise<number> {
    const stats = await this.dbManager.getDatabaseStats();
    return stats.totalTransactions;
  }

  private async loadTransactionsFromBackupFile(filename: string): Promise<any[]> {
    const backupDir = path.join(process.cwd(), "backups", this.config.network);
    const filepath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return [];
    }
    
    const backupData = JSON.parse(fs.readFileSync(filepath, "utf8"));
    return backupData.transactions || [];
  }

  private printRecoverySummary(): void {
    console.log("\n📊 Recovery Summary:");
    console.log("=" .repeat(50));
    console.log(`Network: ${this.config.network}`);
    console.log(`Chain ID: ${this.config.chainId}`);
    console.log(`Recovery Mode: ${this.config.recoveryMode}`);
    console.log(`Total Blocks Recovered: ${this.recoveryStats.totalBlocksRecovered}`);
    console.log(`Total Transactions Recovered: ${this.recoveryStats.totalTransactionsRecovered}`);
    console.log(`Total Addresses Recovered: ${this.recoveryStats.totalAddressesRecovered}`);
    console.log(`Recovery Time: ${this.recoveryStats.recoveryTime}ms`);
    
    if (this.recoveryStats.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      this.recoveryStats.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (this.recoveryStats.errors.length > 0) {
      console.log("\n❌ Errors:");
      this.recoveryStats.errors.forEach(error => console.log(`  - ${error}`));
    }
  }

  async generateRecoveryReport(): Promise<string> {
    const report = {
      network: this.config.network,
      chainId: this.config.chainId,
      recoveryConfig: this.config,
      recoveryStats: this.recoveryStats,
      timestamp: new Date().toISOString()
    };
    
    const reportFile = path.join(process.cwd(), "recovery", "recovery-report.json");
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Recovery report saved to: ${reportFile}`);
    return reportFile;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "full";
  
  const config: RecoveryConfig = {
    network: process.env.HARDHAT_NETWORK || "localhost",
    chainId: process.env.HARDHAT_NETWORK === "localhost" ? 31337 : 256000,
    recoveryMode: command as "full" | "incremental" | "selective",
    startBlock: args[1] ? parseInt(args[1]) : undefined,
    endBlock: args[2] ? parseInt(args[2]) : undefined,
    targetAddresses: args[3] ? args[3].split(",") : undefined,
    enableStateReconstruction: true,
    enableTransactionReplay: false
  };

  const recoveryManager = new NetworkRecoveryManager(config);

  try {
    await recoveryManager.performRecovery();
    await recoveryManager.generateRecoveryReport();
    
  } catch (error) {
    console.error("❌ Recovery failed:", error);
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

export { NetworkRecoveryManager, RecoveryConfig };
