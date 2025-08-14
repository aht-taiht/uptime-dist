# Hướng dẫn Upgrade Database - Monthly Uptime Feature

## Tổng quan
Tính năng Monthly Uptime cho phép tính toán và lưu trữ phần trăm uptime theo tháng, cải thiện hiệu suất hiển thị dashboard thay vì tính toán real-time từ heartbeat data.

## Các thay đổi Database

### 1. Bảng mới: `monthly_uptime`
```sql
CREATE TABLE monthly_uptime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    year_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    total_heartbeats INTEGER NOT NULL DEFAULT 0,
    successful_heartbeats INTEGER NOT NULL DEFAULT 0,
    uptime_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitor(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(monitor_id, year_month)
);
```

### 2. Indexes cho hiệu suất
```sql
CREATE INDEX idx_monthly_uptime_monitor_id ON monthly_uptime(monitor_id);
CREATE INDEX idx_monthly_uptime_year_month ON monthly_uptime(year_month);
CREATE INDEX idx_monthly_uptime_monitor_month ON monthly_uptime(monitor_id, year_month);
```

## Quy trình Upgrade

### Bước 1: Backup Database
```bash
# Backup database hiện tại
cp data/kuma.db data/kuma.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Bước 2: Áp dụng Database Patch
Database patch sẽ được tự động áp dụng khi khởi động server:
- File patch: `db/patch-monthly-uptime-table.sql`
- Patch được thêm vào `server/database.js` trong `patchList`

### Bước 3: Khởi động Server
```bash
npm run start-server-dev
```
Server sẽ tự động:
- Phát hiện patch mới
- Tạo bảng `monthly_uptime` và indexes
- Cập nhật `databasePatchedFiles` setting

### Bước 4: Populate dữ liệu ban đầu (Tùy chọn)
Nếu có dữ liệu heartbeat cũ, chạy script populate:
```bash
sqlite3 data/kuma.db < db/populate-monthly-uptime.sql
```

Hoặc sử dụng script tùy chỉnh:
```sql
INSERT OR REPLACE INTO monthly_uptime (monitor_id, year_month, total_heartbeats, successful_heartbeats, uptime_percentage, created_date, updated_date)
SELECT 
    h.monitor_id,
    strftime('%Y-%m', h.time) as year_month,
    COUNT(*) as total_heartbeats,
    SUM(CASE WHEN h.status = 1 THEN 1 ELSE 0 END) as successful_heartbeats,
    ROUND(SUM(CASE WHEN h.status = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as uptime_percentage,
    MIN(h.time) as created_date,
    MAX(h.time) as updated_date
FROM heartbeat h
JOIN monitor m ON h.monitor_id = m.id
WHERE m.active = 1
GROUP BY h.monitor_id, strftime('%Y-%m', h.time)
ORDER BY h.monitor_id, year_month;
```

## Kiểm tra Upgrade

### 1. Kiểm tra bảng được tạo
```bash
sqlite3 data/kuma.db "SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_uptime';"
```

### 2. Kiểm tra cấu trúc bảng
```bash
sqlite3 data/kuma.db "PRAGMA table_info(monthly_uptime);"
```

### 3. Kiểm tra indexes
```bash
sqlite3 data/kuma.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='monthly_uptime';"
```

### 4. Kiểm tra dữ liệu mẫu
```bash
sqlite3 data/kuma.db "SELECT COUNT(*) FROM monthly_uptime;"
```

### 5. Test API endpoint
Sau khi server chạy, test API bằng cách kiểm tra dashboard hoặc gọi trực tiếp:
```javascript
// Trong browser console hoặc Node.js
socket.emit("getMonthlyUptimeData", (response) => {
    console.log(response);
});
```

## Cách hoạt động

### 1. Tự động cập nhật
- Mỗi khi có heartbeat mới được tạo, system sẽ tự động cập nhật `monthly_uptime`
- Sử dụng `UpdateMonthlyUptimeJob.updateCurrentMonthUptime()` trong `server/model/monitor.js`

### 2. API Endpoint
- Endpoint: `getMonthlyUptimeData`
- Handler: `server/socket-handlers/general-socket-handler.js`
- Trả về dữ liệu 12 tháng gần nhất cho dashboard

### 3. Frontend Integration
- File: `src/pages/DashboardHome.vue`
- Function: `loadMonthlyUptimeData()` và `monitorUptimeData()` computed
- Fallback to real-time calculation nếu không có dữ liệu

## Rollback (nếu cần)

### Bước 1: Stop Server
```bash
# Stop server process
```

### Bước 2: Restore Database
```bash
cp data/kuma.db.backup.YYYYMMDD_HHMMSS data/kuma.db
```

### Bước 3: Remove Code Changes
```bash
git checkout HEAD -- server/model/monitor.js
git checkout HEAD -- server/socket-handlers/general-socket-handler.js
git checkout HEAD -- src/pages/DashboardHome.vue
git checkout HEAD -- server/database.js
rm db/patch-monthly-uptime-table.sql
rm db/populate-monthly-uptime.sql
rm server/jobs/update-monthly-uptime.js
```

## Lưu ý quan trọng

### Performance
- Bảng `monthly_uptime` sẽ có ít records hơn nhiều so với `heartbeat`
- Indexes được tối ưu cho các query dashboard
- Giảm tải tính toán real-time

### Data Consistency
- Foreign key constraint đảm bảo tính toàn vẹn dữ liệu
- Tự động xóa records khi monitor bị xóa
- Unique constraint ngăn duplicate records

### Maintenance
- Có thể chạy periodic job để verify/rebuild data
- Log errors nếu update monthly uptime fails
- Fallback mechanism đảm bảo dashboard luôn hiển thị được

## Support

Nếu gặp vấn đề trong quá trình upgrade:
1. Kiểm tra server logs
2. Verify database structure
3. Test với một monitor đơn giản trước
4. Backup trước khi thực hiện bất kỳ thay đổi nào