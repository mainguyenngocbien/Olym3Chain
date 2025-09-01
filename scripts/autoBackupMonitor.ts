import { ethers } from "hardhat";
import { TransactionBackupManager } from "./backupTransactionLogs";
import * as fs from "fs";
import * as path from "path";

interface MonitorConfig {
  network: string;
  chainId: number;
  backupInterval: number; // milliseconds
  maxBackupAge: number; // milliseconds
  maxBackupFiles: number;
  enableAutoCleanup: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

class AutoBackupMonitor {
  private config: MonitorConfig;
  private backupManager: TransactionBackupManager;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBackupBlock: number = 0;
  private logFile: string;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.backupManager = new TransactionBackupManager(config.network, config.chainId);
    this.logFile = path.join(process.cwd(), "logs", "backup-monitor.log");
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    
    // Ghi vào file log
    fs.appendFileSync(this.logFile, logMessage + "\n");
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log("warn", "Monitor is already running");
      return;
    }

    this.log("info", `Starting auto backup monitor for network: ${this.config.network}`);
    this.log("info", `Backup interval: ${this.config.backupInterval / 1000} seconds`);
    
    this.isRunning = true;
    
    // Backup ngay lập tức
    await this.performBackup();
    
    // Thiết lập interval cho backup định kỳ
    this.intervalId = setInterval(async () => {
      try {
        await this.performBackup();
        await this.cleanupOldBackups();
      } catch (error) {
        this.log("error", `Backup failed: ${error}`);
      }
    }, this.config.backupInterval);

    this.log("info", "Auto backup monitor started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.log("warn", "Monitor is not running");
      return;
    }

    this.log("info", "Stopping auto backup monitor");
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.log("info", "Auto backup monitor stopped");
  }

  private async performBackup(): Promise<void> {
    try {
      this.log("info", "Starting scheduled backup");
      
      const provider = ethers.provider;
      const currentBlock = await provider.getBlockNumber();
      
      if (currentBlock <= this.lastBackupBlock) {
        this.log("debug", "No new blocks to backup");
        return;
      }

      // Backup từ block cuối cùng đã backup
      await this.backupManager.backupTransactions(this.lastBackupBlock + 1, currentBlock);
      
      this.lastBackupBlock = currentBlock;
      
      this.log("info", `Backup completed. Current block: ${currentBlock}`);
      
    } catch (error) {
      this.log("error", `Backup failed: ${error}`);
      throw error;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    if (!this.config.enableAutoCleanup) {
      return;
    }

    try {
      this.log("debug", "Starting backup cleanup");
      
      const backupFiles = await this.backupManager.listBackups();
      
      if (backupFiles.length <= this.config.maxBackupFiles) {
        this.log("debug", "No cleanup needed");
        return;
      }

      // Sắp xếp files theo thời gian tạo (oldest first)
      const backupDir = path.join(process.cwd(), "backups", this.config.network);
      const filesWithStats = backupFiles.map(file => {
        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        return { file, stats };
      }).sort((a, b) => a.stats.birthtime.getTime() - b.stats.birthtime.getTime());

      // Xóa files cũ nhất
      const filesToDelete = filesWithStats.slice(0, filesWithStats.length - this.config.maxBackupFiles);
      
      for (const { file } of filesToDelete) {
        const filepath = path.join(backupDir, file);
        fs.unlinkSync(filepath);
        this.log("info", `Deleted old backup file: ${file}`);
      }

      this.log("info", `Cleanup completed. Deleted ${filesToDelete.length} old backup files`);
      
    } catch (error) {
      this.log("error", `Cleanup failed: ${error}`);
    }
  }

  async getStatus(): Promise<any> {
    const provider = ethers.provider;
    const currentBlock = await provider.getBlockNumber();
    const backupInfo = await this.backupManager.getBackupInfo();
    
    return {
      isRunning: this.isRunning,
      network: this.config.network,
      chainId: this.config.chainId,
      currentBlock,
      lastBackupBlock: this.lastBackupBlock,
      blocksToBackup: currentBlock - this.lastBackupBlock,
      backupInfo,
      config: this.config
    };
  }

  async forceBackup(): Promise<void> {
    this.log("info", "Force backup requested");
    await this.performBackup();
  }

  async updateConfig(newConfig: Partial<MonitorConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.log("info", "Configuration updated");
    
    // Restart monitor nếu đang chạy
    if (this.isRunning) {
      await this.stop();
      await this.start();
    }
  }
}

// Configuration mặc định
const defaultConfig: MonitorConfig = {
  network: process.env.HARDHAT_NETWORK || "localhost",
  chainId: process.env.HARDHAT_NETWORK === "localhost" ? 31337 : 256000,
  backupInterval: 5 * 60 * 1000, // 5 phút
  maxBackupAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  maxBackupFiles: 100,
  enableAutoCleanup: true,
  logLevel: "info"
};

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "start";
  
  // Load config từ file nếu có
  let config = defaultConfig;
  const configFile = path.join(process.cwd(), "backup-config.json");
  
  if (fs.existsSync(configFile)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configFile, "utf8"));
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.error("Error loading config file:", error);
    }
  }

  const monitor = new AutoBackupMonitor(config);

  try {
    switch (command) {
      case "start":
        await monitor.start();
        
        // Giữ process chạy
        process.on("SIGINT", async () => {
          console.log("\n🛑 Received SIGINT, stopping monitor...");
          await monitor.stop();
          process.exit(0);
        });
        
        process.on("SIGTERM", async () => {
          console.log("\n🛑 Received SIGTERM, stopping monitor...");
          await monitor.stop();
          process.exit(0);
        });
        
        // Giữ process alive
        setInterval(() => {}, 1000);
        break;
        
      case "stop":
        await monitor.stop();
        break;
        
      case "status":
        const status = await monitor.getStatus();
        console.log("📊 Monitor Status:");
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case "backup":
        await monitor.forceBackup();
        break;
        
      case "config":
        console.log("⚙️  Current Configuration:");
        console.log(JSON.stringify(config, null, 2));
        break;
        
      default:
        console.log("Usage:");
        console.log("  npm run monitor:start   - Start auto backup monitor");
        console.log("  npm run monitor:stop    - Stop auto backup monitor");
        console.log("  npm run monitor:status  - Show monitor status");
        console.log("  npm run monitor:backup  - Force backup now");
        console.log("  npm run monitor:config  - Show current configuration");
        break;
    }
    
  } catch (error) {
    console.error("❌ Monitor operation failed:", error);
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

export { AutoBackupMonitor, MonitorConfig };
