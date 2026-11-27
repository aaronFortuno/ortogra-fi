import { createLoadingIndicator,createResourceLoader } from '../escriptori/loading.js?v=1.16.1';
import { createAmbientAudio } from '../escriptori/ambient-audio.js?v=1.26.0';
import { loadCatalogue } from './catalogue.js?v=0.1.1';

const workspace=document.querySelector('#workspace'),canvas=document.querySelector('#desk-canvas'),status=document.querySelector('#desk-status'),caption=document.querySelector('#hover-caption');
const list=document.querySelector('#projectes'),listButton=document.querySelector('.list-toggle'),info=document.querySelector('#material-info');
const loading=createLoadingIndicator(document.querySelector('#desk-loading')),audio=createAmbientAudio(document.querySelector('#ambient-toggle')),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let desk,busy=false,current=null,projects=[];
const root=new URL('../',import.meta.url),sleep=ms=>new Promise(r=>setTimeout(r,reduced.matches?0:ms));
function track(name,data={}){if(location.hostname!=='ortogra.fi'||location.protocol!=='https:'||navigator.webdriver)return;try{window.umami?.track?.('v3_'+name,{interficie:'escriptori-v2',...data})?.catch?.(()=>{});}catch{/* Optional analytics. */}}
function setList(open){list.classList.toggle('is-open',open);listButton.setAttribute('aria-expanded',String(open));list.inert=!open;}
function directLinks(){
  document.querySelector('#project-list').replaceChildren(...projects.map(project=>{const link=document.createElement('a');link.href=project.href;link.textContent=project.name;const small=document.createElement('small');small.textContent=project.purpose;link.append(small);return link;}));
  info.hidden=true;setList(true);
}
setList(false);listButton.addEventListener('click',()=>setList(!list.classList.contains('is-open')));
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();setList(true);list.querySelector('button,a')?.focus({preventScroll:true});});
document.addEventListener('pointerdown',e=>{if(!list.contains(e.target)&&!listButton.contains(e.target))setList(false);});
const theme=document.querySelector('[data-theme-toggle]');
function reflectTheme(){const dark=document.documentElement.dataset.theme==='dark';theme.setAttribute('aria-pressed',String(dark));theme.setAttribute('aria-label',dark?'Activa el tema clar':'Activa el tema fosc');}
reflectTheme();theme.addEventListener('click',()=>setTimeout(()=>track('canvia_tema',{tema:document.documentElement.dataset.theme}),0));
document.querySelector('#ambient-toggle').addEventListener('click',()=>track('so_ambient',{actiu:document.querySelector('#ambient-toggle').getAttribute('aria-pressed')}));
function updateInfo(){
  if(!current)return;const state=desk.info();document.querySelector('#sample-counter').textContent=(state.index+1)+' / '+state.count;
  const terrain=current.kind==='box';document.querySelector('#sample-inspect').textContent=terrain?'Acosta la maqueta':'Acosta la fitxa';document.querySelector('#sample-answer').hidden=terrain||!state.secondary;document.querySelector('#sample-answer').textContent=state.paired?'Acosta el solucionari':'Acosta la segona plantilla';
  workspace.dataset.inspecting=String(Boolean(state.inspection));document.querySelector('#inspection-close').hidden=!state.inspection;info.inert=Boolean(state.inspection);
}
async function open(project){
  if(!desk||busy||current)return;busy=true;current=project;document.querySelector('.view-tools').inert=true;setList(false);caption.classList.remove('visible');status.textContent='Preparant '+project.name+'…';
  try{
    await desk.select(project.id);status.textContent='';document.querySelector('#material-title').textContent=project.name;document.querySelector('#material-description').textContent=project.description;
    const enter=document.querySelector('#material-enter');enter.href=project.href;enter.textContent='Obre '+project.name;
    info.hidden=false;info.inert=false;updateInfo();requestAnimationFrame(()=>info.classList.add('is-visible'));document.querySelector('#material-close').focus({preventScroll:true});
  }catch(error){status.textContent='No s’ha pogut carregar aquesta mostra. Pots tornar-ho a provar.';current=null;document.querySelector('.view-tools').inert=false;console.error(error);}
  finally{busy=false;}
}
async function close(){
  if(!current||busy)return;if(desk.info().inspection){await leaveInspection();return;}busy=true;
  const previous=current;info.classList.remove('is-visible');await sleep(220);info.hidden=true;await desk.close();current=null;busy=false;document.querySelector('.view-tools').inert=false;(previous.button.hidden?listButton:previous.button).focus({preventScroll:true});
}
async function sample(delta){if(busy||!current||desk.info().inspection)return;busy=true;const buttons=info.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await desk.changeSample(delta);updateInfo();track('canvia_mostra',{projecte:current.id,index:desk.info().index});}catch{status.textContent='No s’ha pogut carregar la mostra.';}finally{busy=false;buttons.forEach(b=>b.disabled=false);}}
async function inspect(index){if(busy||!current)return;busy=true;try{await desk.inspect(index);updateInfo();document.querySelector('#inspection-close').focus({preventScroll:true});track('acosta_mostra',{projecte:current.id,index});}finally{busy=false;}}
async function leaveInspection(){if(busy||!current)return;busy=true;try{await desk.leaveInspection();updateInfo();document.querySelector('#sample-inspect').focus({preventScroll:true});}finally{busy=false;}}
document.querySelector('#material-close').addEventListener('click',close);
document.querySelector('#sample-previous').addEventListener('click',()=>sample(-1));document.querySelector('#sample-next').addEventListener('click',()=>sample(1));
document.querySelector('#sample-inspect').addEventListener('click',()=>inspect(0));document.querySelector('#sample-answer').addEventListener('click',()=>inspect(1));
document.querySelector('#inspection-close').addEventListener('click',leaveInspection);document.querySelector('#material-enter').addEventListener('click',()=>track('obre_projecte',{projecte:current?.id}));
document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>{if(!busy&&!current)desk?.moveView(b.dataset.look);}));
document.querySelector('#lamp-toggle').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.setAttribute('aria-label',on?'Apaga el llum de la taula':'Encén el llum de la taula');desk?.setLamp(on);track('llum',{actiu:on});});
document.querySelector('#window-toggle').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.setAttribute('aria-label',on?'Tanca la finestra':'Obre la finestra');desk?.setWindow(on);audio.setWindow(on);track('finestra',{oberta:on});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setList(false);if(current){e.preventDefault();close();}}else if(current&&!e.target.closest('button,a,input')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();sample(e.key==='ArrowLeft'?-1:1);}});
function mountAbout(portal){
  const source=portal.querySelector('#about-dialog'),opener=document.querySelector('#about-open');if(!source||!opener)return;const dialog=source.cloneNode(true);
  dialog.querySelectorAll('[src],[href]').forEach(el=>{for(const key of ['src','href'])if(el.hasAttribute(key))el.setAttribute(key,new URL(el.getAttribute(key),root).href);});
  dialog.querySelectorAll('[data-umami-event]').forEach(el=>{el.dataset.umamiEvent='v3_'+el.dataset.umamiEvent;el.dataset.umamiEventInterficie='escriptori-v2';});document.body.append(dialog);
  dialog.querySelector('#copy-lightning').removeAttribute('data-umami-event');
  opener.addEventListener('click',()=>{dialog.showModal();requestAnimationFrame(()=>dialog.classList.add('is-visible'));track('obre_v4v');});
  let closing=false;async function hide(){if(closing||!dialog.open)return;closing=true;dialog.classList.remove('is-visible');await sleep(220);dialog.close();closing=false;opener.focus();}
  dialog.querySelector('[data-close]').addEventListener('click',hide);dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});dialog.addEventListener('click',e=>{const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)hide();});
  dialog.querySelector('#copy-lightning').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(dialog.querySelector('#lightning-address').textContent);dialog.querySelector('#copy-status').textContent='Adreça copiada.';track('copia_lightning');}catch{dialog.querySelector('#copy-status').textContent='Pots seleccionar i copiar l’adreça.';}});
}
async function start(){
  try{
    let timer;const firstAudio=Promise.race([audio.prepare(),new Promise(r=>timer=setTimeout(r,2500))]).finally(()=>clearTimeout(timer));
    const [{projects:items,portal},manifest]=await Promise.all([loadCatalogue(),fetch(new URL('assets/desk/loading.json?v=1.27.0',root)).then(r=>r.json()),firstAudio]);projects=items;
    mountAbout(portal);
    if(location.hostname==='ortogra.fi'&&location.protocol==='https:'&&!navigator.webdriver){const source=portal.querySelector('script[data-website-id]');if(source){const tracker=source.cloneNode(true);tracker.dataset.tag='escriptori-v3';document.head.append(tracker);}}
    for(const project of projects){
      const button=document.createElement('button');button.className='project-target';button.type='button';button.dataset.project=project.id;button.setAttribute('aria-label',project.name+' · '+project.purpose);button.setAttribute('aria-haspopup','false');project.button=button;
      const hover=()=>{if(current||busy)return;desk?.highlight(project.id);caption.textContent=project.name+' · '+project.purpose;caption.classList.add('visible');};
      button.addEventListener('pointerenter',hover);button.addEventListener('focus',hover);const leave=()=>{desk?.highlight(null);caption.classList.remove('visible');};button.addEventListener('pointerleave',leave);button.addEventListener('blur',leave);button.addEventListener('click',()=>open(project));document.querySelector('#shelf-controls').append(button);
      const link=document.createElement('button');link.type='button';link.textContent=project.name;const small=document.createElement('small');small.textContent=project.purpose;link.append(small);link.addEventListener('click',()=>open(project));document.querySelector('#project-list').append(link);
    }
    loading.update(5,'Carregant l’escriptori de prop…');
    const {createDesk}=await import('./scene.js?v=0.1.1');
    desk=await createDesk({canvas,projects,resources:createResourceLoader(manifest,root,loading.update),onStage:loading.update,onObjectSound:audio.playObject,onAction:track});
    workspace.dataset.ready='true';workspace.setAttribute('aria-busy','false');canvas.removeAttribute('aria-hidden');canvas.tabIndex=0;canvas.setAttribute('aria-label','Arrossega o fes servir les fletxes per mirar al voltant des de la cadira.');audio.start();loading.finish();
  }catch(error){loading.fail();workspace.setAttribute('aria-busy','false');workspace.classList.add('failed');status.textContent='Pots accedir a totes les eines des de la portada.';directLinks();console.error(error);}
}
canvas.addEventListener('webglcontextlost',()=>{workspace.classList.add('failed');directLinks();});
start();
