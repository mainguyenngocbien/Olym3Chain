# Hệ Thống Backup và Khôi Phục Olym3Chain

Hệ thống backup hoàn chỉnh để lưu trữ và khôi phục nhật ký giao dịch khi mạng lưới ngưng chạy và khởi động lại.

## 🚀 Tính Năng Chính

- **Backup Tự Động**: Lưu trữ tất cả transaction logs
- **Khôi Phục Thông Minh**: Khôi phục dữ liệu theo nhiều chế độ
- **Monitor Real-time**: Theo dõi và backup tự động
- **Database Management**: Quản lý dữ liệu với index và search
- **Network Recovery**: Khôi phục toàn bộ mạng lưới

## 📁 Cấu Trúc Files

```
scripts/
├── backupTransactionLogs.ts    # Script backup chính
├── restoreTransactionLogs.ts   # Script khôi phục
├── autoBackupMonitor.ts        # Monitor tự động
├── databaseManager.ts          # Quản lý database
└── networkRecovery.ts          # Khôi phục mạng lưới

backups/                        # Thư mục backup
├── localhost/                  # Backup cho localhost
├── olym3Local/                 # Backup cho olym3Local
└── olym3Testnet/               # Backup cho olym3Testnet

database/                       # Database files
├── olym3_transactions/         # Database chính
└── recovery/                   # Recovery reports

logs/                          # Log files
└── backup-monitor.log         # Monitor logs

backup-config.json             # Cấu hình backup
```

## 🛠️ Cài Đặt và Sử Dụng

### 1. Backup Transaction Logs

```bash
# Backup tất cả transactions
npm run backup

# Backup từ block cụ thể
npm run backup:range 1000 2000

# Backup với arguments tùy chỉnh
hardhat run scripts/backupTransactionLogs.ts -- --from-block 1000 --to-block 2000
```

### 2. Khôi Phục Dữ Liệu

```bash
# Xem danh sách backup files
npm run restore:list

# Xem thống kê backup
npm run restore:stats

# Khôi phục từ tất cả backup files
npm run restore:all

# Khôi phục từ file cụ thể
npm run restore:file backup-1000-1234567890.json
```

### 3. Monitor Tự Động

```bash
# Khởi động monitor
npm run monitor:start

# Dừng monitor
npm run monitor:stop

# Xem trạng thái monitor
npm run monitor:status

# Backup ngay lập tức
npm run monitor:backup

# Xem cấu hình
npm run monitor:config
```

### 4. Quản Lý Database

```bash
# Xem thống kê database
npm run db:stats

# Export ra CSV
npm run db:export

# Tìm kiếm transactions
npm run db:search
```

### 5. Khôi Phục Mạng Lưới

```bash
# Khôi phục toàn bộ
npm run recovery:full

# Khôi phục theo range
npm run recovery:incremental 1000 2000

# Khôi phục theo addresses
npm run recovery:selective 0x123...,0x456...
```

## ⚙️ Cấu Hình

### File `backup-config.json`

```json
{
  "network": "localhost",
  "chainId": 256000,
  "backupInterval": 300000,
  "maxBackupAge": 604800000,
  "maxBackupFiles": 100,
  "enableAutoCleanup": true,
  "logLevel": "info"
}
```

### Các Tham Số Quan Trọng

- `backupInterval`: Khoảng thời gian backup (milliseconds)
- `maxBackupFiles`: Số lượng file backup tối đa
- `enableAutoCleanup`: Tự động xóa backup cũ
- `logLevel`: Mức độ log (debug, info, warn, error)

## 🔧 Sử Dụng Nâng Cao

### 1. Backup với Custom Range

```typescript
import { TransactionBackupManager } from "./scripts/backupTransactionLogs";

const backupManager = new TransactionBackupManager("localhost", 256000);
await backupManager.backupTransactions(1000, 2000);
```

### 2. Khôi Phục Selective

```typescript
import { NetworkRecoveryManager } from "./scripts/networkRecovery";

const recoveryManager = new NetworkRecoveryManager({
  network: "localhost",
  chainId: 256000,
  recoveryMode: "selective",
  targetAddresses: ["0x123...", "0x456..."],
  enableStateReconstruction: true
});

await recoveryManager.performRecovery();
```

### 3. Database Operations

```typescript
import { TransactionDatabaseManager } from "./scripts/databaseManager";

const dbManager = new TransactionDatabaseManager({
  type: "json",
  databaseName: "olym3_transactions"
});

// Tìm transactions theo address
const transactions = await dbManager.getTransactionsByAddress("0x123...");

// Tìm kiếm với điều kiện
const results = await dbManager.searchTransactions({
  from: "0x123...",
  blockRange: { from: 1000, to: 2000 }
});
```

## 📊 Monitoring và Logs

### Log Files

- `logs/backup-monitor.log`: Log của monitor
- `recovery/recovery-report.json`: Báo cáo khôi phục
- `recovery/validation-report.json`: Báo cáo validation

### Metrics

- Tổng số transactions đã backup
- Tổng số blocks đã xử lý
- Thời gian backup/restore
- Tỷ lệ thành công/thất bại

## 🚨 Xử Lý Lỗi

### Lỗi Thường Gặp

1. **Backup Directory Not Found**
   ```bash
   # Tạo thư mục backup
   mkdir -p backups/localhost
   ```

2. **Database Locked**
   ```bash
   # Dừng monitor trước khi thao tác
   npm run monitor:stop
   ```

3. **Insufficient Disk Space**
   ```bash
   # Xóa backup cũ
   npm run monitor:config
   # Giảm maxBackupFiles trong config
   ```

### Recovery Procedures

1. **Khôi phục từ backup gần nhất**
   ```bash
   npm run restore:all
   ```

2. **Khôi phục selective nếu cần**
   ```bash
   npm run recovery:selective 0x123...
   ```

3. **Validate dữ liệu**
   ```bash
   npm run db:stats
   ```

## 🔒 Bảo Mật

- Backup files được lưu trữ locally
- Có thể mã hóa backup files (tùy chọn)
- Private keys không được lưu trong backup
- Chỉ lưu transaction data, không lưu state

## 📈 Performance

- Backup 1000 transactions/block: ~2-3 giây
- Restore 10,000 transactions: ~5-10 giây
- Monitor overhead: <1% CPU
- Disk usage: ~1MB per 1000 transactions

## 🆘 Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra logs trong `logs/backup-monitor.log`
2. Xem recovery reports trong `recovery/`
3. Chạy `npm run monitor:status` để kiểm tra trạng thái
4. Kiểm tra disk space và permissions

## 📝 Changelog

- **v1.0.0**: Hệ thống backup cơ bản
- **v1.1.0**: Thêm auto monitor
- **v1.2.0**: Thêm database management
- **v1.3.0**: Thêm network recovery
- **v1.4.0**: Thêm selective recovery

---

**Lưu ý**: Hệ thống này được thiết kế cho mạng lưới Olym3Chain. Đảm bảo cấu hình đúng network và chainId trước khi sử dụng.
