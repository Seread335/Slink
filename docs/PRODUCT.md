# Định hướng sản phẩm Slink

> Đây là đặc tả **sản phẩm đích**, không phải mô tả tất cả những gì mã hiện tại đã hoàn thành. Đối chiếu trạng thái thực hiện ở [`DELIVERY_ROADMAP.md`](DELIVERY_ROADMAP.md) và tiêu chí giao khách ở [`BUILD_CHARTER.md`](BUILD_CHARTER.md).

## Định vị

Trợ lý vận hành cho cửa hàng bán lẻ nhỏ: bán nhanh, biết chính xác còn bao nhiêu hàng, nhớ khách và xem tiền lời trong ngày. Người dùng chính là chủ cửa hàng/thu ngân thao tác trên điện thoại; máy tính là màn hình quản lý rộng hơn.

## Điều hướng

| Khu vực | Việc chính | Kết quả mong muốn |
| --- | --- | --- |
| Tổng quan | Xem doanh thu, số đơn, lãi gộp, hàng sắp hết, việc vừa làm | Biết cửa hàng đang vận hành thế nào trong vài giây |
| Bán hàng | Tìm hoặc quét mặt hàng, thêm giỏ, gắn khách, giảm giá, thu tiền | Hoàn tất đơn tại quầy nhanh, tồn và công nợ cập nhật cùng lúc |
| Sản phẩm | Tạo SKU, giá bán/giá vốn, đơn vị, mức cảnh báo | Tìm được hàng và thấy biên lợi nhuận cơ bản |
| Đơn hàng | Tìm theo mã, xem thanh toán, nhận trả hàng | Truy vết được việc đã bán và xử lý sai sót |
| Khách hàng | Hồ sơ, lịch sử mua, điểm và dư nợ | Chăm sóc khách cũ và theo dõi khoản còn thiếu |
| Kho | Nhập, điều chỉnh, theo dõi nhật ký thay đổi | Biết lý do và số lượng sau mỗi biến động |
| Tài chính | Mở/chốt ca, thu/chi, dòng tiền, nợ phải thu | Đối soát được tiền mặt và khoản còn lại |
| Báo cáo | Doanh thu, lãi gộp ước tính, top sản phẩm | Hỗ trợ quyết định nhập hàng và ưu đãi |
| Nhân viên | Mời thành viên, gán vai trò, tạm khóa hoặc mở lại quyền | Chủ cửa hàng kiểm soát ai được truy cập cửa hàng |

## Luồng nghiệp vụ cốt lõi

