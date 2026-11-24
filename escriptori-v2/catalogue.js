const descriptors=[['plec','Plec','Dictats','binder'],['trama','Trama','Comprensió lectora','binder'],['resso','Ressò','Lectura en veu alta','binder'],['sentit','Sentit','Comprensió oral','binder'],['fil-i-compte','Fil i Compte','Problemes','binder'],['relleu-obert','Relleu Obert','Maquetes 3D','box'],['pentagrama','Pentagrama','Paper de música','folder'],['pauta','Pauta','Paper pautat','folder']];
export async function loadCatalogue(){
  const base=new URL('../',import.meta.url),[html,examples,reliefs]=await Promise.all([
    fetch(base).then(r=>{if(!r.ok)throw Error('Catàleg no disponible');return r.text();}),
    fetch(new URL('assets/desk/samples/examples.json?v=1.11.0',base)).then(r=>r.json()),
    fetch(new URL('assets/desk/reliefs/manifest.json',base)).then(r=>r.json()),
  ]);
  const portal=new DOMParser().parseFromString(html,'text/html');
  const projects=descriptors.map(([id,name,purpose,kind])=>{
    const domain=id==='pentagrama'?'pentagrama.page':id==='fil-i-compte'?'filicompte.ortogra.fi':id==='relleu-obert'?'relleu.ortogra.fi':id+'.ortogra.fi';
    const link=[...portal.querySelectorAll('.project-link')].find(a=>new URL(a.href).hostname===domain);if(!link)throw Error('Falta '+name);
    const svg=link.querySelector('svg'),img=link.querySelector('img.project-symbol');let logo;
    if(svg){const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('fill','none');copy.setAttribute('stroke','#2d493a');copy.setAttribute('stroke-width','1.8');logo='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(copy.outerHTML);}
    else if(img)logo=new URL(img.getAttribute('src'),base).href;
    return {id,name,purpose,kind,href:link.href,description:link.querySelector('.project-copy>p').textContent,logo,
      examples:examples[id],reliefs:kind==='box'?reliefs.models:null};
  });
  return {projects,portal};
}
