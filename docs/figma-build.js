const varsList = await figma.variables.getLocalVariablesAsync();
const vars = Object.fromEntries(varsList.map(v => [v.name, v]));
await Promise.all([
  {family:"DM Sans",style:"Regular"},{family:"DM Sans",style:"Medium"},
  {family:"DM Sans",style:"SemiBold"},{family:"DM Sans",style:"Bold"},
  {family:"Manrope",style:"SemiBold"},{family:"Manrope",style:"Bold"}
].map(f => figma.loadFontAsync(f)));

const page = figma.createPage();
page.name = "Slink — App mobile";
figma.root.appendChild(page);
await figma.setCurrentPageAsync(page);

const created = [];
const stats = {frames:0,text:0,vectors:0,instances:0};
function paint(key) {
  const v = vars[key];
  if (!v) throw new Error("Missing Slink token: " + key);
  return figma.variables.setBoundVariableForPaint(
    {type:"SOLID",color:{r:0,g:0,b:0}}, "color", v
  );
}
function fill(node,key) { node.fills = [paint(key)]; }
function stroke(node,key) { node.strokes = [paint(key)]; node.strokeWeight = 1; }
function place(node,parent,x,y) { if (parent.layoutMode === "NONE") { node.x=x; node.y=y; } }
function box(parent,name,x,y,w,h,bg,border,radius,dir) {
  const f = dir ? figma.createAutoLayout(dir) : figma.createFrame();
  f.name=name; f.resize(w,h);
  if (bg) fill(f,bg); else f.fills=[];
  if (border) stroke(f,border);
  if (radius !== undefined) f.cornerRadius=radius;
  f.clipsContent=true;
  if (dir) {
    f.primaryAxisSizingMode="FIXED"; f.counterAxisSizingMode="FIXED";
    f.primaryAxisAlignItems="MIN"; f.counterAxisAlignItems="MIN";
    f.paddingTop=0; f.paddingRight=0; f.paddingBottom=0; f.paddingLeft=0;
    f.itemSpacing=0;
  }
  parent.appendChild(f); place(f,parent,x,y);
  stats.frames++; created.push(f.id); return f;
}
function auto(parent,name,x,y,w,h,dir,bg,border,padding,gap,radius) {
  const f=box(parent,name,x,y,w,h,bg,border,radius,dir);
  f.paddingTop=padding||0; f.paddingRight=padding||0; f.paddingBottom=padding||0; f.paddingLeft=padding||0;
  f.itemSpacing=gap||0; return f;
}
function txt(parent,name,value,x,y,w,h,size,color,family,style,align) {
  const n=figma.createText(); n.name=name;
  n.fontName={family:family||"DM Sans",style:style||"Regular"};
  n.fontSize=size; n.characters=value; n.textAutoResize="HEIGHT"; n.resize(w,h);
  n.fills=[paint(color||"color/text/primary")]; n.textAlignHorizontal=align||"LEFT";
  parent.appendChild(n); place(n,parent,x,y); stats.text++; created.push(n.id); return n;
}
function vector(parent,name,x,y,size,token,path) {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>';
  const node=figma.createNodeFromSvg(svg); node.name=name; node.resize(size,size);
  parent.appendChild(node); place(node,parent,x,y);
  for (const child of node.findAllWithCriteria({types:["VECTOR"]})) {
    child.strokes=[paint(token||"color/brand/forest")]; child.strokeWeight=1.8;
    created.push(child.id); stats.vectors++;
  }
  created.push(node.id); stats.vectors++; return node;
}
const paths={
  home:"M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cart:"M3 4h2l2 11h11l2-8H7",
  receipt:"M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  layers:"m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  users:"M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  alert:"m10.3 4.3-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01",
  search:"M10.8 17.2a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8M16 16l4.5 4.5",
  bell:"M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  chart:"M3 3v18h18M7 14l4-4 3 3 6-7",
  back:"m15 18-6-6 6-6"
};
function ico(parent,name,x,y,size,token) { return vector(parent,"Icon / "+name,x,y,size,token,paths[name]||paths.home); }
function screen(parent,name,x) {
  const s=box(parent,name,x,75,390,844,"color/bg/canvas","color/border/default",28);
  s.clipsContent=true; return s;
}
function header(s,storeName) {
  txt(s,"Status time","9:41",20,8,48,12,9,"color/text/primary","DM Sans","Bold");
  txt(s,"Status indicators","●  ▰  ◖",306,8,64,12,8,"color/text/primary","DM Sans","Medium","RIGHT");
  const mark=box(s,"Slink mark",20,34,33,33,"color/brand/forest",null,10);
  txt(mark,"S","S",0,3,33,25,20,"color/brand/lime","Manrope","Bold","CENTER");
  txt(s,"Wordmark","slink.",61,37,82,24,18,"color/brand/forest","Manrope","Bold");
  txt(s,"Store name",storeName,158,42,142,14,9,"color/text/secondary","DM Sans","Medium","RIGHT");
  ico(s,"bell",340,40,18,"color/text/secondary");
}
function statCard(s,x,y,w,label,value,note,iconName) {
  const c=auto(s,"Stat / "+label,x,y,w,77,"VERTICAL","color/bg/surface","color/border/default",11,5,13);
  const row=auto(c,"Stat heading",0,0,w-22,14,"HORIZONTAL",null,null,0,0);
  row.counterAxisAlignItems="CENTER";
  txt(row,"Label",label,0,0,w-52,14,8,"color/text/secondary","DM Sans","Medium");
  ico(row,iconName,0,0,13,"color/brand/forest-hover");
  txt(c,"Value",value,0,0,w-22,21,15,"color/text/primary","Manrope","Bold");
  txt(c,"Note",note,0,0,w-22,12,7.5,"color/text/secondary","DM Sans","Regular");
}
function chip(s,x,y,w,label,selected) {
  const c=box(s,"Chip / "+label,x,y,w,30,selected?"color/brand/forest":"color/bg/surface",selected?null:"color/border/default",15);
  txt(c,"Label",label,0,8,w,15,9,selected?"color/bg/surface":"color/text/secondary","DM Sans",selected?"SemiBold":"Medium","CENTER");
}
function searchField(s,name,placeholder,x,y,w,h) {
  const field=box(s,name,x,y,w,h,"color/bg/surface","color/border/default",12);
  ico(field,"search",14,Math.round((h-18)/2),18,"color/text/secondary");
  txt(field,"Placeholder",placeholder,44,Math.round((h-14)/2),w-58,16,9,"color/text/secondary","DM Sans","Regular");
  return field;
}
function productCard(s,x,y,initials,name,sku,price,qty,tone) {
  const c=auto(s,"Product / "+name,x,y,168,124,"VERTICAL","color/bg/surface","color/border/default",12,6,14);
  const row=auto(c,"Product / header",0,0,144,37,"HORIZONTAL",null,null,0,0);
  row.counterAxisAlignItems="CENTER";
  const thumb=box(row,"Product / "+initials,0,0,37,37,tone,null,11);
  txt(thumb,"Initials",initials,0,10,37,18,12,"color/brand/forest","Manrope","Bold","CENTER");
  txt(row,"Quantity",qty,0,0,95,13,8,"color/text/secondary","DM Sans","Medium","RIGHT");
  txt(c,"Product name",name,0,0,144,26,9,"color/text/primary","DM Sans","SemiBold");
  txt(c,"SKU",sku,0,0,144,12,7.5,"color/text/secondary","DM Sans","Regular");
  txt(c,"Price",price,0,0,144,15,10,"color/brand/forest","DM Sans","Bold");
}
function bottomNav(s,y,active) {
  const nav=auto(s,"Bottom navigation",20,y,350,62,"HORIZONTAL","color/bg/surface","color/border/default",4,0,16);
  nav.counterAxisAlignItems="CENTER";
  const items=[["home","Tổng quan"],["cart","Bán hàng"],["receipt","Đơn hàng"],["layers","Khác"]];
  for(const item of items){
    const on=item[1]===active;
    const cell=auto(nav,"Tab / "+item[1],0,0,82,52,"VERTICAL",on?"color/surface/mint":null,null,5,3,12);
    cell.counterAxisAlignItems="CENTER";
    ico(cell,item[0],0,0,17,on?"color/brand/forest":"color/text/secondary");
    txt(cell,"Tab label",item[1],0,0,74,11,7.5,on?"color/brand/forest":"color/text/secondary","DM Sans",on?"SemiBold":"Medium","CENTER");
  }
}
const board=box(page,"Slink / Mobile previews",70,70,1310,950,"color/bg/canvas",null,24);
txt(board,"Board title","SLINK  /  QUẢN LÝ BÁN HÀNG",28,23,420,24,16,"color/brand/forest","Manrope","Bold");
txt(board,"Board subtitle","Ba màn hình cốt lõi · mobile-first · đơn vị tiền VND",28,47,500,16,9,"color/text/secondary","DM Sans","Regular");
const home=screen(board,"01 — Tổng quan",25);
const sale=screen(board,"02 — Bán hàng",460);
const stock=screen(board,"03 — Kho hàng",895);

