import * as fs from "fs";
import * as path from "path";
import { TransactionLog } from "./backupTransactionLogs";

interface DatabaseConfig {
  type: "sqlite" | "json" | "mongodb";
  connectionString?: string;
  databaseName: string;
  collectionName?: string;
}

interface DatabaseStats {
  totalTransactions: number;
  totalBlocks: number;
  uniqueAddresses: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  lastUpdate: Date;
}

class TransactionDatabaseManager {
  private config: DatabaseConfig;
  private dbPath: string;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.dbPath = path.join(process.cwd(), "database", config.databaseName);
    this.ensureDatabaseDirectory();
  }

  private ensureDatabaseDirectory(): void {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  async saveTransactions(transactions: TransactionLog[]): Promise<void> {
    console.log(`💾 Saving ${transactions.length} transactions to database`);
    
    switch (this.config.type) {
      case "json":
        await this.saveToJsonDatabase(transactions);
        break;
      case "sqlite":
        await this.saveToSqliteDatabase(transactions);
        break;
      case "mongodb":
        await this.saveToMongoDatabase(transactions);
        break;
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  private async saveToJsonDatabase(transactions: TransactionLog[]): Promise<void> {
    const transactionsFile = path.join(this.dbPath, "transactions.json");
    const blocksFile = path.join(this.dbPath, "blocks.json");
    const addressesFile = path.join(this.dbPath, "addresses.json");
    const indexFile = path.join(this.dbPath, "index.json");

    // Load existing data
    let existingTransactions: TransactionLog[] = [];
    let existingBlocks: { [blockNumber: number]: string[] } = {};
    let existingAddresses: { [address: string]: string[] } = {};
    let existingIndex: any = {};

    if (fs.existsSync(transactionsFile)) {
      existingTransactions = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));
    }
    if (fs.existsSync(blocksFile)) {
      existingBlocks = JSON.parse(fs.readFileSync(blocksFile, "utf8"));
    }
    if (fs.existsSync(addressesFile)) {
      existingAddresses = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
    }
    if (fs.existsSync(indexFile)) {
      existingIndex = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    }

    // Merge new transactions
    const allTransactions = [...existingTransactions, ...transactions];
    
    // Remove duplicates based on transaction hash
    const uniqueTransactions = allTransactions.filter((tx, index, self) => 
      index === self.findIndex(t => t.transactionHash === tx.transactionHash)
    );

    // Update blocks index
    transactions.forEach(tx => {
      if (!existingBlocks[tx.blockNumber]) {
        existingBlocks[tx.blockNumber] = [];
      }
      if (!existingBlocks[tx.blockNumber].includes(tx.transactionHash)) {
        existingBlocks[tx.blockNumber].push(tx.transactionHash);
      }
    });

    // Update addresses index
    transactions.forEach(tx => {
      // From address
      if (!existingAddresses[tx.from]) {
        existingAddresses[tx.from] = [];
      }
      if (!existingAddresses[tx.from].includes(tx.transactionHash)) {
        existingAddresses[tx.from].push(tx.transactionHash);
      }

      // To address
      if (tx.to) {
        if (!existingAddresses[tx.to]) {
          existingAddresses[tx.to] = [];
        }
        if (!existingAddresses[tx.to].includes(tx.transactionHash)) {
          existingAddresses[tx.to].push(tx.transactionHash);
        }
      }
    });

    // Update index
    const newIndex = {
      totalTransactions: uniqueTransactions.length,
      totalBlocks: Object.keys(existingBlocks).length,
      uniqueAddresses: Object.keys(existingAddresses).length,
      lastUpdate: new Date().toISOString(),
      blockRange: {
        min: Math.min(...uniqueTransactions.map(tx => tx.blockNumber)),
        max: Math.max(...uniqueTransactions.map(tx => tx.blockNumber))
      }
    };

    // Save all data
    fs.writeFileSync(transactionsFile, JSON.stringify(uniqueTransactions, null, 2));
    fs.writeFileSync(blocksFile, JSON.stringify(existingBlocks, null, 2));
    fs.writeFileSync(addressesFile, JSON.stringify(existingAddresses, null, 2));
    fs.writeFileSync(indexFile, JSON.stringify(newIndex, null, 2));

    console.log(`✅ Saved to JSON database: ${uniqueTransactions.length} transactions`);
  }

  private async saveToSqliteDatabase(transactions: TransactionLog[]): Promise<void> {
    // SQLite implementation would go here
    // For now, we'll use a simple JSON-based approach
    console.log("⚠️  SQLite support not implemented yet, using JSON fallback");
    await this.saveToJsonDatabase(transactions);
  }

  private async saveToMongoDatabase(transactions: TransactionLog[]): Promise<void> {
    // MongoDB implementation would go here
    console.log("⚠️  MongoDB support not implemented yet, using JSON fallback");
    await this.saveToJsonDatabase(transactions);
  }

  async getTransactionsByBlock(blockNumber: number): Promise<TransactionLog[]> {
    const blocksFile = path.join(this.dbPath, "blocks.json");
    const transactionsFile = path.join(this.dbPath, "transactions.json");

    if (!fs.existsSync(blocksFile) || !fs.existsSync(transactionsFile)) {
      return [];
    }

    const blocks: { [blockNumber: number]: string[] } = JSON.parse(fs.readFileSync(blocksFile, "utf8"));
    const allTransactions: TransactionLog[] = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));

    const transactionHashes = blocks[blockNumber] || [];
    return allTransactions.filter(tx => transactionHashes.includes(tx.transactionHash));
  }

  async getTransactionsByAddress(address: string): Promise<TransactionLog[]> {
    const addressesFile = path.join(this.dbPath, "addresses.json");
    const transactionsFile = path.join(this.dbPath, "transactions.json");

    if (!fs.existsSync(addressesFile) || !fs.existsSync(transactionsFile)) {
      return [];
    }

    const addresses: { [address: string]: string[] } = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
    const allTransactions: TransactionLog[] = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));

    const transactionHashes = addresses[address] || [];
    return allTransactions.filter(tx => transactionHashes.includes(tx.transactionHash));
  }

  async getTransactionByHash(hash: string): Promise<TransactionLog | null> {
    const transactionsFile = path.join(this.dbPath, "transactions.json");

    if (!fs.existsSync(transactionsFile)) {
      return null;
    }

    const allTransactions: TransactionLog[] = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));
    return allTransactions.find(tx => tx.transactionHash === hash) || null;
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const indexFile = path.join(this.dbPath, "index.json");

    if (!fs.existsSync(indexFile)) {
      return {
        totalTransactions: 0,
        totalBlocks: 0,
        uniqueAddresses: 0,
        dateRange: { from: new Date(), to: new Date() },
        lastUpdate: new Date()
      };
    }

    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    
    return {
      totalTransactions: index.totalTransactions || 0,
      totalBlocks: index.totalBlocks || 0,
      uniqueAddresses: index.uniqueAddresses || 0,
      dateRange: {
        from: new Date(index.blockRange?.min || 0),
        to: new Date(index.blockRange?.max || 0)
      },
      lastUpdate: new Date(index.lastUpdate || Date.now())
    };
  }

  async searchTransactions(query: {
    from?: string;
    to?: string;
    blockRange?: { from: number; to: number };
    valueRange?: { from: string; to: string };
    status?: number;
  }): Promise<TransactionLog[]> {
    const transactionsFile = path.join(this.dbPath, "transactions.json");

    if (!fs.existsSync(transactionsFile)) {
      return [];
    }

    const allTransactions: TransactionLog[] = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));

    return allTransactions.filter(tx => {
      if (query.from && tx.from.toLowerCase() !== query.from.toLowerCase()) return false;
      if (query.to && tx.to.toLowerCase() !== query.to.toLowerCase()) return false;
      if (query.blockRange) {
        if (tx.blockNumber < query.blockRange.from || tx.blockNumber > query.blockRange.to) return false;
      }
      if (query.valueRange) {
        const value = BigInt(tx.value);
        const fromValue = BigInt(query.valueRange.from);
        const toValue = BigInt(query.valueRange.to);
        if (value < fromValue || value > toValue) return false;
      }
      if (query.status !== undefined && tx.status !== query.status) return false;
      
      return true;
    });
  }

  async exportToCSV(outputFile?: string): Promise<string> {
    const transactionsFile = path.join(this.dbPath, "transactions.json");
    
    if (!fs.existsSync(transactionsFile)) {
      throw new Error("No transactions found in database");
    }

    const allTransactions: TransactionLog[] = JSON.parse(fs.readFileSync(transactionsFile, "utf8"));
    
    const csvFile = outputFile || path.join(this.dbPath, `transactions-export-${Date.now()}.csv`);
    
    // CSV header
    const headers = [
      "Block Number",
      "Transaction Hash",
      "From",
      "To",
      "Value (Wei)",
      "Gas Used",
      "Gas Price",
      "Timestamp",
      "Status",
      "Input Data"
    ];
    
    let csvContent = headers.join(",") + "\n";
    
    // CSV rows
    allTransactions.forEach(tx => {
      const row = [
        tx.blockNumber,
        tx.transactionHash,
        tx.from,
        tx.to,
        tx.value,
        tx.gasUsed,
        tx.gasPrice,
        new Date(tx.timestamp * 1000).toISOString(),
        tx.status,
        `"${tx.input.replace(/"/g, '""')}"` // Escape quotes in input data
      ];
      csvContent += row.join(",") + "\n";
    });
    
    fs.writeFileSync(csvFile, csvContent);
    
    console.log(`📊 Exported ${allTransactions.length} transactions to: ${csvFile}`);
    return csvFile;
  }
}

// Main function for testing
async function main() {
  const config: DatabaseConfig = {
    type: "json",
    databaseName: "olym3_transactions"
  };

  const dbManager = new TransactionDatabaseManager(config);
  
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "stats":
        const stats = await dbManager.getDatabaseStats();
        console.log("📊 Database Statistics:");
        console.log(JSON.stringify(stats, null, 2));
        break;
        
      case "export":
        const outputFile = args[1];
        await dbManager.exportToCSV(outputFile);
        break;
        
      case "search":
        // Example search
        const results = await dbManager.searchTransactions({
          blockRange: { from: 0, to: 1000 }
        });
        console.log(`Found ${results.length} transactions`);
        break;
        
      default:
        console.log("Usage:");
        console.log("  npm run db:stats        - Show database statistics");
        console.log("  npm run db:export      - Export transactions to CSV");
        console.log("  npm run db:search      - Search transactions");
        break;
    }
    
  } catch (error) {
    console.error("❌ Database operation failed:", error);
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

export { TransactionDatabaseManager, DatabaseConfig };
