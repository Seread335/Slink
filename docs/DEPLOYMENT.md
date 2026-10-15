# Slink — triển khai ứng dụng

Tài liệu này đóng gói đường chạy của ứng dụng thành container có thể đưa lên máy chủ Node tương thích Docker. Container không tạo database, không chạy migration khi khởi động và không bao gồm dữ liệu cửa hàng. Đây là nền triển khai lặp lại được; nó chưa phải một lần phát hành production đã nghiệm thu.

## Phiên bản và đầu ra

- Node.js được ghim tại `.nvmrc` và trong ảnh nền container để máy phát triển, CI và runtime dùng cùng nhánh LTS.
- pnpm được ghim bằng `packageManager` trong `package.json`.
- Ảnh runtime chạy bằng người dùng không phải root, chỉ mang dependency production và mã ứng dụng cần thiết.
- Docker health check gọi `/api/ready`; instance chỉ sẵn sàng khi API có thể truy cập database.
- `GET /api/health` chỉ kiểm tra tiến trình. Dùng `/api/ready` cho readiness của traffic.

## Điều kiện bắt buộc của môi trường

1. Một máy chủ hỗ trợ container Node.js, HTTPS và inject secrets từ kho bí mật của nền tảng.
2. PostgreSQL được quản lý, có TLS được xác minh, mạng truy cập giới hạn, và hai thông tin kết nối riêng: `MIGRATION_DATABASE_URL` cho release job và `APP_DATABASE_URL` cho ứng dụng. Không chạy API bằng role migration hoặc superuser.
3. `PUBLIC_ORIGIN` là origin HTTPS thật. `EMAIL_DELIVERY_URL` là endpoint HTTPS nhận JSON `{ "to", "subject", "text" }`; `EMAIL_DELIVERY_TOKEN` là bearer secret tối thiểu 32 ký tự. Chưa có provider email thật được chọn hoặc nghiệm thu.
4. `TRUSTED_PROXY_IPS` chỉ chứa địa chỉ proxy thực tế nếu ứng dụng cần header proxy; nếu chưa biết IP/CIDR thì để trống.
5. Có chính sách sao lưu PostgreSQL và một lần phục hồi vào database tách biệt đã được diễn tập. Bản xuất CSV của Slink không thay thế backup.

Các giá trị bí mật phải được nhập từ secret manager của nơi triển khai; không tạo `.env` production trong repo hoặc đưa secret vào build argument, image, log hay workflow.

## Tạo ảnh và chạy migration

Tạo ảnh từ root của repo:

```text
docker build --pull --tag slink:<release> .
```

Đẩy ảnh lên registry riêng của môi trường đã được chọn. Trước khi khởi động phiên bản ứng dụng mới, chạy một release job một lần bằng đúng ảnh đó và chỉ cấp cho job các biến `NODE_ENV=production`, `PG_SSL=true`, `MIGRATION_DATABASE_URL`:

```text
node server/migrate.js
```

Sau khi migration thành công, khởi chạy container ứng dụng với `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT`, `PG_SSL=true`, `APP_DATABASE_URL`, `PUBLIC_ORIGIN`, `EMAIL_DELIVERY_URL`, `EMAIL_DELIVERY_TOKEN`, và các cấu hình pool/proxy đã xác minh. Không cấp `MIGRATION_DATABASE_URL` cho tiến trình web nếu nền tảng hỗ trợ tách secrets theo job.

Nền tảng cần gửi traffic tới cổng `PORT`, dùng `/api/ready` làm readiness check, giữ instance phục vụ khi health check tạm lỗi theo chính sách của nền tảng, và chấm dứt TLS tại ingress tin cậy. Mở địa chỉ HTTPS sau triển khai và xác nhận `/api/ready` trả `{"status":"ready"}` trước khi tiếp tục nghiệm thu.

## Phát hành, khôi phục và rollback

- Chỉ chạy migration sau khi backup gần nhất thành công; lưu mã ảnh và đầu ra migration cùng release.
- Chạy migration trước khi thay phiên bản ứng dụng. Mỗi migration phải tương thích phiên bản ứng dụng đang chạy trong giai đoạn rollout; không phát hành thay đổi schema phá hủy khi chưa có quy trình chuyển đổi và phục hồi.
- Chuyển traffic sang phiên bản mới sau khi health check và kiểm tra đăng nhập/đọc dữ liệu đạt.
- Nếu ứng dụng lỗi, chuyển lại ảnh ứng dụng đã biết tốt. Không tự động khôi phục database hoặc xóa migration đã chạy; thực hiện restore theo runbook đã được diễn tập và chỉ khi đã xác định phạm vi mất dữ liệu.
- Ghi lại người trực vận hành, cách xem log/monitoring, thời gian phản hồi, quy trình thông báo khách hàng và kênh hỗ trợ trước khi mở cho cửa hàng.

## Trạng thái hiện tại

Ảnh container và bước build CI đã được thêm vào repo, nhưng chưa thể nghiệm thu build Docker tại workspace này vì Docker engine chưa được cài/khả dụng. Chưa có hosting, registry, miền HTTPS, PostgreSQL production, email provider, monitoring hoặc backup/restore được cấp và cấu hình. Không đưa dữ liệu cửa hàng thật vào môi trường này cho tới khi các mục đó và cổng trong [`DELIVERY_ROADMAP.md`](DELIVERY_ROADMAP.md) có bằng chứng.
