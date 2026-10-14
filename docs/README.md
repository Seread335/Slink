# Slink — bản đồ tài liệu dự án

Mục đích của thư mục này là giữ hướng sản phẩm, quyết định, bằng chứng và việc tiếp theo qua mọi phiên làm việc. Đọc [`PROJECT_MANDATE.md`](PROJECT_MANDATE.md) trước; đọc tài liệu chuyên môn tương ứng trước khi đổi mã.

## Thứ tự đọc bắt buộc

1. [`PROJECT_MANDATE.md`](PROJECT_MANDATE.md) — mục tiêu không được thu nhỏ, cách chọn việc, quy tắc làm và tiêu chuẩn bằng chứng.
2. [`BUILD_CHARTER.md`](BUILD_CHARTER.md) — định nghĩa sản phẩm hoàn chỉnh và các cổng bắt buộc trước khi giao khách.
3. [`DELIVERY_ROADMAP.md`](DELIVERY_ROADMAP.md) — hiện trạng đã kiểm chứng, thiếu sót, ưu tiên kế tiếp và phụ thuộc bên ngoài.
4. [`PRODUCT.md`](PRODUCT.md) — luồng nghiệp vụ, hành vi giao diện và nghiên cứu sản phẩm; bắt buộc trước khi đổi nghiệp vụ.
5. [`BACKEND_SETUP.md`](BACKEND_SETUP.md) — cách chạy API, cơ sở dữ liệu và giới hạn triển khai.
6. [`decisions/`](decisions/) — lý do của các quyết định kiến trúc đã ghi nhận.

## Mỗi tài liệu tồn tại để làm gì

| Tài liệu | Mục đích | Khi nào cập nhật |
| --- | --- | --- |
| `PROJECT_MANDATE.md` | Giữ nguyên mục tiêu khách hàng thật, cách làm và hàng rào chống gọi nhầm demo là sản phẩm | Khi người dùng đổi mục tiêu hoặc thay đổi quy tắc làm việc đã được họ xác nhận |
| `BUILD_CHARTER.md` | Định nghĩa “hoàn thành” và mọi năng lực/cổng giao khách | Chỉ khi người dùng đổi phạm vi hoặc có bằng chứng làm thay đổi yêu cầu |
| `PRODUCT.md` | Mô tả cách từng luồng phải hoạt động và nguyên tắc giao diện | Khi thêm/đổi luồng nghiệp vụ hoặc có nghiên cứu đáng tin làm đổi quyết định |
| `DELIVERY_ROADMAP.md` | Nhật ký bằng chứng, trạng thái, rủi ro, ưu tiên và phụ thuộc | Sau mỗi thay đổi làm đổi hiện trạng; không nâng trạng thái nếu thiếu bằng chứng |
| `BACKEND_SETUP.md` | Hướng dẫn thiết lập và ranh giới triển khai | Khi đổi runtime, cấu hình, migration, dịch vụ email hoặc cách triển khai |
| `decisions/*.md` | Lưu lựa chọn kiến trúc, căn cứ, đánh đổi và điều kiện xem xét lại | Khi một quyết định quan trọng được chốt hoặc cần thay thế |

Tài liệu trong thư mục này hỗ trợ công việc; bằng chứng thực tế trong mã nguồn, môi trường chạy, thiết bị và hồ sơ nghiệm thu mới quyết định trạng thái.
