# Slink — Quản lý bán hàng

Slink là ứng dụng bán lẻ ưu tiên điện thoại, giao diện tiếng Việt và tiền tệ VND. Mục tiêu là giúp cửa hàng quản lý sản phẩm, bán hàng, tồn kho, khách hàng, công nợ và dòng tiền trong một nơi.

> **Trạng thái: đang phát triển, chưa sẵn sàng cho giao dịch thật.** PWA hiện gọi API và các luồng bán hàng, trả hàng, nhập hàng, công nợ, tồn kho, báo cáo và hồ sơ cửa hàng đã có trong mã nguồn. Chúng chưa được nghiệm thu với PostgreSQL triển khai, iPhone hoặc Android 10+. Không dùng dữ liệu khách hàng thật cho đến khi các cổng phát hành trong [`docs/DELIVERY_ROADMAP.md`](docs/DELIVERY_ROADMAP.md) được đóng.

## Chức năng đã có trong mã nguồn

- Tài khoản, xác nhận email, đăng nhập, đăng xuất, khôi phục mật khẩu và phiên đăng nhập trên máy chủ.
- Tìm mặt hàng theo tên, SKU hoặc mã vạch; bán hàng với tối đa năm phương thức thanh toán, tính tiền thối và cập nhật tồn kho/công nợ trong một giao dịch.
- Danh sách đơn hàng, xem chi tiết, hủy đơn chưa thu tiền có lý do, trả hàng một phần, quản lý khách, thu nợ và hồ sơ cửa hàng.
- Kiểm kê, nhập hàng, giá vốn, công nợ nhà cung cấp, thanh toán nhà cung cấp, sổ thu chi, báo cáo và xuất CSV có phân quyền từ máy chủ.
- Giao diện responsive và vỏ PWA có thể thêm vào màn hình chính khi được phục vụ qua HTTPS.

Các luồng này cần kiểm tra nghiệp vụ, dữ liệu và quyền truy cập trước khi dùng thật. Thanh toán QR, chuyển khoản và thẻ hiện do nhân viên xác nhận; chưa có kết nối ngân hàng. Hóa đơn điện tử, nhân viên, nhập dữ liệu an toàn, sao lưu/khôi phục, hoạt động khi mất mạng và hỗ trợ vận hành vẫn đang thiếu.

## Chạy Slink trên máy phát triển

Cần Node.js 24.22 trở lên và pnpm 11.25.0. Tệp `.nvmrc` ghim Node 24.22.0 cho máy phát triển, CI và ảnh triển khai. Chạy `pnpm install`, sau đó `pnpm dev` và mở `http://127.0.0.1:3000`. Lệnh này khởi động giao diện, API và PostgreSQL nhúng PGlite; không cần cài dịch vụ PostgreSQL riêng. Dữ liệu được lưu tại `.local-data/pglite`, tồn tại sau khi đóng và mở lại ứng dụng. Không có dữ liệu bán hàng mẫu được nạp vào tài khoản.

Tạo tài khoản trên trang đăng ký. Trong chế độ phát triển, API trả liên kết xác nhận email để mở trực tiếp; email thật chưa được gửi. Có thể đặt `PORT`, `HOST`, `PUBLIC_ORIGIN` hoặc `SLINK_LOCAL_DATA_DIR` trong `.env` để đổi cổng, địa chỉ nghe, địa chỉ truy cập hoặc nơi lưu database. Nếu truy cập từ điện thoại cùng mạng, đặt `HOST=0.0.0.0` và `PUBLIC_ORIGIN` thành địa chỉ LAN của máy chạy Slink; cần HTTPS để kiểm tra cài PWA đúng như môi trường thực tế.

PGlite là runtime phát triển trên một máy, không phải database production hay hệ thống nhiều máy. Nó không thay thế kiểm tra PostgreSQL native, role-grant và vận hành cloud. Khi đã có PostgreSQL cùng hai vai trò riêng, chạy `pnpm db:migrate` rồi `pnpm start`; đây là đường chạy PostgreSQL của server. `pnpm dev:watch` bật chế độ theo dõi mã nguồn và dùng cùng database PGlite cục bộ.

`node tools/serve.js` chỉ mở bản xem giao diện tại `http://127.0.0.1:4173`; bản xem này **không** có API hay lưu giao dịch. Không dùng nó làm máy chủ cho cửa hàng.

Chi tiết thiết lập vai trò và dịch vụ email xem tại [`docs/BACKEND_SETUP.md`](docs/BACKEND_SETUP.md). Quy trình tạo ảnh container và cổng triển khai ghi tại [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); trạng thái tích hợp thương mại xem tại [`docs/COMMERCIAL_READINESS.md`](docs/COMMERCIAL_READINESS.md). Không đưa bí mật vào mã nguồn hoặc commit tệp `.env`.

## iPhone và Android

Slink hiện là PWA, không phải ứng dụng đã phát hành trên App Store hoặc Google Play. Khi có máy chủ HTTPS, người dùng có thể thêm web app vào màn hình chính qua Safari trên iPhone hoặc Chrome trên Android. Hướng dẫn cài web app phụ thuộc vào trình duyệt và phiên bản hệ điều hành ([Apple Support](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27), [Chrome for Developers](https://developer.chrome.com/blog/how_chrome_helps_users_install_the_apps_they_value)). Chưa có kiểm tra trên iOS hoặc Android 10+ thật, và các giao dịch cần máy chủ không làm việc ngoại tuyến.

## Phạm vi và kế hoạch

Đặc tả sản phẩm và nghiên cứu tham khảo nằm trong [`docs/PRODUCT.md`](docs/PRODUCT.md). Trạng thái hiện tại, bằng chứng kiểm tra và các phụ thuộc chưa có được ghi trong [`docs/DELIVERY_ROADMAP.md`](docs/DELIVERY_ROADMAP.md). Hoàn tất mã nguồn không thay thế được triển khai cơ sở dữ liệu, email, thiết bị thử nghiệm, bảo mật, sao lưu/khôi phục, tích hợp thanh toán/hóa đơn và nghiệm thu với cửa hàng thật.
