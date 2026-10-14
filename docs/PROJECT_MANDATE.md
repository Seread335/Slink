# Slink — chỉ dẫn liên tục cho người làm sản phẩm

> Đọc trang này trước mỗi phiên làm việc. Mục đích của nó là giữ nguyên mục tiêu của người dùng qua nhiều phiên, tránh biến một giao diện đẹp hoặc MVP thành lời tuyên bố sản phẩm đã xong.

## Mục tiêu không được thu nhỏ

Xây **Slink** thành sản phẩm quản lý bán hàng có thể giao cho cửa hàng và dùng cho kinh doanh thật, dùng được trên iOS và Android 10+; giữ giao diện và hướng thiết kế người dùng đã duyệt. “Hoàn thành” nghĩa là cửa hàng thật có thể thiết lập, nhập hoặc tạo dữ liệu, bán và hoàn hàng, quản lý kho/tiền/công nợ chính xác, dùng trên điện thoại, phục hồi dữ liệu và nhận hỗ trợ đáng tin cậy.

Giao diện demo, dữ liệu mẫu, mã nguồn có sẵn, API có mặt, cú pháp đúng hay một MVP hoạt động được một phần **không** chứng minh mục tiêu này đã đạt. Không gọi Slink là hoàn thiện hoặc sẵn sàng bán cho tới khi toàn bộ cổng trong [`BUILD_CHARTER.md`](BUILD_CHARTER.md) có bằng chứng phù hợp.

## Cách bắt đầu mỗi phiên

1. Đọc trang này, [`BUILD_CHARTER.md`](BUILD_CHARTER.md), [`DELIVERY_ROADMAP.md`](DELIVERY_ROADMAP.md), rồi [`PRODUCT.md`](PRODUCT.md) nếu sửa luồng nghiệp vụ. Xem [`README.md`](README.md) để hiểu vai trò các tài liệu.
2. Kiểm tra trạng thái workspace, mã nguồn, dịch vụ đang chạy và cấu hình hiện tại. Dùng bằng chứng hiện tại làm chuẩn; không dựa vào trí nhớ hoặc lời khẳng định trước đây.
3. Chọn việc kế tiếp từ lộ trình có tác động lớn nhất tới độ đúng của giao dịch, độ bền dữ liệu, quyền truy cập, khả năng dùng trên điện thoại hoặc khả năng vận hành. Không chọn việc chỉ dễ làm nếu nó giữ sản phẩm ở trạng thái demo.
4. Làm hết phần có thể hoàn thành trong workspace; nếu một phụ thuộc bên ngoài chặn một phần, tiếp tục các phần độc lập và ghi rõ chính xác điều gì đang thiếu.
5. Sau thay đổi, cập nhật lộ trình/tài liệu liên quan và kiểm tra bằng chứng đúng tầm với yêu cầu. Nếu chỉ kiểm tra tĩnh, phải ghi là kiểm tra tĩnh; không suy ra giao dịch hoặc nền tảng đã được nghiệm thu.

## Cách đánh giá một luồng kinh doanh

Một luồng chỉ được xem là hoạt động khi cùng có bằng chứng rằng:

- đúng thành viên, vai trò, cửa hàng và quyền được kiểm tra ở máy chủ;
- dữ liệu nhập được xác thực và quy tắc tiền VND, làm tròn, tồn, công nợ, thanh toán và trả hàng được xác định;
- mọi thay đổi liên quan được ghi nguyên tử vào chứng từ và sổ phù hợp; không bán âm kho, hoàn quá số lượng, thu/chi lặp hoặc sửa mất lịch sử;
- có mã chống gửi trùng, khóa/kiểm soát xung đột, người thực hiện, thời điểm và lý do cần thiết;
- lỗi, mất kết nối, gửi lại, tải lại trang và đổi thiết bị có trạng thái dễ hiểu, không báo thành công giả;
- số liệu báo cáo khớp với đơn, thanh toán, hoàn tiền, tồn kho và sổ quỹ;
- kiểm thử chấp nhận bao phủ luồng thuận lợi, biên, quyền bị từ chối, thử lại, đồng thời và sự cố;
- giao diện và thao tác được kiểm tra ở kích thước/thiết bị mục tiêu.

