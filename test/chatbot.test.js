const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase,seed}=require('../src/db');
const {reply}=require('../src/chatbot');
test('Chatbot chỉ gợi ý sản phẩm công bố, còn hàng, đúng ngân sách; validate câu hỏi',()=>{
  const db=openDatabase(':memory:',10);seed(db);try {
    assert.equal(reply(db,null,{}).status,400);
    assert.equal(reply(db,null,'x'.repeat(501)).status,400);
    assert.ok(reply(db,null,'laptop dưới 25 triệu').links.some(link=>link.url==='/products/3'));
    db.exec("UPDATE products SET status='HIDDEN' WHERE id=3;UPDATE product_variants SET on_hand=0 WHERE product_id=4");
    assert.ok(reply(db,null,'laptop dưới 25 triệu').links.every(link=>!['/products/3','/products/4'].includes(link.url)));
    assert.ok(reply(db,null,'bảo hành').links.some(link=>link.url==='/support/new'));
  }finally{db.close();}
});
test('Chatbot tra cứu đơn giới hạn chính chủ và chặn khách vãng lai/quản lý',()=>{
  const db=openDatabase(':memory:',10);seed(db);try {
    db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'One','one@chat.test','hash','CUSTOMER'),(2,'Two','two@chat.test','hash','CUSTOMER');INSERT INTO orders(id,user_id,recipient,phone,address,total) VALUES(1,1,'One','0901234567','123 Test',1000)");
    const owner={id:1,role:'CUSTOMER',status:'ACTIVE'},other={id:2,role:'CUSTOMER',status:'ACTIVE'};
    assert.equal(reply(db,owner,'trạng thái đơn #1').links[0].url,'/orders/1');
    assert.ok(reply(db,other,'trạng thái đơn #1').links.every(link=>link.url!=='/orders/1'));
    assert.equal(reply(db,null,'đơn hàng của tôi').links[0].url,'/login');
    assert.equal(reply(db,{...owner,role:'STAFF'},'đơn hàng của tôi').links[0].url,'/login');
  }finally{db.close();}
});
