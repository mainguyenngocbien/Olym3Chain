import * as fs from "fs";
import * as path from "path";

interface SetupConfig {
  network: string;
  chainId: number;
  enableAutoBackup: boolean;
  backupInterval: number;
  maxBackupFiles: number;
  enableDatabase: boolean;
  enableRecovery: boolean;
}

class BackupSystemSetup {
  private config: SetupConfig;

  constructor(config: SetupConfig) {
    this.config = config;
  }

  async setup(): Promise<void> {
    console.log("🚀 Setting up Olym3Chain Backup System");
    console.log("=" .repeat(50));

    try {
      // 1. Tạo cấu trúc thư mục
      await this.createDirectoryStructure();
      
      // 2. Tạo file cấu hình
      await this.createConfigFiles();
      
      // 3. Tạo file môi trường
      await this.createEnvironmentFiles();
      
      // 4. Khởi tạo database
      if (this.config.enableDatabase) {
        await this.initializeDatabase();
      }
      
      // 5. Tạo scripts khởi động
      await this.createStartupScripts();
      
      // 6. Test hệ thống
      await this.testSystem();
      
      console.log("\n✅ Backup system setup completed successfully!");
      this.printUsageInstructions();
      
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  }

  private async createDirectoryStructure(): Promise<void> {
    console.log("📁 Creating directory structure...");
    
    const directories = [
      "backups",
      `backups/${this.config.network}`,
      "database",
      `database/${this.config.network}_transactions`,
      "logs",
      "recovery",
      "restored",
      `restored/${this.config.network}`
    ];

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  ✅ Created: ${dir}`);
      } else {
        console.log(`  ⚠️  Already exists: ${dir}`);
      }
    }
  }

  private async createConfigFiles(): Promise<void> {
    console.log("⚙️  Creating configuration files...");
    
    // Backup config
    const backupConfig = {
      network: this.config.network,
      chainId: this.config.chainId,
      backupInterval: this.config.backupInterval,
      maxBackupAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxBackupFiles: this.config.maxBackupFiles,
      enableAutoCleanup: true,
      logLevel: "info",
      backupSettings: {
        batchSize: 100,
        retryAttempts: 3,
        retryDelay: 5000,
        enableCompression: false,
        enableEncryption: false
      },
      notificationSettings: {
        enableNotifications: false,
        webhookUrl: "",
        emailSettings: {
          enabled: false,
          smtpHost: "",
          smtpPort: 587,
          username: "",
          password: "",
          to: ""
        }
      },
      storageSettings: {
        localStorage: {
          enabled: true,
          path: "./backups"
        },
        cloudStorage: {
          enabled: false,
          provider: "aws",
          bucket: "",
          region: "",
          accessKey: "",
          secretKey: ""
        }
      }
    };

    const configFile = path.join(process.cwd(), "backup-config.json");
    fs.writeFileSync(configFile, JSON.stringify(backupConfig, null, 2));
    console.log("  ✅ Created: backup-config.json");

    // Database config
    if (this.config.enableDatabase) {
      const dbConfig = {
        type: "json",
        databaseName: `${this.config.network}_transactions`,
        connectionString: "",
        collectionName: "transactions"
      };

      const dbConfigFile = path.join(process.cwd(), "database-config.json");
      fs.writeFileSync(dbConfigFile, JSON.stringify(dbConfig, null, 2));
      console.log("  ✅ Created: database-config.json");
    }
  }

  private async createEnvironmentFiles(): Promise<void> {
    console.log("🔐 Creating environment files...");
    
    const envExample = `# Olym3Chain Backup System Environment Variables

# Network Configuration
HARDHAT_NETWORK=${this.config.network}
CHAIN_ID=${this.config.chainId}

# Backup Configuration
BACKUP_INTERVAL=${this.config.backupInterval}
MAX_BACKUP_FILES=${this.config.maxBackupFiles}
ENABLE_AUTO_BACKUP=${this.config.enableAutoBackup}

# Database Configuration
ENABLE_DATABASE=${this.config.enableDatabase}
DATABASE_TYPE=json
DATABASE_NAME=${this.config.network}_transactions

# Recovery Configuration
ENABLE_RECOVERY=${this.config.enableRecovery}
RECOVERY_MODE=full

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/backup-monitor.log

# Notification Configuration (Optional)
ENABLE_NOTIFICATIONS=false
WEBHOOK_URL=
EMAIL_SMTP_HOST=
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=
EMAIL_PASSWORD=
EMAIL_TO=

# Cloud Storage Configuration (Optional)
ENABLE_CLOUD_STORAGE=false
CLOUD_PROVIDER=aws
CLOUD_BUCKET=
CLOUD_REGION=
CLOUD_ACCESS_KEY=
CLOUD_SECRET_KEY=
`;

    const envFile = path.join(process.cwd(), ".env.backup");
    fs.writeFileSync(envFile, envExample);
    console.log("  ✅ Created: .env.backup");
  }

  private async initializeDatabase(): Promise<void> {
    console.log("🗄️  Initializing database...");
    
    const dbDir = path.join(process.cwd(), "database", `${this.config.network}_transactions`);
    
    // Tạo file index trống
    const indexFile = path.join(dbDir, "index.json");
    const initialIndex = {
      totalTransactions: 0,
      totalBlocks: 0,
      uniqueAddresses: 0,
      lastUpdate: new Date().toISOString(),
      blockRange: { min: 0, max: 0 }
    };
    
    fs.writeFileSync(indexFile, JSON.stringify(initialIndex, null, 2));
    console.log("  ✅ Created: database index");
  }

  private async createStartupScripts(): Promise<void> {
    console.log("📜 Creating startup scripts...");
    
    // Windows batch script
    const windowsScript = `@echo off
echo Starting Olym3Chain Backup System...
echo.

REM Load environment variables
if exist .env.backup (
    for /f "delims=" %%i in (.env.backup) do set %%i
)

REM Start backup monitor
echo Starting backup monitor...
npm run monitor:start

pause
`;

    const windowsFile = path.join(process.cwd(), "start-backup-system.bat");
    fs.writeFileSync(windowsFile, windowsScript);
    console.log("  ✅ Created: start-backup-system.bat");

    // Linux/Mac shell script
    const shellScript = `#!/bin/bash
echo "Starting Olym3Chain Backup System..."
echo

# Load environment variables
if [ -f .env.backup ]; then
    export $(cat .env.backup | grep -v '^#' | xargs)
fi

# Start backup monitor
echo "Starting backup monitor..."
npm run monitor:start
`;

    const shellFile = path.join(process.cwd(), "start-backup-system.sh");
    fs.writeFileSync(shellFile, shellScript);
    
    // Make executable on Unix systems
    try {
      fs.chmodSync(shellFile, 0o755);
    } catch (error) {
      // Ignore chmod errors on Windows
    }
    
    console.log("  ✅ Created: start-backup-system.sh");
  }

  private async testSystem(): Promise<void> {
    console.log("🧪 Testing system...");
    
    try {
      // Test backup script
      console.log("  🔍 Testing backup script...");
      // Note: This would require a running network
      console.log("  ⚠️  Backup test skipped (requires running network)");
      
      // Test database
      if (this.config.enableDatabase) {
        console.log("  🔍 Testing database...");
        const dbDir = path.join(process.cwd(), "database", `${this.config.network}_transactions`);
        if (fs.existsSync(dbDir)) {
          console.log("  ✅ Database directory exists");
        }
      }
      
      // Test config files
      console.log("  🔍 Testing configuration files...");
      const configFile = path.join(process.cwd(), "backup-config.json");
      if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
        if (config.network === this.config.network) {
          console.log("  ✅ Configuration file is valid");
        }
      }
      
      console.log("  ✅ System test completed");
      
    } catch (error) {
      console.log("  ⚠️  System test failed:", error);
    }
  }

  private printUsageInstructions(): void {
    console.log("\n📖 Usage Instructions:");
    console.log("=" .repeat(50));
    console.log("1. Start backup monitor:");
    console.log("   npm run monitor:start");
    console.log("");
    console.log("2. Manual backup:");
    console.log("   npm run backup");
    console.log("");
    console.log("3. View backup status:");
    console.log("   npm run monitor:status");
    console.log("");
    console.log("4. Restore data:");
    console.log("   npm run restore:all");
    console.log("");
    console.log("5. Database operations:");
    console.log("   npm run db:stats");
    console.log("");
    console.log("6. Network recovery:");
    console.log("   npm run recovery:full");
    console.log("");
    console.log("📚 For detailed documentation, see: BACKUP_SYSTEM_README.md");
    console.log("");
    console.log("🚀 Quick start:");
    console.log("   Windows: start-backup-system.bat");
    console.log("   Linux/Mac: ./start-backup-system.sh");
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || "localhost";
  const chainId = 256000; // All networks now use Olym3 chain ID
  
  const config: SetupConfig = {
    network: network,
    chainId: chainId,
    enableAutoBackup: true,
    backupInterval: 5 * 60 * 1000, // 5 minutes
    maxBackupFiles: 100,
    enableDatabase: true,
    enableRecovery: true
  };

  const setup = new BackupSystemSetup(config);
  
  try {
    await setup.setup();
  } catch (error) {
    console.error("❌ Setup failed:", error);
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

export { BackupSystemSetup };
