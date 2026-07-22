const phone='5554993217227';
const year=document.getElementById('year'); if(year) year.textContent=new Date().getFullYear();
document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const text=document.getElementById(btn.dataset.copy).textContent.trim();try{await navigator.clipboard.writeText(text);const old=btn.textContent;btn.textContent='Chave copiada!';setTimeout(()=>btn.textContent=old,1800)}catch{prompt('Copie a chave Pix:',text)}}));
const openWhatsApp=(message)=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank');
const visitor=document.getElementById('visitorForm');
visitor?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(visitor);openWhatsApp(`Olá! Quero conhecer a Casa Forte.\n\nNome: ${d.get('nome')}\nTelefone: ${d.get('telefone')}\nCidade: ${d.get('cidade')}\nFrequenta ou frequentou outra igreja: ${d.get('igreja')}\nComo conheceu a Casa: ${d.get('origem')}`)});
const prayer=document.getElementById('prayerForm');
prayer?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(prayer);openWhatsApp(`Olá! Gostaria de enviar um pedido de oração.\n\nNome: ${d.get('nome')||'Anônimo'}\nPedido: ${d.get('pedido')}`)});
