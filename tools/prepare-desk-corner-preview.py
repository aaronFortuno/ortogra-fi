"""Lightweight, actual terrain for the open box in the initial desk view."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
source = root / 'assets/desk/reliefs/agulles-montserrat.glb'
destination = root / 'assets/desk/reliefs/agulles-montserrat-preview.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Desk preview', 'DECIMATE')
    modifier.ratio = .13
    bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_animations=False)
print('Desk preview bytes:', destination.stat().st_size)
