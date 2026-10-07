const upload=document.getElementById('image-upload');
const create=document.getElementById('product-create');
// File previews and drag/drop for both create and edit forms. The real file
// input remains available to keyboard users and the server still decodes it.
for(const input of document.querySelectorAll('input[type="file"]')) {
  const zone=input.closest('label');zone.classList.add('drop-zone');
  const hint=document.createElement('small');hint.textContent='Kéo ảnh vào đây hoặc bấm Chọn tệp.';zone.append(hint);
  const preview=document.createElement('img');preview.className='image-preview';preview.alt='Xem trước ảnh đã chọn';preview.hidden=true;zone.append(preview);
  const info=document.createElement('span');info.setAttribute('role','status');zone.append(info);
  let objectUrl;
  input.addEventListener('change',()=>{
    if(objectUrl) URL.revokeObjectURL(objectUrl);objectUrl=null;preview.hidden=true;
    const file=input.files[0];info.textContent='';if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024) {info.textContent='Chọn JPEG, PNG hoặc WebP tối đa 5MB.';input.value='';return;}
    objectUrl=URL.createObjectURL(file);preview.src=objectUrl;preview.hidden=false;
    info.textContent=file.name+' · '+(file.size/1024/1024).toFixed(2)+' MB';
  });
  zone.addEventListener('dragover',event=>{event.preventDefault();zone.classList.add('drag-over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone.addEventListener('drop',event=>{
    event.preventDefault();zone.classList.remove('drag-over');
    if(event.dataTransfer.files.length!==1) {info.textContent='Chọn một ảnh mỗi lần.';return;}
    const transfer=new DataTransfer();transfer.items.add(event.dataTransfer.files[0]);input.files=transfer.files;input.dispatchEvent(new Event('change'));
  });
}
const gallery=document.getElementById('image-gallery'),saveOrder=document.getElementById('save-image-order');
if(gallery&&saveOrder) {
  const status=document.getElementById('image-order-status');let dragged;
  const update=()=>{[...gallery.children].forEach((card,index)=>card.querySelector('.image-position').textContent=index===0?'Ảnh đại diện':'Ảnh '+(index+1));status.textContent='Thứ tự chưa lưu. Bấm Lưu thứ tự / ảnh đại diện để áp dụng.';};
  gallery.addEventListener('click',event=>{
    const button=event.target.closest('[data-image-move]');if(!button)return;
    const card=button.closest('.image-card');
    if(button.dataset.imageMove==='cover') gallery.prepend(card);
    else if(button.dataset.imageMove==='up'&&card.previousElementSibling) gallery.insertBefore(card,card.previousElementSibling);
    else if(button.dataset.imageMove==='down'&&card.nextElementSibling) gallery.insertBefore(card.nextElementSibling,card);
    update();button.focus();
  });
  for(const card of gallery.children) {
    card.addEventListener('dragstart',event=>{dragged=card;event.dataTransfer.setData('text/plain',card.dataset.imageId);event.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragover',event=>{if(dragged){event.preventDefault();card.classList.add('drag-target');}});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-target'));
    card.addEventListener('drop',event=>{event.preventDefault();card.classList.remove('drag-target');if(dragged&&dragged!==card){gallery.insertBefore(dragged,card);update();}});
    card.addEventListener('dragend',()=>{dragged=null;for(const item of gallery.children)item.classList.remove('drag-target');});
  }
  saveOrder.addEventListener('click',async()=>{
    saveOrder.disabled=true;status.textContent='Đang lưu thứ tự ảnh…';
    try {
      const response=await fetch(gallery.dataset.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({_csrf:gallery.dataset.csrf,version:gallery.dataset.version,ids:[...gallery.children].map(card=>Number(card.dataset.imageId))})});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Phiên làm việc hết hiệu lực. Hãy tải lại trang.');
      const result=await response.json();if(!response.ok)throw new Error(result.message);location.reload();
    }catch(error){status.textContent=error.message;saveOrder.disabled=false;}
  });
}
if(create) create.addEventListener('submit',async event=>{
  const file=create.elements.product_image.files[0];
  if(!file&&!create.dataset.createdUrl) return; // Normal form submission without an image.
  event.preventDefault();
  const status=document.getElementById('product-create-status'),button=create.querySelector('button');
  if(!file||file.size>5*1024*1024) {status.textContent='Hãy chọn ảnh tối đa 5MB.';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {status.textContent='Chọn ảnh JPEG, PNG hoặc WebP.';return;}
  button.disabled=true;status.textContent='Đang thêm sản phẩm và tải ảnh…';
  try {
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));reader.readAsDataURL(file);});
    if(!create.dataset.createdUrl) {
      const body=Object.fromEntries(['_csrf','name','category','brand','description'].map(key=>[key,create.elements[key].value]));
      const response=await fetch(create.action,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
      if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('Phiên làm việc hết hiệu lực. Hãy tải lại trang.');
      const result=await response.json();if(!response.ok) throw new Error(result.message);
      create.dataset.createdUrl=result.url;create.dataset.createdVersion=String(result.version);
      for(const key of ['name','category','brand','description']) create.elements[key].disabled=true;
    }
    const response=await fetch(create.dataset.createdUrl+'/images',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({_csrf:create.elements._csrf.value,version:create.dataset.createdVersion,alt:create.elements.image_alt.value.trim()||create.elements.name.value,data})});
    if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('Không tải được ảnh. Hãy kiểm tra phiên làm việc và kích thước ảnh.');
    const result=await response.json();if(!response.ok) throw new Error(result.message);
    location.assign(create.dataset.createdUrl);
  } catch(error) {
    status.textContent=error.message;
    if(create.dataset.createdUrl) {
      status.append(document.createTextNode(' Sản phẩm đã được tạo; bạn có thể chọn ảnh khác rồi thử lại hoặc '));
      const link=document.createElement('a');link.href=create.dataset.createdUrl;link.textContent='mở sản phẩm để tiếp tục';status.append(link);
      button.textContent='Thử tải ảnh lại';
    }
    button.disabled=false;
  }
});
if(upload) upload.addEventListener('submit',async event=>{
  event.preventDefault();
  const file=upload.elements.file.files[0],status=document.getElementById('upload-status'),button=upload.querySelector('button');
  if(!file||file.size>5*1024*1024) {status.textContent='Hãy chọn ảnh tối đa 5MB.';return;}
  button.disabled=true;status.textContent='Đang xử lý ảnh…';
  try {
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Không đọc được tệp.'));reader.readAsDataURL(file);});
    const response=await fetch(upload.dataset.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({_csrf:upload.elements._csrf.value,version:upload.elements.version.value,alt:upload.elements.alt.value,data})});
    if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('Phiên làm việc hết hiệu lực hoặc ảnh quá lớn. Hãy tải lại trang.');
    const result=await response.json();if(!response.ok) throw new Error(result.message);location.reload();
  } catch(error) {status.textContent=error.message;button.disabled=false;}
});
