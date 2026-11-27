// Reuse the authored binder geometry for the new Medi project. This keeps
// the existing GLB and its room/animation anchors intact, without a second model.
export function addMonAMaModel(root) {
  const existing=root.getObjectByName('Item_mon-a-ma');
  if(existing)return existing;
  const template=root.getObjectByName('Item_sentit');
  if(!template)throw Error('Falta el model d’arxivador de Món a mà.');
  const group=template.clone(true),materials=new Map();
  group.traverse(node=>{
    node.name=node.name.replace(/_sentit$/, '_mon-a-ma');
    if(!node.isMesh)return;
    const prepare=source=>{
      if(!source.name.startsWith('Cloth_'))return source;
      if(!materials.has(source)){const material=source.clone();material.name='Cloth_mon-a-ma';material.color.set('#667e6d');materials.set(source,material);}
      return materials.get(source);
    };
    node.material=Array.isArray(node.material)?node.material.map(prepare):prepare(node.material);
  });
  group.position.set(.30,.46,-.55);group.rotation.set(0,0,0);root.add(group);
  const box=root.getObjectByName('Item_relleu-obert');
  if(box&&!box.userData.monAMaLayout){box.scale.multiplyScalar(.78);box.position.x=-.79;box.position.y=-.58+.36*.78;box.userData.monAMaLayout=true;}
  return group;
}
