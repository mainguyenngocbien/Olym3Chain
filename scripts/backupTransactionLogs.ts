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

class TransactionBackupManager {
  private backupDir: string;
  private network: string;
  private chainId: number;

  constructor(network: string, chainId: number) {
    this.network = network;
    this.chainId = chainId;
    this.backupDir = path.join(process.cwd(), "backups", network);
    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async backupTransactions(fromBlock?: number, toBlock?: number): Promise<void> {
    console.log(`🔄 Starting backup for network: ${this.network}`);
    
    const provider = ethers.provider;
    const currentBlock = await provider.getBlockNumber();
    
    // Nếu không chỉ định fromBlock, lấy từ file backup cuối cùng
    if (!fromBlock) {
      fromBlock = await this.getLastBackupBlock();
    }
    
    // Nếu không chỉ định toBlock, lấy block hiện tại
    if (!toBlock) {
      toBlock = currentBlock;
    }

    console.log(`📦 Backing up transactions from block ${fromBlock} to ${toBlock}`);

    const transactions: TransactionLog[] = [];
    let processedBlocks = 0;

    // Xử lý từng block
    for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
      try {
        const block = await provider.getBlock(blockNum, true);
        if (!block || !block.transactions) continue;

        console.log(`📄 Processing block ${blockNum} (${block.transactions.length} transactions)`);

        // Xử lý từng transaction trong block
        for (const txHash of block.transactions) {
          try {
            const tx = await provider.getTransaction(txHash);
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (!tx || !receipt) continue;

            const transactionLog: TransactionLog = {
              blockNumber: block.number,
              transactionHash: tx.hash,
              from: tx.from,
              to: tx.to || "",
              value: tx.value.toString(),
              gasUsed: receipt.gasUsed.toString(),
              gasPrice: tx.gasPrice?.toString() || "0",
              timestamp: block.timestamp,
              status: receipt.status || 0,
              logs: receipt.logs,
              input: tx.data,
              receipt: receipt
            };

            transactions.push(transactionLog);
          } catch (error) {
            console.warn(`⚠️  Error processing transaction ${txHash}:`, error);
          }
        }

        processedBlocks++;
        
        // Backup mỗi 100 blocks để tránh mất dữ liệu
        if (processedBlocks % 100 === 0) {
          await this.saveIncrementalBackup(transactions, blockNum);
          transactions.length = 0; // Clear array
          console.log(`💾 Saved incremental backup at block ${blockNum}`);
        }

      } catch (error) {
        console.error(`❌ Error processing block ${blockNum}:`, error);
      }
    }

    // Lưu backup cuối cùng
    if (transactions.length > 0) {
      await this.saveIncrementalBackup(transactions, toBlock);
    }

    // Lưu metadata backup
    await this.saveBackupMetadata(toBlock);
    
    console.log(`✅ Backup completed! Processed ${processedBlocks} blocks`);
  }

  private async getLastBackupBlock(): Promise<number> {
    const metadataFile = path.join(this.backupDir, "backup-metadata.json");
    
    if (fs.existsSync(metadataFile)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
        return metadata.lastBackupBlock + 1;
      } catch (error) {
        console.warn("⚠️  Could not read backup metadata, starting from block 0");
      }
    }
    
    return 0;
  }

  private async saveIncrementalBackup(transactions: TransactionLog[], blockNumber: number): Promise<void> {
    const timestamp = Date.now();
    const filename = `backup-${blockNumber}-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    const backupData: BackupData = {
      network: this.network,
      chainId: this.chainId,
      lastBackupBlock: blockNumber,
      transactions: transactions,
      backupTimestamp: timestamp
    };

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    console.log(`💾 Saved backup file: ${filename}`);
  }

  private async saveBackupMetadata(lastBlock: number): Promise<void> {
    const metadataFile = path.join(this.backupDir, "backup-metadata.json");
    const metadata = {
      network: this.network,
      chainId: this.chainId,
      lastBackupBlock: lastBlock,
      lastBackupTime: Date.now(),
      totalBackups: this.getBackupFileCount()
    };

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  }

  private getBackupFileCount(): number {
    const files = fs.readdirSync(this.backupDir);
    return files.filter(file => file.startsWith("backup-") && file.endsWith(".json")).length;
  }

  async listBackups(): Promise<string[]> {
    const files = fs.readdirSync(this.backupDir);
    return files.filter(file => file.startsWith("backup-") && file.endsWith(".json"));
  }

  async getBackupInfo(): Promise<any> {
    const metadataFile = path.join(this.backupDir, "backup-metadata.json");
    
    if (fs.existsSync(metadataFile)) {
      return JSON.parse(fs.readFileSync(metadataFile, "utf8"));
    }
    
    return null;
  }
}

// Main function
async function main() {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const chainId = 256000; // All networks now use Olym3 chain ID
  
  const backupManager = new TransactionBackupManager(network, chainId);
  
  // Lấy arguments từ command line
  const args = process.argv.slice(2);
  const fromBlock = args[0] ? parseInt(args[0]) : undefined;
  const toBlock = args[1] ? parseInt(args[1]) : undefined;

  try {
    await backupManager.backupTransactions(fromBlock, toBlock);
    
    // Hiển thị thông tin backup
    const info = await backupManager.getBackupInfo();
    if (info) {
      console.log("\n📊 Backup Summary:");
      console.log(`Network: ${info.network}`);
      console.log(`Chain ID: ${info.chainId}`);
      console.log(`Last Backup Block: ${info.lastBackupBlock}`);
      console.log(`Total Backup Files: ${info.totalBackups}`);
      console.log(`Last Backup Time: ${new Date(info.lastBackupTime).toLocaleString()}`);
    }
    
  } catch (error) {
    console.error("❌ Backup failed:", error);
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

export { TransactionBackupManager };