0. **Khởi tạo cửa hàng:** nhập danh mục và tồn đầu kỳ từ CSV; khi tạo khách hàng/nhà cung cấp, ghi số dư cũ thành bút toán mở đầu có người thao tác, thời điểm, nguồn và mã chống gửi trùng. Dư nợ khách làm tăng phải thu; khoản nợ nhà cung cấp làm tăng phải trả. Đây không phải tiền thu/chi và không được tạo dòng trong sổ quỹ. Chỉ chủ cửa hàng, quản lý hoặc kế toán được ghi số dư mở đầu. Nếu tên nhà cung cấp đã tồn tại, dùng lại hồ sơ đó và cộng khoản phải trả đã khai báo; giao diện báo trước quy tắc này. Số dư khách hàng và nhà cung cấp đã được chấp nhận qua API trên PGlite tạm; luồng nhập CSV và giao diện cửa hàng thật vẫn cần kiểm tra tiếp.
1. **Bán hàng:** chọn hàng và số lượng → gắn khách/chiết khấu → nhập tối đa năm khoản thu theo phương thức → kiểm tra tiền đã thu, còn nợ và tiền thối → xác nhận → ghi từng khoản thanh toán, trừ tồn, cập nhật khách và sổ quỹ trong cùng giao dịch. Chỉ tiền mặt được nhận dư để thối; nếu thu thiếu cần gắn khách hàng để ghi công nợ. Đơn chưa thu tiền có thể được chủ cửa hàng/quản lý hủy kèm lý do; hàng và công nợ được đảo bằng bút toán, còn đơn đã thu tiền phải qua quy trình trả hàng/hoàn tiền. Chuyển khoản, QR và thẻ vẫn do nhân viên tự xác nhận vì chưa có xử lý ngân hàng thật. Trên PGlite cục bộ đã xác minh thanh toán tách tiền mặt/chuyển khoản, gửi lại chống trùng, từ chối tổng không tiền mặt vượt đơn, cùng luồng hủy đơn ghi nợ có xác nhận và đảo kho/công nợ một lần; PostgreSQL thật và thiết bị vẫn chưa được nghiệm thu.
2. **Trả hàng:** tìm đơn → hoàn một phần/toàn phần theo dòng hàng → chọn xử lý tồn kho → ghi hoàn tiền, cập nhật trạng thái đơn và sổ khách/quỹ. Luồng trả một phần, hoàn tiền mặt và nhập lại kho đã chạy trên PGlite cục bộ; các biên số lượng, phương thức khác và đối soát PostgreSQL vẫn cần nghiệm thu.
3. **Nhập kho:** tìm sản phẩm, chọn nhà cung cấp, số lượng và giá nhập → tăng tồn, cập nhật giá vốn theo mặt hàng → ghi phiếu nhập và khoản phải trả nếu chưa thanh toán. Trên PGlite cục bộ, đã nhận một phiếu chưa trả 30.000 VND rồi thanh toán nhà cung cấp 10.000 VND, còn phải trả 20.000 VND; cần lặp lại trên PostgreSQL thật và kiểm tra biên.
4. **Kiểm kê:** nhập số đếm thực tế → chọn lý do → ghi chênh lệch và người thao tác vào sổ kho.
5. **Đối soát ca tiền mặt:** chủ cửa hàng, quản lý hoặc thu ngân mở một ca cho quầy bằng số tiền đầu ca đã đếm. Mọi giao dịch tiền mặt phải gắn với ca đang mở; chuyển khoản, QR và các khoản không phải tiền mặt không làm thay đổi tiền dự kiến trong quầy. Khi chốt ca, người thao tác nhập số tiền thực đếm; chênh lệch bắt buộc có lý do và được ghi thành bút toán cùng sự kiện kiểm toán. Chỉ một ca được mở cho mỗi cửa hàng; các giao dịch tiền mặt khóa cùng ca để thao tác chốt không bỏ sót giao dịch đang chạy. API và sổ cái đã được chấp nhận trên PGlite dùng một lần, bao gồm bán hàng có tiền thối, trả tiền mặt, thu nợ, trả nhà cung cấp, nhập hàng có thanh toán, chênh lệch, gửi lại và rollback khi audit lỗi. PostgreSQL thật, đồng thời giữa thiết bị và giao diện trên trình duyệt vẫn cần nghiệm thu.
6. **Xuất và khôi phục dữ liệu:** từ các màn hình danh mục, đơn hàng, khách hàng, kho và tài chính, chủ cửa hàng có thể chọn bộ dữ liệu để tải CSV từ máy chủ. Tệp giữ nguyên số VND nguyên, hỗ trợ chia theo ngày địa phương của cửa hàng và báo lỗi rõ nếu quá 50.000 dòng; bản xuất sản phẩm đã được tải và xác minh BOM UTF-8 trên PGlite cục bộ, các bộ khác vẫn cần nghiệm thu trên PostgreSQL và điện thoại. Xuất CSV không thay thế backup/restore: quy trình sao lưu và khôi phục có kiểm soát ở máy chủ vẫn phải được xây dựng và diễn tập trước khi dùng thật. Ứng dụng không cung cấp sao lưu/khôi phục JSON trên trình duyệt.
7. **Quản lý nhân viên:** chủ cửa hàng mời bằng email và chọn quản lý, thu ngân, nhân viên kho hoặc kế toán. Lời mời có thời hạn 7 ngày; người nhận tạo tài khoản hoặc đăng nhập bằng đúng email, xác minh email rồi mới có thành viên hoạt động. Chủ cửa hàng có thể gửi lại/thu hồi lời mời, đổi vai trò hoặc tạm khóa thành viên; quyền chủ cửa hàng không thể cấp qua lời mời hay đổi tại màn hình này. Mọi thay đổi được ghi vào nhật ký cửa hàng. Luồng này đã chạy trên cơ sở PGlite dùng một lần; gửi email thật và PostgreSQL thật vẫn cần nghiệm thu.

### Ranh giới quyền xem tài chính

- Chủ cửa hàng, quản lý và kế toán xem đầy đủ sổ quỹ, công nợ, số liệu tài chính, lịch sử ca và báo cáo.
- Thu ngân xem tiền mặt của ca đang mở và các ca do mình mở; chỉ người mở ca hoặc chủ cửa hàng/quản lý mới có thể chốt. Thu ngân không xem công nợ nhà cung cấp hay báo cáo lãi/doanh thu tổng hợp.
- Nhân viên kho xem tên nhà cung cấp và phiếu nhập để nhận hàng, nhưng không xem hồ sơ khách, đơn hàng, sổ quỹ, số dư phải trả, công nợ khách hoặc báo cáo tài chính.
- Thu ngân không cần xem giá vốn để bán; giá vốn trong danh mục, tồn kho, giá trị tồn theo giá vốn và chi tiết đơn được giữ khỏi API trả về cho thu ngân.
- Trang tài chính hiển thị người ghi nhận và ca liên quan cho từng dòng sổ quỹ; lịch sử ca gần đây kèm tiền đầu ca, thu/chi, số dự kiến, số đã đếm, chênh lệch và lý do. Mã VND trong sổ quỹ được định dạng từ chuỗi số nguyên để tránh làm tròn qua kiểu số thực của JavaScript.
- Ma trận API trên PGlite đã được nghiệm thu cho bốn vai trò: thu ngân chỉ xem ca hiện tại, không nhận số dư nhà cung cấp/công nợ/báo cáo, không thấy giá vốn và bị từ chối thao tác tài chính nhạy cảm; quản lý/kế toán xem đầy đủ dữ liệu tài chính; nhân viên kho xem tên nhà cung cấp và phiếu nhập nhưng không truy cập khách hàng, đơn hàng hay báo cáo tài chính. Giao diện theo từng vai trò, PostgreSQL thật và chạy đồng thời vẫn cần nghiệm thu.

