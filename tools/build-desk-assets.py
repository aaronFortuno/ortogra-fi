"""Rebuild the local 3D desk with Blender 5.2.

Run from the repository root.
blender --background --factory-startup --python-exit-code 1 --python tools/build-desk-assets.py
The browser loads the GLB. The editable .blend stays in ignored output/.
"""

import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'assets' / 'desk'
WORK = ROOT / 'output' / 'desk'
DESTINATION.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
random.seed(71)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def xyz(point):
    x, y, z = point
    return (x, -z, y)


def linear_hex(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels) + (1,)


def material(name, color, roughness=.7, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = linear_hex(color)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat


wood = material('Oak', '#d1b187', .68)
wood_image = bpy.data.images.load(str(DESTINATION / 'pbr' / 'oak-color.webp'))
wood_image.pack()
wood_node = wood.node_tree.nodes.new('ShaderNodeTexImage')
wood_node.image = wood_image
wood_uv = wood.node_tree.nodes.new('ShaderNodeUVMap')
wood_uv.uv_map = 'UVMap'
wood.node_tree.links.new(wood_uv.outputs['UV'], wood_node.inputs['Vector'])
wood.node_tree.links.new(wood_node.outputs['Color'], wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
plaster = material('Plaster', '#e9e2d2', .95)
floor_mat = material('Floor', '#b6ad97', .95)
ceramic = material('Ceramic', '#d8d1bd', .57)
paper = material('Paper', '#f6f1e1', .88)
paper_edge = material('PaperEdges', '#e6dfcf', .9)
silver = material('Steel', '#c2c1b6', .25, .9)
dark_metal = material('DarkMetal', '#3a3934', .42, .6)
cavity = material('Cavity', '#20231b', 1)
tape = material('Tape', '#f5edda', .8)
leaf_green = material('Leaves', '#4a6435', .65)
leaf_light = material('LeafLight', '#6c7a42', .67)
stem_mat = material('Stems', '#626339', .8)
soil = material('Soil', '#342b21', 1)
def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    return obj


dynamic = empty('Materials')
room = empty('Room')


def finish(obj, name, mat, position, parent):
    obj.name = name
    obj.parent = parent
    obj.location = xyz(position)
    if mat:
        obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def box(name, dimensions, position, mat, parent=room, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    w, h, d = dimensions
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Soft edges', 'BEVEL')
        modifier.width = min(bevel, min(dimensions) * .42)
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        normal = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    if mat and (mat.name == 'Oak' or mat.name.startswith('Cloth_') or mat.name == 'BoxFabric'):
        # Physical scale, independent of each cube's original packed UV islands.
        # The oak scan covers 1 x 2 m, the book cloth 0.3 x 0.3 m.
        uv = obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
        scale = (6.5, 13) if mat.name == 'Oak' else (1.95, 1.95)
        offset = (random.random(), random.random())
        sizes = list(obj.dimensions)
        for face in obj.data.polygons:
            normal_axis = max(range(3), key=lambda axis: abs(face.normal[axis]))
            axes = sorted((axis for axis in range(3) if axis != normal_axis), key=lambda axis: sizes[axis], reverse=True)
            for loop_index in face.loop_indices:
                point = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (point[axes[0]] / scale[0] + offset[0], point[axes[1]] / scale[1] + offset[1])
    return finish(obj, name, mat, position, parent)


def cylinder(name, radius, height, position, mat, parent=room, bottom=None):
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=bottom or radius,
        radius2=radius, depth=height)
    return finish(bpy.context.object, name, mat, position, parent)


def torus(name, radius, thickness, position, mat, parent, normal='z'):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=10,
        major_radius=radius, minor_radius=thickness)
    obj = finish(bpy.context.object, name, mat, position, parent)
    if normal == 'z':
        obj.rotation_euler.x = math.pi / 2
    return obj


def curve(name, points, thickness, mat, parent=room):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = thickness
    data.bevel_resolution = 2
    data.resolution_u = 12
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for control, position in zip(spline.bezier_points, points):
        control.co = xyz(position)
        control.handle_left_type = control.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    data.materials.append(mat)
    return obj


# Furniture is fully modelled so the viewpoint can move beyond the original crop.
box('BackWall', (23, 12, .18), (0, 2, -1.8), plaster, bevel=.03)
# Leave a real opening; the browser places the garden and moving foliage beyond it.
box('SideWallBelow', (.18, 5.6, 40), (-8.1, -1.2, 17.8), plaster, bevel=.0008)
box('SideWallAbove', (.18, 3.1, 40), (-8.1, 6.45, 17.8), plaster, bevel=.0008)
box('SideWallBehind', (.18, 3.3, 1.75), (-8.1, 3.25, -1.325), plaster, bevel=.0008)
box('SideWallAhead', (.18, 3.3, 35.35), (-8.1, 3.25, 20.125), plaster, bevel=.0008)
box('RightWall', (.18, 12, 40), (8.1, 2, 17.8), plaster, bevel=.0008)
box('Floor', (16.2, .15, 40), (0, -3.78, 17.8), floor_mat, bevel=.0008)
box('Ceiling', (16.2, .15, 40), (0, 8.04, 17.8), plaster, bevel=.0008)
box('Desktop', (15.5, .2, 6.6), (0, -.68, 1.65), wood, bevel=.065)
box('DeskApron', (14.6, .44, .12), (0, -.96, 4.45), wood, bevel=.025)
for x in [-6.8, 6.8]:
    for z in [-.9, 4.1]:
        box('DeskLeg', (.16, 3, .17), (x, -2.2, z), wood, bevel=.025)
box('ShelfBase', (12.2, .16, 1.95), (0, 1.14, -.72), wood, bevel=.025)
box('ShelfTop', (12.2, .13, 1.95), (0, 3.65, -.72), wood, bevel=.022)
for x in [-6, -1.7, .68, 3.2, 6]:
    box('ShelfDivider', (.12, 2.47, 1.94), (x, 2.41, -.72), wood, bevel=.018)
# Pale backing panels and metal wall supports add depth and scale.
box('ShelfBack', (12.05, 2.42, .035), (0, 2.42, -1.68), plaster, bevel=.008)
for x in [-4.7, -.5, 4.6]:
    box('ShelfBracket', (.07, .36, .06), (x, .93, -1.6), dark_metal, bevel=.012)
    box('ShelfBracket', (.07, .055, .62), (x, 1.045, -1.32), dark_metal, bevel=.01)

for y in [1.6, 4.9]:
    box('WindowFrame', (.18, .1, 3), (-7.92, y, 1), wood, bevel=.015)
for z in [-.45, 1, 2.45]:
    box('WindowFrame', (.18, 3.35, .09), (-7.92, 3.25, z), wood, bevel=.014)
box('WindowSill', (.55, .12, 3.25), (-7.75, 1.54, 1), wood, bevel=.025)


def binder(identifier, color, x):
    group = empty('Item_' + identifier, (x, 2.27, -.55), dynamic)
    group['kind'] = 'binder'
    cover = material('Cloth_' + identifier, color, .65)
    liner = material('Liner_' + identifier, '#a5ad92', .9)
    box('Spine_' + identifier, (.45, 2.08, .042), (0, 0, .796), cover, group, .009)
    box('BackCover', (.018, 2.08, 1.55), (-.225, 0, .02), cover, group, .005)
    box('BackLiner', (.005, 2.015, 1.47), (-.212, 0, .012), liner, group, .0015)
    pages = box('Pages_' + identifier, (.345, 1.955, 1.405), (0, 0, .0), paper_edge, group, .012)
    # Individual sheet edges are geometry, shared into the page mesh before export.
    for i in range(8):
        box('PageEdge', (.002, 1.944, 1.395), (-.145 + i * .041, -.002, .007), paper, group, .0008)
    lid = empty('Lid_' + identifier, (.225, 0, .775), group)
    box('FrontCover', (.018, 2.08, 1.55), (0, 0, -.755), cover, lid, .005)
    box('FrontLiner', (.005, 2.015, 1.47), (-.013, 0, -.754), liner, lid, .0015)
    box('LeftPaper', (.009, 1.94, 1.39), (-.023, 0, -.754), paper, lid, .002)
    box('Tape_' + identifier, (.303, 1.42, .008), (0, .12, .818), tape, group, .003)
    hole = cylinder('FingerHole', .066, .06, (0, -.8, .81), cavity, group)
    hole.rotation_euler.x = math.pi / 2
    torus('FingerRim', .074, .009, (0, -.8, .827), silver, group)
    torus('FingerLip', .067, .003, (0, -.8, .832), silver, group)
    box('BottomProtector', (.43, .018, .012), (0, -1.019, .818), silver, group, .004)
    for y in [-.34, .34]:
        ring = torus('RingMechanism', .145, .01, (.02, y, .665), silver, group, normal='y')
        ring.scale.x = 1.4
    box('RingRail', (.08, 1.12, .035), (-.18, 0, .61), silver, group, .009)
    return group


binder('plec', '#36523c', -4.85)
binder('trama', '#36523c', -4.23)
binder('resso', '#36523c', -3.61)
binder('sentit', '#36523c', -2.99)
binder('fil-i-compte', '#aa823c', -.6)

# A box and two closed folders exercise the same catalogue with different objects.
blue = material('BoxFabric', '#53636a', .76)
box_group = empty('Item_relleu-obert', (1.93, 1.62, -.36), dynamic)
box_group['kind'] = 'box'
box('BoxBase', (1.9, .1, 1.4), (0, -.32, 0), blue, box_group, .024)
box('BoxFront', (1.9, .62, .045), (0, -.01, .69), blue, box_group, .012)
box('BoxBack', (1.9, .62, .045), (0, -.01, -.69), blue, box_group, .012)
for x in [-.93, .93]:
    box('BoxSide', (.045, .62, 1.4), (x, -.01, 0), blue, box_group, .012)
box('BoxInside', (1.8, .035, 1.3), (0, -.25, 0), paper, box_group, .008)
box('Tape_relleu-obert', (1.42, .27, .012), (0, -.01, .722), tape, box_group, .004)
lid = empty('Lid_relleu-obert', (0, .33, -.7), box_group)
box('BoxLid', (1.98, .07, 1.48), (0, .0, .7), blue, lid, .024)
box('BoxLidInside', (1.85, .008, 1.35), (0, -.039, .7), paper, lid, .002)


def folder(identifier, color, x, z, angle):
    group = empty('Item_' + identifier, (x, -.49, z), dynamic)
    group.rotation_euler.z = angle
    group['kind'] = 'folder'
    card = material('Card_' + identifier, color, .86)
    box('FolderBack', (1.85, .025, 2.35), (0, -.035, 0), card, group, .009)
    box('FolderPaper', (1.67, .025, 2.13), (.015, -.008, 0), paper, group, .006)
    lid = empty('Lid_' + identifier, (-.925, 0, 0), group)
    box('FolderCover', (1.85, .025, 2.35), (.925, .025, 0), card, lid, .009)
    box('FolderLeftPaper', (1.66, .008, 2.13), (.925, -.039, 0), paper, lid, .002)
    box('FolderTab', (.65, .02, .16), (.1, .025, -1.18), card, group, .012)
    box('Tape_' + identifier, (1.39, .009, .3), (.925, .044, -.81), tape, lid, .003)
    return group


folder('pentagrama', '#ad6245', 4.32, -.32, -.04)
folder('pauta', '#9d9c76', 4.8, 2.68, .11)


# Curved leaves with a centre ridge, a hollow ceramic pot and visible soil.
plant = empty('Pothos', (-6.3, -.56, 2.38), room)
profile = [(0, 0), (.3, 0), (.36, .12), (.4, .65), (.39, .69), (.365, .69), (.36, .12), (0, .07)]
vertices, faces = [], []
for radius, height in profile:
    for i in range(48):
        angle = i * math.tau / 48
        vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
for row in range(len(profile) - 1):
    for i in range(48):
        j = (i + 1) % 48
        faces.append((row * 48 + i, row * 48 + j, (row + 1) * 48 + j, (row + 1) * 48 + i))
mesh = bpy.data.meshes.new('Pot')
mesh.from_pydata(vertices, [], faces)
pot = bpy.data.objects.new('Pot', mesh)
bpy.context.collection.objects.link(pot)
pot.parent = plant
pot.data.materials.append(ceramic)
for polygon in pot.data.polygons:
    polygon.use_smooth = True
cylinder('PotSoil', .36, .03, (0, .61, 0), soil, plant)
for i in range(24):
    azimuth = i * 2.4
    radius = .2 + (i % 4) * .15
    height = .92 + random.random() * 1.15
    center = (math.cos(azimuth) * radius, height, math.sin(azimuth) * radius)
    curve('Stem', [(0, .58, 0), (center[0] * .4, height * .7, center[2] * .4), center], .009, stem_mat, plant)
    leaf_vertices, leaf_faces = [], []
    length = .5 + random.random() * .3
    for row in range(13):
        t = row / 12
        width = math.sin(t * math.pi) ** .7 * length * .34
        for col in range(7):
            side = col / 3 - 1
            leaf_vertices.append((side * width, -length * t,
                math.sin(t * math.pi) * .1 + math.cos(side * math.pi / 2) * .015 - side ** 2 * .045))
    for row in range(12):
        for col in range(6):
            n = row * 7 + col
            leaf_faces.append((n, n + 1, n + 8, n + 7))
    mesh = bpy.data.meshes.new('Leaf')
    mesh.from_pydata(leaf_vertices, [], leaf_faces)
    uv = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv.data[loop_index].uv = (vertex_index % 7 / 6, vertex_index // 7 / 12)
    leaf = bpy.data.objects.new('Leaf', mesh)
    bpy.context.collection.objects.link(leaf)
    leaf.parent = plant
    leaf.location = xyz(center)
    leaf.rotation_euler = (.6 + random.random() * .6, random.random() * .5, azimuth)
    leaf.data.materials.append(leaf_green if i % 3 else leaf_light)
    for polygon in leaf.data.polygons:
        polygon.use_smooth = True

cup = empty('PencilCup', (6.05, -.57, 1.2), room)
cylinder('CupBody', .24, .54, (0, .27, 0), ceramic, cup, bottom=.2)
cylinder('CupInside', .21, .02, (0, .525, 0), cavity, cup)
for i, color in enumerate(['#526844', '#ad744c', '#796d48', '#bb9b53', '#535c65']):
    pencil = empty('Pencil', ((i % 3 - 1) * .095, .17, (i % 2 - .5) * .12), cup)
    pencil.rotation_euler.y = (i - 2) * .075
    pencil_material = material('PencilColor_' + str(i), color, .57)
    shaft = cylinder('PencilShaft', .025, .96, (0, .48, 0), pencil_material, pencil)
    tip = cylinder('PencilWood', .001, .12, (0, 1.02, 0), wood, pencil, bottom=.025)
    cylinder('Graphite', .001, .025, (0, 1.09, 0), dark_metal, pencil, bottom=.007)


def bake_ambient():
    static_meshes = []
    for obj in list(room.children_recursive):
        if obj.type == 'CURVE':
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
        if obj.type == 'MESH':
            static_meshes.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in static_meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = static_meshes[0]
    bpy.ops.object.join()
    surface = bpy.context.object
    surface.name = 'RoomSurfaces'
    for slot in surface.material_slots:
        slot.material = slot.material.copy()
        slot.material.name += '_Room'
    uv = surface.data.uv_layers.new(name='AmbientUV')
    surface.data.uv_layers.active = uv
    uv.active_render = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    image = bpy.data.images.new('DeskAmbient', 2048, 2048, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    for mat in surface.data.materials:
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        mat.node_tree.nodes.active = node
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.bake.margin = 8
    for obj in dynamic.children_recursive:
        obj.hide_render = True
    bpy.ops.object.bake(type='AO', uv_layer='AmbientUV')
    image.filepath_raw = str(WORK / 'ambient.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    # glTF exports this named group as the material's occlusion texture.
    settings = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    settings.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for mat in surface.data.materials:
        nodes = mat.node_tree.nodes
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        coords = nodes.new('ShaderNodeUVMap')
        coords.uv_map = 'AmbientUV'
        mat.node_tree.links.new(coords.outputs['UV'], texture.inputs['Vector'])
        output = nodes.new('ShaderNodeGroup')
        output.node_tree = settings
        mat.node_tree.links.new(texture.outputs['Color'], output.inputs['Occlusion'])
    for obj in dynamic.children_recursive:
        obj.hide_render = False
    surface.data.uv_layers.active_index = 0
    surface.data.uv_layers[0].active_render = True


bake_ambient()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'escriptori.blend'))
bpy.ops.export_scene.gltf(filepath=str(DESTINATION / 'escriptori.glb'),
    export_format='GLB', export_apply=True, export_extras=True, export_image_format='JPEG',
    export_jpeg_quality=85, export_cameras=False, export_lights=False)
print('DESK_ASSET_READY', DESTINATION / 'escriptori.glb')