header(home,"Linh Chi Store");
txt(home,"Greeting","Chào buổi sáng,",20,83,260,18,11,"color/text/secondary","DM Sans","Medium");
txt(home,"Owner","Thảo Hà 👋",20,102,340,31,24,"color/text/primary","Manrope","Bold");
txt(home,"Date","Thứ Hai, 12 tháng 10",20,134,250,14,9,"color/text/secondary","DM Sans","Regular");
const hero=box(home,"Revenue overview",20,159,350,123,"color/brand/forest",null,18);
hero.setBoundVariable("topLeftRadius",vars["radius/card"]); hero.setBoundVariable("topRightRadius",vars["radius/card"]);
hero.setBoundVariable("bottomLeftRadius",vars["radius/card"]); hero.setBoundVariable("bottomRightRadius",vars["radius/card"]);
txt(hero,"Revenue label","DOANH THU HÔM NAY",18,16,190,14,8,"color/brand/lime","DM Sans","Bold");
txt(hero,"Revenue amount","12.840.000 ₫",18,38,245,33,24,"color/bg/surface","Manrope","Bold");
const trend=box(hero,"Trend badge",18,83,93,24,"color/brand/forest-hover",null,12);
txt(trend,"Trend","↑ 12,8%  hôm qua",0,5,93,14,8,"color/brand/lime","DM Sans","SemiBold","CENTER");
ico(hero,"chart",215,49,40,"color/brand/lime");
statCard(home,20,295,168,"Đơn hôm nay","8","↑ 8,2% so với hôm qua","receipt");
statCard(home,202,295,168,"Lãi gộp ước tính","1.860.000 ₫","Theo giá vốn sản phẩm","chart");
statCard(home,20,383,168,"Khách quay lại","4 khách","Có đơn trong hôm nay","users");
statCard(home,202,383,168,"Sắp hết hàng","3 mặt hàng","Cần kiểm tra và nhập","alert");
txt(home,"Quick heading","Thao tác nhanh",20,480,180,20,13,"color/text/primary","Manrope","Bold");
txt(home,"Quick subheading","Các việc thường làm mỗi ngày",20,501,220,14,8.5,"color/text/secondary","DM Sans","Regular");
const actions=[["＋","Tạo đơn","Thu tiền tại quầy"],["＋","Thêm hàng","Tạo sản phẩm mới"],["↙","Nhập kho","Cập nhật số lượng"],["↗","Ghi khoản chi","Quản lý dòng tiền"]];
for(let i=0;i<actions.length;i++){
  const x=20+(i%2)*181,y=523+Math.floor(i/2)*57;
  const a=auto(home,"Quick action / "+actions[i][1],x,y,168,50,"HORIZONTAL","color/bg/surface","color/border/default",8,8,12);
  a.counterAxisAlignItems="CENTER";
  const mark=box(a,"Quick icon",0,0,31,31,"color/surface/mint",null,9);
  txt(mark,"Quick action symbol",actions[i][0],0,4,31,23,15,"color/brand/forest","DM Sans","Bold","CENTER");
  const copy=auto(a,"Action copy",0,0,108,34,"VERTICAL",null,null,0,2);
  txt(copy,"Action title",actions[i][1],0,0,108,14,9,"color/text/primary","DM Sans","SemiBold");
  txt(copy,"Action description",actions[i][2],0,0,108,12,7,"color/text/secondary","DM Sans","Regular");
}
txt(home,"Recent heading","Đơn hàng gần đây",20,651,220,18,12,"color/text/primary","Manrope","Bold");
txt(home,"Recent link","Xem tất cả  →",272,652,98,16,8,"color/brand/forest-hover","DM Sans","SemiBold","RIGHT");
for(let i=0;i<2;i++){
  const y=679+i*37,o=box(home,"Recent order / "+i,20,y,350,33,"color/bg/surface","color/border/default",10);
  txt(o,"Order number",i===0?"SL-1008":"SL-1007",10,5,72,12,8,"color/brand/forest","DM Sans","Bold");
  txt(o,"Order details",i===0?"Thảo Vy · 3 sản phẩm":"Minh Anh · 1 sản phẩm",88,5,161,12,8,"color/text/secondary","DM Sans","Regular");
  txt(o,"Order total",i===0?"693.000 ₫":"185.000 ₫",250,5,90,14,8,"color/text/primary","DM Sans","SemiBold","RIGHT");
}
bottomNav(home,769,"Tổng quan");

