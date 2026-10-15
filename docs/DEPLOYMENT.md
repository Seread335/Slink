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

## Sao lưu PostgreSQL và diễn tập phục hồi

Slink có công cụ sao lưu logic mã hóa để tạo tệp phục hồi độc lập; công cụ này không thay thế snapshot/PITR do nhà cung cấp PostgreSQL quản lý. Production cần cả chính sách backup gốc của nhà cung cấp lẫn một bản sao mã hóa ở vùng lưu trữ riêng, có quyền truy cập hạn chế và lịch giữ bản do người vận hành chọn.

### Tạo và xác minh bản sao

- Chạy công cụ trong một job vận hành riêng có Node.js, dependency production và `pg_dump` tương thích với PostgreSQL đích. Image ứng dụng Slink không cài `pg_dump`; không chạy lịch backup bên trong web container.
- Cấp `BACKUP_DATABASE_URL` từ secret manager cho một role riêng, không phải superuser, có quyền đọc mọi bảng và `BYPASSRLS`. Role cần quyền chỉ đọc; `row_security=off` khiến bản sao thất bại thay vì âm thầm bỏ sót hàng bị lọc bởi RLS.
- Cấp `SLINK_BACKUP_ENCRYPTION_KEY` (khóa ngẫu nhiên 32 byte, base64) và `SLINK_BACKUP_KEY_ID` từ secret manager. Giữ các phiên bản khóa cũ trong thời gian các bản sao cần chúng còn hiệu lực; không lưu khóa trong kho chứa backup hoặc repo.
- Đặt `SLINK_BACKUP_DIR` vào volume/object storage riêng đã mã hóa khi lưu và giới hạn quyền đọc. Mặc định cục bộ là `.local-data/backups`, đường dẫn này được Git bỏ qua nhưng vẫn chứa dữ liệu nhạy cảm.
- Đặt `PG_DUMP_BIN` nếu `pg_dump` không có trong `PATH`, sau đó chạy `pnpm db:backup`. Lệnh tạo custom archive bằng cách mã hóa AES-256-GCM khi đang truyền dữ liệu, ký manifest bằng HMAC-SHA-256 và ghi SHA-256, rồi công bố tên tệp sau khi hoàn tất. Không có plaintext archive trung gian được ghi ra đĩa.
- Xác minh mã hóa, chữ ký manifest và checksum bằng `pnpm db:backup:verify -- <đường-dẫn-manifest>`. Sao chép cả archive và manifest tới vùng lưu trữ riêng. Thông tin URL kết nối không nằm trong manifest hoặc dòng lệnh của `pg_dump`.

Không coi một job exit code 0 là bằng chứng phục hồi. Trước khi phát hành, dựng một PostgreSQL đích tạm riêng và tạo database mới từ `template0` để tránh các đối tượng cài thêm trong `template1`; cấp quyền `CREATE` trên database đích cho role restore và tạo trước các role được ACL trong archive tham chiếu, tối thiểu `slink_app`. Dùng endpoint đã xác minh TLS cho đích từ xa; không đặt `APP_DATABASE_URL` làm biến backup/restore. Tài liệu PostgreSQL cũng khuyến nghị `template0` khi nạp archive vào database mới để đảm bảo database ban đầu trống ([pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)).

### Phục hồi có kiểm soát

1. Chọn môi trường tách khỏi dữ liệu đang phục vụ và tạo database phục hồi mới từ `template0`; chuẩn bị sẵn các role được archive tham chiếu. Công cụ không tạo hoặc xóa database, không dùng `--clean`, kiểm tra database phải trống và nạp trong một transaction.
2. Cấp đúng khóa theo `SLINK_BACKUP_KEY_ID`, đặt `RESTORE_DATABASE_URL`, `SLINK_RESTORE_CONFIRM_DATABASE` bằng chính xác tên database đích, `SLINK_RESTORE_ALLOW_EMPTY_TARGET=YES`; nếu đích từ xa, đặt thêm `SLINK_RESTORE_ALLOW_REMOTE=YES` sau khi xác nhận đó là môi trường phục hồi cô lập. `PG_RESTORE_BIN` có thể chỉ rõ `pg_restore`.
3. Chạy `pnpm db:restore -- <đường-dẫn-manifest>`. Công cụ kiểm tra SHA-256 và thẻ xác thực GCM trước kết nối, từ chối PostgreSQL cũ hơn nguồn, từ chối đích có bảng/sequence/routine/schema/extension ứng dụng, và chỉ dùng `pg_restore --single-transaction --exit-on-error`.
4. Sau restore, chạy migration release job với `MIGRATION_DATABASE_URL`, kiểm tra `/api/ready`, đăng nhập tài khoản diễn tập, đối soát số lượng bản ghi và các ledger tổng hợp với thời điểm backup, rồi ghi lại thời gian phục hồi và lượng dữ liệu mất tối đa theo chính sách đã duyệt. Chỉ một người vận hành mới được quyết định chuyển traffic.

Các lệnh cần thiết:

```text
pnpm db:backup
pnpm db:backup:verify -- <đường-dẫn-manifest>
pnpm db:restore -- <đường-dẫn-manifest>
```

Không chạy restore vào database đang phục vụ. Chưa có endpoint sản xuất, secret manager, scheduler/retention, offsite storage hay đợt diễn tập restore nào được cấu hình trong workspace; các script/runbook này mới là phần chuẩn bị, không phải bằng chứng cổng phục hồi đã đạt.

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