## Nguyên tắc giao diện

- Mobile first; thanh điều hướng dưới cùng chỉ giữ các khu vực dùng thường xuyên.
- Nút thao tác chính lớn, có nhãn; trạng thái kho/công nợ dùng chữ đi kèm màu.
- Không tạo đơn khi giỏ trống; xác nhận rõ số tiền thu và phần còn nợ.
- Giá luôn hiển thị theo VND; lãi gộp được ghi là ước tính từ giá vốn đã nhập.
- Cửa hàng khách bắt đầu với danh mục rỗng trên máy chủ; không dùng dữ liệu mẫu để khởi tạo tài khoản đã kết nối. Không còn luồng tạo dữ liệu mẫu hoặc khôi phục JSON cục bộ trong ứng dụng.

## Cơ sở tham khảo sản phẩm

Các luồng ưu tiên những khả năng quen thuộc của phần mềm bán lẻ: hồ sơ khách có thông tin liên hệ và lịch sử mua ([Shopify — quản lý khách hàng](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/customer-management)); phiếu mua hàng giữ lại sản phẩm, số lượng, giá, nhà cung cấp và điều khoản thanh toán ([Shopify — phiếu đặt hàng](https://help.shopify.com/en/manual/inventory-and-locations/purchase-orders/creating-purchase-orders)); hồ sơ nhà cung cấp với mã hàng và quy trình nhận hàng ([Square — quản lý nhà cung cấp](https://squareup.com/help/us/en/article/5958-vendor-management)); cùng giới hạn được công bố rõ khi POS mất mạng ([Shopify — tính năng ngoại tuyến](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)). Slink đã có hồ sơ khách, phiếu nhập và chi tiết hàng nhận, thanh toán công nợ nhà cung cấp, cùng giao dịch trực tuyến có thể gửi lại an toàn; chưa có giao dịch ngoại tuyến bền vững hoặc xử lý xung đột giữa nhiều thiết bị.

### Nghiên cứu tính năng và cách trình bày

Các trang sản phẩm KiotViet liệt kê tồn kho/thẻ kho, nhập và kiểm hàng, chuyển/hủy hàng, công nợ và thanh toán nhà cung cấp, phiếu thu chi, báo cáo theo hàng/khách/nhân viên, và thiết bị quầy như máy quét/máy in ([KiotViet — tính năng quản lý bán lẻ](https://global.kiotviet.vn/)). Đây là danh mục tham khảo, không phải lý do để đưa mọi chức năng vào lần phát hành đầu. Slink ưu tiên một chuỗi dễ hiểu trên điện thoại: **bán hàng → tồn kho/công nợ cập nhật → tìm lại đơn → trả hàng hoặc thu nợ → đối chiếu thu chi và báo cáo**. Các thao tác có tác động tài chính cần nêu số tiền, phương thức và phần còn nợ trước khi xác nhận; tình trạng thanh toán cần phân biệt rõ xác nhận thủ công với giao dịch đã được nhà cung cấp thanh toán xác nhận.

Hướng dẫn Shopify ghi rõ một số thao tác không khả dụng khi mất mạng, như tìm/tạo khách, trả hàng/void và đồng bộ đơn/tồn; hãng cũng cảnh báo giữ ứng dụng và thiết bị hoạt động để tránh mất đơn đang chờ đồng bộ ([Shopify — hành vi POS ngoại tuyến](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)). Vì vậy Slink hiện chỉ mở lại vỏ giao diện offline và khóa hành động cần máy chủ; trước khi tuyên bố bán offline phải có hàng đợi lưu bền, mã giao dịch chống trùng, trạng thái chờ đồng bộ và quy tắc giải quyết xung đột. Google cho biết web app Android có thể được thêm vào màn hình chính nhưng khả năng offline tùy từng app ([Google Chrome Help — web apps](https://support.google.com/chrome/answer/9658361?hl=en)); cài được PWA không đồng nghĩa các giao dịch bán hàng đã hỗ trợ offline.

## Giai đoạn cần hoàn thiện để thương mại hóa

1. API/đám mây có xác thực, phân quyền, nhiều cửa hàng và đồng bộ xung đột.
2. Cơ sở dữ liệu giao dịch, audit log, backup/restore tự động, mã hóa dữ liệu nhạy cảm.
3. Kết nối thanh toán/bank QR, hóa đơn điện tử, vận chuyển, máy in và máy quét.
4. Đồng bộ đơn đa kênh, chính sách giá/khuyến mại, nhà cung cấp và mua hàng đầy đủ.
5. Kiểm thử thiết bị thật cho iOS/Android, accessibility, migration, bảo mật, triển khai và vận hành.