header(sale,"Bán tại quầy");
ico(sale,"Back",20,86,17,"color/text/primary");
txt(sale,"Title","Bán hàng",47,84,205,23,18,"color/text/primary","Manrope","Bold");
txt(sale,"Draft badge","Đơn mới",286,89,83,16,8,"color/text/secondary","DM Sans","Medium","RIGHT");
const buttonSet=await figma.importComponentSetByKeyAsync("ab924dce8b851fd820bd0d56da24a9c489311ae6");
searchField(sale,"Product search","Tìm sản phẩm hoặc mã SKU",20,117,350,52);
const cats=[["Tất cả",78,true],["Đồ uống",78,false],["Gia dụng",82,false],["Chăm sóc",80,false]];
let cx=20; for(const c of cats){chip(sale,cx,179,c[1],c[0],c[2]);cx+=c[1]+7;}
txt(sale,"Popular heading","Sản phẩm gợi ý",20,222,180,18,12,"color/text/primary","Manrope","Bold");
txt(sale,"Product count","Còn 26 sản phẩm",245,224,125,14,8,"color/text/secondary","DM Sans","Regular","RIGHT");
productCard(sale,20,249,"CF","Cà phê rang xay","CF-MOC-250","185.000 ₫","Còn 24","color/status/warning");
productCard(sale,202,249,"TR","Trà ô long hoa nhài","TR-OL-180","129.000 ₫","Còn 7","color/surface/mint");
productCard(sale,20,382,"BN","Bình giữ nhiệt Luna","BN-LUN-500","349.000 ₫","Còn 18","color/status/info");
productCard(sale,202,382,"TX","Túi canvas Sáng","TX-SAN-01","159.000 ₫","Còn 32","color/status/danger");
txt(sale,"Cart heading","Giỏ hàng · 2 món",20,523,220,18,12,"color/text/primary","Manrope","Bold");
txt(sale,"Cart customer","Khách: Minh Anh  ·  Đổi",224,525,146,14,8,"color/brand/forest-hover","DM Sans","SemiBold","RIGHT");
txt(sale,"Cart item one","Cà phê rang xay  × 1",20,550,225,16,9,"color/text/primary","DM Sans","Medium");
txt(sale,"Cart price one","185.000 ₫",273,550,97,16,9,"color/text/primary","DM Sans","SemiBold","RIGHT");
txt(sale,"Cart item two","Bình giữ nhiệt Luna  × 1",20,573,225,16,9,"color/text/primary","DM Sans","Medium");
txt(sale,"Cart price two","349.000 ₫",273,573,97,16,9,"color/text/primary","DM Sans","SemiBold","RIGHT");
box(sale,"Cart divider",20,596,350,1,"color/border/default",null,0);
txt(sale,"Subtotal label","Tạm tính",20,607,120,16,9,"color/text/secondary","DM Sans","Regular");
txt(sale,"Subtotal","534.000 ₫",266,607,104,16,9,"color/text/primary","DM Sans","Medium","RIGHT");
txt(sale,"Total label","Khách cần trả",20,629,150,20,11,"color/text/primary","DM Sans","SemiBold");
txt(sale,"Total","534.000 ₫",196,625,174,26,16,"color/brand/forest","Manrope","Bold","RIGHT");
const buttonVariant=buttonSet.children.find(v=>v.name==="Type=Round, Size=Medium, State=Enabled");
const pay=buttonVariant.createInstance(); pay.name="Checkout CTA / Material 3 Button";
const payLabel=pay.findOne(n=>n.type==="TEXT"&&n.name==="Label");
if(payLabel){payLabel.fontName={family:"DM Sans",style:"SemiBold"};payLabel.characters="Thanh toán";payLabel.fills=[paint("color/bg/surface")];}
const payIcon=pay.findOne(n=>n.name==="Icon"); if(payIcon) payIcon.visible=false;
pay.resize(350,48); sale.appendChild(pay); pay.x=20; pay.y=662; created.push(pay.id); stats.instances++;
const paySurface=pay.findOne(n=>n.name==="Content"&&n.type==="FRAME");
if(paySurface)fill(paySurface,"color/brand/forest");
bottomNav(sale,769,"Bán hàng");