Mọi chức năng thanh toán, hóa đơn, vận chuyển, đồng bộ offline, backup/restore hoặc email chỉ được coi là đã tích hợp sau khi nhà cung cấp thật hoặc sandbox được cấu hình và luồng đầu-cuối thành công. Chọn “QR”, “chuyển khoản” hay “thẻ” không xác nhận tiền đã nhận.

## Nguyên tắc làm việc

- Bảo toàn giao diện đã duyệt; chỉ thay đổi để giúp hoàn thành công việc, dễ tiếp cận hoặc phù hợp nền tảng.
- Dữ liệu sản phẩm và giao dịch thật thuộc máy chủ; `localStorage`/dữ liệu seed không bao giờ thay thế nguồn dữ liệu đó.
- Tiền lưu dưới dạng số nguyên VND; kho, công nợ, trả hàng và tiền mặt phải có sổ truy vết.
- Không tạo nút giả, thông báo thành công giả, dữ liệu mẫu trong cửa hàng thật hay tính năng chỉ chạy trên một thiết bị nhưng được quảng bá là đồng bộ.
- Dùng nguồn chính thức và hiện hành cho hành vi nền tảng/nhà cung cấp; ghi nguồn và phân biệt sự kiện với suy luận.
- Không tự tạo bí mật, tài khoản, tài khoản ngân hàng, email, giấy tờ pháp lý, quyền truy cập, thiết bị thử nghiệm hoặc bằng chứng triển khai.
- Không chạy hay thêm kiểm thử khi chỉ thị cấp cao hơn cấm; trong mọi trường hợp không mô tả kiểm tra cú pháp như nghiệm thu sản phẩm.

## Khi nào được dừng để yêu cầu đầu vào

Không dừng chỉ vì công việc khó, rộng hoặc cần nhiều phiên. Chỉ yêu cầu người dùng cung cấp phần mà không thể lấy an toàn trong workspace, chẳng hạn thông tin truy cập cơ sở dữ liệu/hosting, tài khoản nhà cung cấp thật, email gửi thư, phê duyệt pháp lý, hoặc quyền sử dụng thiết bị thử nghiệm. Trước khi hỏi, hoàn tất phần độc lập; nêu tên chính xác phụ thuộc, vì sao cần và cổng nào nó mở. Không gửi dữ liệu hay thay đổi hệ thống bên ngoài khi chưa được ủy quyền.

## Nguồn trạng thái và mục đích từng tài liệu

- [`BUILD_CHARTER.md`](BUILD_CHARTER.md): nguồn chuẩn cho mục tiêu, định nghĩa hoàn thành và cổng giao khách.
- [`PRODUCT.md`](PRODUCT.md): hành vi mong muốn, luồng và hướng trải nghiệm.
- [`DELIVERY_ROADMAP.md`](DELIVERY_ROADMAP.md): nguồn chuẩn duy nhất cho hiện trạng đã chứng minh, thiếu sót, thứ tự việc và bằng chứng.
- [`BACKEND_SETUP.md`](BACKEND_SETUP.md): cách chạy và cấu hình phần máy chủ; không đồng nghĩa môi trường thật đã tồn tại.
- [`decisions/`](decisions/): quyết định kỹ thuật đã có căn cứ và điều kiện xem xét lại.
- [`README.md`](README.md): lối vào ngắn cho người phát triển/người dùng; không thay thế đặc tả hoặc bằng chứng.

Nếu một tài liệu cũ mâu thuẫn với mã nguồn hoặc môi trường hiện tại, kiểm tra mâu thuẫn, sửa tài liệu theo bằng chứng và giữ nguyên mục tiêu giao khách. Xem bản đồ tài liệu tại [`README.md`](README.md).
