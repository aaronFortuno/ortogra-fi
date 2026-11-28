import { referenceTime, referenceDate } from '../escriptori/solar.js?v=1.6.1';

export function createCornerLightControls(getDesk,track){
  const panel=document.querySelector('#light-panel'),button=document.querySelector('#light-toggle');
  const day=document.querySelector('#light-date'),time=document.querySelector('#light-time'),range=document.querySelector('#light-hour');
  const reset=document.querySelector('#light-now'),status=document.querySelector('#light-status');
  const format=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  function choose(log=true){
    const date=referenceDate(day.value,time.value);
    if(!date||!day.checkValidity()||!time.checkValidity()){status.textContent='Tria una data i una hora vàlides.';return;}
    if(getDesk()?.setMoment(date)&&log)track('llum_solar',{mode:'manual'});
  }
  function position(){
    if(!panel.matches(':popover-open'))return;
    const anchor=button.getBoundingClientRect(),width=panel.getBoundingClientRect().width;
    panel.style.left=Math.max(14,Math.min(innerWidth-width-14,anchor.right-width))+'px';
    panel.style.bottom=(innerHeight-anchor.top+10)+'px';panel.style.maxHeight=Math.max(72,anchor.top-78)+'px';
  }
  day.addEventListener('change',()=>choose());time.addEventListener('change',()=>choose());
  range.addEventListener('input',()=>{time.value=format(Number(range.value));choose(false);});
  range.addEventListener('change',()=>track('llum_solar',{mode:'manual'}));
  reset.addEventListener('click',()=>{getDesk()?.setMoment(null);track('llum_solar',{mode:'automatic'});});
  panel.querySelector('.light-close').addEventListener('click',()=>{panel.hidePopover();button.focus();});
  panel.addEventListener('toggle',()=>{const open=panel.matches(':popover-open');button.setAttribute('aria-expanded',String(open));if(open){position();track('obre_llum_solar');}});
  window.addEventListener('resize',position);
  return {close:()=>{if(panel.matches(':popover-open'))panel.hidePopover();},update(state){
    const fields=referenceTime(state.date),[hours,minutes]=fields.time.split(':').map(Number);
    if(document.activeElement!==day)day.value=fields.date;
    if(document.activeElement!==time)time.value=fields.time;
    if(document.activeElement!==range)range.value=hours*60+minutes;
    range.setAttribute('aria-valuetext',fields.time);reset.disabled=state.automatic;
    status.textContent=(state.automatic?'Hora actual':'Prova manual')+' · '+fields.time+' · '+state.label;
    button.title='Llum del dia · '+fields.time;button.disabled=false;
  }};
}