header(stock,"Linh Chi Store");
txt(stock,"Title","Kho hàng",20,84,235,26,20,"color/text/primary","Manrope","Bold");
txt(stock,"Subtitle","Số lượng và biến động tồn kho",20,111,300,15,9,"color/text/secondary","DM Sans","Regular");
statCard(stock,20,140,168,"Tổng mặt hàng","128","Đang kinh doanh","layers");
statCard(stock,202,140,168,"Tồn kho thấp","3 mặt hàng","Bằng hoặc dưới cảnh báo","alert");
searchField(stock,"Inventory search","Tìm tên sản phẩm hoặc SKU",20,230,350,50);
const notice=box(stock,"Low stock notice",20,291,350,53,"color/status/warning",null,13);
ico(notice,"Low stock",13,17,18,"color/text/primary");
txt(notice,"Notice title","3 mặt hàng cần nhập thêm",42,9,245,16,9,"color/text/primary","DM Sans","SemiBold");
txt(notice,"Notice copy","Kiểm tra trước khi hết hàng",42,27,245,14,8,"color/text/secondary","DM Sans","Regular");
txt(stock,"List heading","Tồn kho hiện tại",20,362,190,18,12,"color/text/primary","Manrope","Bold");
txt(stock,"Sort","Sắp xếp  ⌄",283,363,87,16,8,"color/text/secondary","DM Sans","Medium","RIGHT");
const items=[
  ["TR","Trà ô long hoa nhài","TR-OL-180","7 hộp","Sắp hết","color/surface/mint"],
  ["NT","Nến thơm An Nhiên","NT-AN-120","5 hũ","Sắp hết","color/status/info"],
  ["XP","Xà phòng thảo mộc","XP-TH-90","Hết hàng","Cần nhập","color/status/danger"],
  ["CF","Cà phê rang xay — Mộc","CF-MOC-250","24 túi","Ổn định","color/status/warning"]
];
for(let i=0;i<items.length;i++){
  const y=391+i*81,row=auto(stock,"Inventory / "+items[i][1],20,y,350,72,"HORIZONTAL","color/bg/surface","color/border/default",10,10,13);
  row.counterAxisAlignItems="CENTER";
  const thumb=box(row,"Product / "+items[i][0],0,0,41,41,items[i][5],null,12);
  txt(thumb,"Initials",items[i][0],0,12,41,18,11,"color/brand/forest","Manrope","Bold","CENTER");
  const details=auto(row,"Product details",0,0,184,42,"VERTICAL",null,null,0,4);
  txt(details,"Product name",items[i][1],0,0,184,15,9,"color/text/primary","DM Sans","SemiBold");
  txt(details,"Product SKU",items[i][2],0,0,184,12,7.5,"color/text/secondary","DM Sans","Regular");
  const qty=auto(row,"Quantity status",0,0,85,42,"VERTICAL",null,null,0,4);
  qty.counterAxisAlignItems="MAX";
  txt(qty,"Quantity",items[i][3],0,0,85,15,9,i===2?"color/status/danger":"color/text/primary","DM Sans","Bold","RIGHT");
  txt(qty,"Status",items[i][4],0,0,85,12,7.5,i<3?"color/text/secondary":"color/brand/forest-hover","DM Sans","Medium","RIGHT");
}
bottomNav(stock,769,"Khác");
return {
  page:{id:page.id,name:page.name},
  wrapperId:board.id,
  screenIds:[home.id,sale.id,stock.id],
  importedLibrarySetIds:[buttonSet.id,textSet.id],
  createdNodeIds:created,
  createdCount:created.length,
  nodeCounts:stats,
  topLevel:page.children.map(n=>({id:n.id,name:n.name,type:n.type,width:Math.round(n.width),height:Math.round(n.height)})),
  imageNodeCount:0
};
