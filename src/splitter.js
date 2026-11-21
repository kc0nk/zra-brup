let active=null,startY=0,startH=0;
document.addEventListener('mousedown',e=>{const table=e.target.closest('.history-grid .table');if(!table)return;const r=table.getBoundingClientRect();if(e.clientY<r.bottom-10)return;active=table;startY=e.clientY;startH=r.height;document.body.style.cursor='row-resize';e.preventDefault()});
document.addEventListener('mousemove',e=>{if(!active)return;const h=Math.max(150,Math.min(window.innerHeight*.72,startH+e.clientY-startY));active.style.flex=`0 0 ${h}px`;active.style.height=`${h}px`});
document.addEventListener('mouseup',()=>{if(active){active=null;document.body.style.cursor=''}});
