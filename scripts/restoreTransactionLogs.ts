import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface TransactionLog {
  blockNumber: number;
  transactionHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: number;
  status: number;
  logs: any[];
  input: string;
  receipt: any;
}

interface BackupData {
  network: string;
  chainId: number;
  lastBackupBlock: number;
  transactions: TransactionLog[];
  backupTimestamp: number;
}

class TransactionRestoreManager {
  private backupDir: string;
  private network: string;
  private chainId: number;

  constructor(network: string, chainId: number) {
    this.network = network;
    this.chainId = chainId;
    this.backupDir = path.join(process.cwd(), "backups", network);
  }

  async restoreFromBackup(backupFile?: string): Promise<void> {
    console.log(`🔄 Starting restore for network: ${this.network}`);
    
    if (!fs.existsSync(this.backupDir)) {
      throw new Error(`Backup directory not found: ${this.backupDir}`);
    }

    let backupFiles: string[];
    
    if (backupFile) {
      // Restore từ file cụ thể
      if (!fs.existsSync(path.join(this.backupDir, backupFile))) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }
      backupFiles = [backupFile];
    } else {
      // Restore từ tất cả backup files
      backupFiles = await this.getAllBackupFiles();
    }

    console.log(`📦 Found ${backupFiles.length} backup files to restore`);

    const allTransactions: TransactionLog[] = [];
    let totalTransactions = 0;

    // Đọc tất cả backup files
    for (const file of backupFiles) {
      try {
        const filepath = path.join(this.backupDir, file);
        const backupData: BackupData = JSON.parse(fs.readFileSync(filepath, "utf8"));
        
        console.log(`📄 Processing backup file: ${file} (${backupData.transactions.length} transactions)`);
        
        allTransactions.push(...backupData.transactions);
        totalTransactions += backupData.transactions.length;
        
      } catch (error) {
        console.error(`❌ Error reading backup file ${file}:`, error);
      }
    }

