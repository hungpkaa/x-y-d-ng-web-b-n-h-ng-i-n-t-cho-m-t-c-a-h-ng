const chatPanel=document.getElementById('chat-panel'),chatToggle=document.getElementById('chat-toggle'),chatForm=document.getElementById('chat-form'),chatMessages=document.getElementById('chat-messages');
function chatOpen(open) {chatPanel.hidden=!open;chatToggle.setAttribute('aria-expanded',String(open));if(open)chatForm.elements.message.focus();else chatToggle.focus();}
chatToggle.addEventListener('click',()=>chatOpen(chatPanel.hidden));
document.getElementById('chat-close').addEventListener('click',()=>chatOpen(false));
chatPanel.addEventListener('keydown',event=>{if(event.key==='Escape')chatOpen(false);});
function chatBubble(text,own=false,links=[]) {
  const bubble=document.createElement('div');bubble.className='chat-bubble'+(own?' chat-own':'');
  const paragraph=document.createElement('p');paragraph.textContent=text;bubble.append(paragraph);
  for(const link of links) {if(typeof link.url!=='string'||!/^\/(?!\/)/.test(link.url))continue;const anchor=document.createElement('a');anchor.href=link.url;anchor.textContent=link.label;bubble.append(anchor);}
  chatMessages.append(bubble);while(chatMessages.children.length>30)chatMessages.firstElementChild.remove();chatMessages.scrollTop=chatMessages.scrollHeight;
}
chatForm.addEventListener('submit',async event=>{
  event.preventDefault();const message=chatForm.elements.message.value.trim(),button=chatForm.querySelector('button'),status=document.getElementById('chat-status');if(!message||button.disabled)return;
  button.disabled=true;status.textContent='Đang tìm câu trả lời…';chatBubble(message,true);
  try {
    const response=await fetch('/chatbot/message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({_csrf:chatForm.elements._csrf.value,message})});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Phiên đã thay đổi. Hãy tải lại trang và thử lại.');
    const result=await response.json();if(!response.ok)throw new Error(result.message||'Chưa thể trả lời.');
    chatBubble(result.text,false,result.links);chatForm.elements.message.value='';status.textContent='';
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;chatForm.elements.message.focus();}
});
for(const button of document.querySelectorAll('[data-chat-question]'))button.addEventListener('click',()=>{chatForm.elements.message.value=button.dataset.chatQuestion;chatForm.requestSubmit();});
