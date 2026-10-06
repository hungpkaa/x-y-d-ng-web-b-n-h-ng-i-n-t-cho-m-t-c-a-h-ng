const upload=document.getElementById('image-upload');
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