    // Sắp xếp transactions theo block number và transaction hash
    allTransactions.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return a.transactionHash.localeCompare(b.transactionHash);
    });

    // Lưu vào database hoặc file
    await this.saveRestoredTransactions(allTransactions);
    
    console.log(`✅ Restore completed! Restored ${totalTransactions} transactions`);
  }

  private async getAllBackupFiles(): Promise<string[]> {
    const files = fs.readdirSync(this.backupDir);
    const backupFiles = files
      .filter(file => file.startsWith("backup-") && file.endsWith(".json"))
      .sort(); // Sắp xếp theo tên file (theo thứ tự thời gian)
    
    return backupFiles;
  }

  private async saveRestoredTransactions(transactions: TransactionLog[]): Promise<void> {
    const restoreDir = path.join(process.cwd(), "restored", this.network);
    
    if (!fs.existsSync(restoreDir)) {
      fs.mkdirSync(restoreDir, { recursive: true });
    }

    // Lưu tất cả transactions vào một file
    const allTransactionsFile = path.join(restoreDir, `all-transactions-${Date.now()}.json`);
    fs.writeFileSync(allTransactionsFile, JSON.stringify(transactions, null, 2));
    
    // Tạo index theo block number
    const blockIndex: { [blockNumber: number]: string[] } = {};
    transactions.forEach(tx => {
      if (!blockIndex[tx.blockNumber]) {
        blockIndex[tx.blockNumber] = [];
      }
      blockIndex[tx.blockNumber].push(tx.transactionHash);
    });

    const blockIndexFile = path.join(restoreDir, `block-index-${Date.now()}.json`);
    fs.writeFileSync(blockIndexFile, JSON.stringify(blockIndex, null, 2));

    // Tạo index theo address
    const addressIndex: { [address: string]: string[] } = {};
    transactions.forEach(tx => {
      // Index theo from address
      if (!addressIndex[tx.from]) {
        addressIndex[tx.from] = [];
      }
      addressIndex[tx.from].push(tx.transactionHash);

      // Index theo to address (nếu có)
      if (tx.to) {
        if (!addressIndex[tx.to]) {
          addressIndex[tx.to] = [];
        }
        addressIndex[tx.to].push(tx.transactionHash);
      }
    });

    const addressIndexFile = path.join(restoreDir, `address-index-${Date.now()}.json`);
    fs.writeFileSync(addressIndexFile, JSON.stringify(addressIndex, null, 2));

    // Tạo summary
    const summary = {
      network: this.network,
      chainId: this.chainId,
      totalTransactions: transactions.length,
      blockRange: {
        from: Math.min(...transactions.map(tx => tx.blockNumber)),
        to: Math.max(...transactions.map(tx => tx.blockNumber))
      },
      timeRange: {
        from: Math.min(...transactions.map(tx => tx.timestamp)),
        to: Math.max(...transactions.map(tx => tx.timestamp))
      },
      uniqueAddresses: Object.keys(addressIndex).length,
      restoreTimestamp: Date.now()
    };

    const summaryFile = path.join(restoreDir, `restore-summary-${Date.now()}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    console.log(`💾 Saved restored data to: ${restoreDir}`);
    console.log(`📊 Summary: ${transactions.length} transactions, ${Object.keys(addressIndex).length} unique addresses`);
  }

  async listAvailableBackups(): Promise<void> {
    if (!fs.existsSync(this.backupDir)) {
      console.log(`❌ No backup directory found: ${this.backupDir}`);
      return;
    }

    const backupFiles = await this.getAllBackupFiles();
    
    if (backupFiles.length === 0) {
      console.log("❌ No backup files found");
      return;
    }

    console.log(`📦 Available backup files for ${this.network}:`);
    console.log("=" .repeat(60));
    
    for (const file of backupFiles) {
      try {
        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);
        const backupData: BackupData = JSON.parse(fs.readFileSync(filepath, "utf8"));
        
        console.log(`📄 ${file}`);
        console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Transactions: ${backupData.transactions.length}`);
        console.log(`   Block Range: ${backupData.lastBackupBlock}`);
        console.log(`   Created: ${new Date(backupData.backupTimestamp).toLocaleString()}`);
        console.log("");
      } catch (error) {
        console.error(`❌ Error reading ${file}:`, error);
      }
    }
  }

  async getBackupStats(): Promise<void> {
    const metadataFile = path.join(this.backupDir, "backup-metadata.json");
    
    if (!fs.existsSync(metadataFile)) {
      console.log("❌ No backup metadata found");
      return;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
      const backupFiles = await this.getAllBackupFiles();
      
      console.log("📊 Backup Statistics:");
      console.log("=" .repeat(40));
      console.log(`Network: ${metadata.network}`);
      console.log(`Chain ID: ${metadata.chainId}`);
      console.log(`Last Backup Block: ${metadata.lastBackupBlock}`);
      console.log(`Total Backup Files: ${metadata.totalBackups}`);
      console.log(`Last Backup Time: ${new Date(metadata.lastBackupTime).toLocaleString()}`);
      console.log(`Backup Directory: ${this.backupDir}`);
      
      // Tính tổng kích thước backup
      let totalSize = 0;
      for (const file of backupFiles) {
        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);
        totalSize += stats.size;
      }
      
      console.log(`Total Backup Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (error) {
      console.error("❌ Error reading backup metadata:", error);
    }
  }
}

// Main function
async function main() {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const chainId = 256000; // All networks now use Olym3 chain ID
  
  const restoreManager = new TransactionRestoreManager(network, chainId);
  
  // Lấy arguments từ command line
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "list":
        await restoreManager.listAvailableBackups();
        break;
      case "stats":
        await restoreManager.getBackupStats();
        break;
      case "restore":
        const backupFile = args[1]; // Optional backup file name
        await restoreManager.restoreFromBackup(backupFile);
        break;
      default:
        console.log("Usage:");
        console.log("  npm run restore:list     - List available backups");
        console.log("  npm run restore:stats    - Show backup statistics");
        console.log("  npm run restore:all      - Restore from all backups");
        console.log("  npm run restore:file <filename> - Restore from specific backup file");
        break;
    }
    
  } catch (error) {
    console.error("❌ Restore failed:", error);
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

export { TransactionRestoreManager };
