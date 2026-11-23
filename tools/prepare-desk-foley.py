"""Run with Blender --background --factory-startup --python this_file.

Inputs: public CC0 HQ previews in tmp/desk/audio-sources/*-new.mp3.
No time stretching, synthesized layers or noise replacement.
"""
import hashlib,json,math
from pathlib import Path
import aud,numpy as np

root=Path(__file__).resolve().parents[1]
inputs=root/'tmp/desk/audio-sources'
dest=root/'assets/desk/audio/foley'
dest.mkdir(parents=True,exist_ok=True)
sources={
 'stapler':('simone_ds','stapler.wav',366080,6040409),
 'crumple':('Anthousai','paper - crumple 02.wav',398897,5923045),
 'page':('OwlStorm','Page Turn (1)',151220,140737),
 'tap':('zembacraftworks','Tap on Wooden Table',427393,8617763),
 'pen':('ervintracks','Pencil Drop',567435,8646874),
 'plastic':('krb21','tossing pen down.WAV',118618,1269383),
 'paper-slide':('Kingofgamers_cz','Paper slide',352914,1766783),
 'leaf':('Anthousai','plant - quince tree - shaking a small quince tree 01.wav',399246,5923045),
 'cloth':('IENBA','Soft Fabric Rustle',850705,9616576),
 'ceramic':('Jamitch2','Ceramic_Mug_Cup.wav',344704,5138426),
}
entries=[('stapler','stapler',.27,.85),('paper-crumple','crumple',.08,1.22),('paper-roll','crumple',.50,.92),
 ('page-turn','page',0,.55),('table-tap','tap',.10,.50),('pencil-drop','pen',0,.70),('pencil-tap','pen',0,.18),
 ('pen-drop','plastic',3.65,4.36),('pen-drop-2','plastic',14.55,15.25),('plastic-tap','plastic',7.72,8.08),
 ('tape-set','plastic',5.45,6.05),('paper-move','paper-slide',.03,.58),('paper-move-2','paper-slide',.35,.94),
 ('paper-lift','page',0,.50),('leaf-brush','leaf',.30,.98),('leaf-brush-2','leaf',3.25,3.96),
 ('cloth-rustle','cloth',1.65,2.55),('cloth-rustle-2','cloth',6.45,7.12),('cup-set','ceramic',.14,.78)]
soft={'paper-move','paper-move-2','paper-lift','leaf-brush','leaf-brush-2','cloth-rustle','cloth-rustle-2'}
manifest={'version':2,'license':'https://creativecommons.org/publicdomain/zero/1.0/','sources':{},'clips':[]}
for key,(creator,title,sound,user) in sources.items():
 data=(inputs/(key+'-new.mp3')).read_bytes()
 manifest['sources'][key]={'creator':creator,'title':title,'url':f'https://freesound.org/people/{creator}/sounds/{sound}/',
  'preview':f'https://cdn.freesound.org/previews/{sound//1000}/{sound}_{user}-hq.mp3','sha256':hashlib.sha256(data).hexdigest()}
for name,key,start,end in entries:
 length=end-start
 sound=aud.Sound.file(str(inputs/(key+'-new.mp3'))).limit(start,end).rechannel(aud.CHANNELS_MONO).highpass(65,.707)
 lowpass=4800 if key=='leaf' else 6000 if key in {'paper-slide','cloth'} else 2200 if name=='tape-set' else None
 if lowpass:sound=sound.lowpass(lowpass,.707)
 fadein,fadeout=(.035,.07) if name in soft else (.004,.025)
 sound=sound.fadein(0,fadein).fadeout(length-fadeout,fadeout)
 samples=sound.data().ravel().astype(np.float64)
 rms=float(np.sqrt(np.mean(samples*samples)));peak=float(np.max(np.abs(samples)))
 target=-28 if key=='leaf' else -27 if key in {'paper-slide','cloth'} else -24
 gain=min(10**(target/20)/max(rms,1e-12),10**(-10/20)/max(peak,1e-12))
 path=dest/(name+'.mp3')
 sound.volume(gain).write(str(path),44100,aud.CHANNELS_MONO,aud.FORMAT_S16,aud.CONTAINER_MP3,aud.CODEC_MP3,96000,16384)
 decoded=aud.Sound.file(str(path)).data().ravel().astype(np.float64)
 assert np.isfinite(decoded).all() and np.max(np.abs(decoded))<.5
 entry={'id':name,'file':path.name,'source':key,'start':start,'end':end,'gainDb':round(20*math.log10(gain),3),
  'highpassHz':65,'lowpassHz':lowpass,'fadeInSeconds':fadein,'fadeOutSeconds':fadeout,
  'duration':len(decoded)/44100,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
  'rmsDbFS':round(20*math.log10(max(float(np.sqrt(np.mean(decoded**2))),1e-12)),2),
  'peakDbFS':round(20*math.log10(max(float(np.max(np.abs(decoded))),1e-12)),2)}
 manifest['clips'].append(entry)
 print(name,entry['bytes'],entry['duration'],entry['peakDbFS'])
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
