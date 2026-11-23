// Acoustic material is independent of the shared physical shape/mass category.
export function objectMaterial({kind,node}) {
  if(kind==='pen')return node.name==='LoosePencil'?'pencil':'plastic';
  if(node.name==='SpareFolder'&&kind==='paper')return 'cardboard';
  if(node.name==='PaperClip'||node.name.startsWith('LooseStaple_'))return 'wire';
  return kind;
}

export function soundProfile(action,material) {
  if(action==='staple')return {clips:['stapler'],gain:.9};
  if(action==='crumple')return {clips:['paper-crumple'],gain:.7};
  if(action==='page')return {clips:['page-turn'],gain:.65};
  if(material==='leaf')return {clips:['leaf-brush','leaf-brush-2'],gain:.20,cooldown:.55};
  if(material==='paper')return action==='lift'
    ?{clips:['paper-lift'],gain:.40,cooldown:.16}
    :{clips:['paper-move','paper-move-2'],gain:action==='floor'?.65:action==='slide'?.42:.48,cooldown:action==='slide'?.32:.13};
  if(material==='paperball')return {clips:['paper-roll'],gain:action==='floor'?.55:.24,cooldown:.20};
  if(material==='cardboard')return {clips:['page-turn'],gain:action==='floor'?.6:.32,cooldown:.24};
  if(material==='cloth')return {clips:['cloth-rustle','cloth-rustle-2'],gain:.38,cooldown:.35};
  // Rigid objects are carried above the desk. Lifting them or moving them in
  // mid-air must not replay a landing impact on every drag event.
  if(action==='lift'||action==='slide')return null;
  const floor=action==='floor',touch=action==='touch';
  if(material==='pencil')return {clips:[touch?'pencil-tap':'pencil-drop'],gain:floor?.72:touch?.38:.5};
  if(material==='plastic'||material==='pen')return {clips:touch?['plastic-tap']:['pen-drop','pen-drop-2'],gain:floor?.65:touch?.3:.42};
  if(material==='cup')return {clips:['cup-set'],gain:floor?.6:touch?.22:.40};
  if(material==='tape')return {clips:['tape-set'],gain:floor?.6:touch?.18:.32};
  if(material==='wire')return {clips:['table-tap'],gain:floor?.22:.09};
  if(material==='metal')return {clips:['table-tap'],gain:floor?.7:touch?.28:.42};
  return null;
}
