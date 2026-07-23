const titles={dashboard:'Visão geral',visitantes:'Visitantes',eventos:'Eventos',intercessao:'Intercessão'};
const buttons=document.querySelectorAll('.nav-item');
const views=document.querySelectorAll('.view');
const pageTitle=document.getElementById('pageTitle');
buttons.forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.view;
  buttons.forEach(item=>item.classList.toggle('active',item===button));
  views.forEach(view=>view.classList.toggle('active',view.id===target));
  pageTitle.textContent=titles[target]||'Casa Forte Admin';
}));
