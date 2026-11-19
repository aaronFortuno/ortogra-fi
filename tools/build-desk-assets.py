"""Rebuild the local 3D desk with Blender 5.2.

Run from the repository root.
blender --background --factory-startup --python-exit-code 1 --python tools/build-desk-assets.py
The browser loads the GLB. The editable .blend stays in ignored output/.
"""

import math
import random
import tempfile
from pathlib import Path

import bpy
import bmesh
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'assets' / 'desk'
WORK = ROOT / 'output' / 'desk'
DESTINATION.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
# Blender's image exporter needs a writable temporary directory on Windows.
# Keep it local instead of relying on a protected AppData temporary directory.
(WORK / 'tmp').mkdir(parents=True, exist_ok=True)
tempfile.tempdir = str(WORK / 'tmp')
bpy.context.preferences.filepaths.temporary_directory = str(WORK / 'tmp')
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
cover_wear = material('ExposedBinderBoard', '#b5ac8e', .96)
leaf_green = material('Leaves', '#4a6435', .65)
leaf_light = material('LeafLight', '#6c7a42', .67)
stem_mat = material('Stems', '#626339', .8)
soil = material('Soil', '#342b21', 1)


def mesh_object(name, vertices, faces, mat, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    if mat:
        mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj
def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    return obj


dynamic = empty('Materials')
room = empty('Room')
living = empty('LivingDetails')


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
box('SideWallAhead', (.18, 3.3, 33.35), (-8.1, 3.25, 21.125), plaster, bevel=.0008)
box('RightWall', (.18, 12, 40), (8.1, 2, 17.8), plaster, bevel=.0008)
box('Floor', (16.2, .15, 40), (0, -3.78, 17.8), floor_mat, bevel=.0008)
box('Ceiling', (16.2, .15, 40), (0, 8.04, 17.8), plaster, bevel=.0008)
box('Desktop', (15.5, .2, 6.6), (0, -.68, 1.65), wood, bevel=.065)
box('DeskApron', (14.6, .44, .12), (0, -.96, 4.45), wood, bevel=.025)
for x in [-6.8, 6.8]:
    for z in [-.9, 4.1]:
        box('DeskLeg', (.16, 3, .17), (x, -2.2, z), wood, bevel=.025)
box('OrganizerWallRail', (12.2, .13, .12), (0, 1.85, -1.61), wood, bevel=.018)
for x in [-6, -1.7, .68, 3.2, 6]:
    box('ShelfDivider', (.12, 2.47, 1.94), (x, .61, -.72), wood, bevel=.018)
    # Small fixing plates sit against the wall; no floating support below a shelf.
    box('OrganizerFixing', (.20, .24, .016), (x, 1.60, -1.64), dark_metal, bevel=.008)
    for height in [1.53, 1.67]:
        screw = cylinder('OrganizerScrew', .017, .012, (x + .071, height, -1.625), silver)
        screw.rotation_euler.x = math.pi / 2
box('ShelfBack', (12.05, 2.42, .035), (0, .62, -1.68), wood, bevel=.008)

for y in [1.6, 4.9]:
    box('WindowFrame', (.18, .1, 5), (-7.92, y, 2), wood, bevel=.015)
for z in [-.45, 2, 4.45]:
    box('WindowFrame', (.18, 3.35, .09), (-7.92, 3.25, z), wood, bevel=.014)
box('WindowSill', (.55, .12, 5.25), (-7.75, 1.54, 2), wood, bevel=.025)
window_opening = empty('WindowOpening', (-8.1, 3.25, 2), room)
window_opening['width'] = 4.9
window_opening['height'] = 3.3
window_opening['zMinimum'] = -.45
window_opening['zMaximum'] = 4.45

# The wall switch remains separate from the baked room so the browser can hit
# its physical face and tilt the rocker. Its front normal points into the room.
switch = empty('RoomLightSwitch', (-6.9, 1.72, -1.67), living)
switch['faceWidth'] = .32
switch['faceHeight'] = .44
switch['faceNormal'] = '+Z'
switch_plastic = material('SwitchPlastic', '#e8e5d9', .36)
switch_recess = material('SwitchRecess', '#5c5d55', .8)
box('SwitchMount', (.32, .44, .07), (0, 0, 0), switch_plastic, switch, .016)
box('SwitchRecess', (.237, .347, .008), (0, 0, .039), switch_recess, switch, .009)
rocker = empty('SwitchRocker', (0, 0, .050), switch)
rocker.rotation_euler.x = .045
box('SwitchRockerFace', (.21, .319, .031), (0, 0, 0), switch_plastic, rocker, .01)
for y in [-.188, .188]:
    screw = cylinder('SwitchFixingScrew', .009, .004, (0, y, .038), silver, switch)
    screw.rotation_euler.x = math.pi / 2


def binder(identifier, color, x, lean=0, yaw=0, depth=-.55):
    # Stand directly on the desktop, including when the binder leans.
    height = 1.228 - 1.8 + 1.04 * math.cos(lean) + .225 * abs(math.sin(lean))
    group = empty('Item_' + identifier, (x, height, depth), dynamic)
    group.rotation_euler.y = -lean
    group.rotation_euler.z = yaw
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
    # Tiny, irregular chips reveal the board where the cloth meets a spine edge.
    # They remain on the actual object when it travels to the table.
    for side, end, size in [(-1, -1, .037), (1, -1, .027), (-1, 1, .022)]:
        origin_x, origin_y = side * .219, end * 1.021
        points = [(0, 0), (-side * size, 0), (-side * size * .62, -end * size * .48),
                  (-side * size * .30, -end * size * 1.5), (0, -end * size * 1.9)]
        vertices = [xyz((origin_x + x, origin_y + y, .8185)) for x, y in points]
        mesh_object('SpineCornerWear_' + identifier, vertices, [tuple(range(len(vertices)))], cover_wear, group)
    for y in [-.34, .34]:
        ring = torus('RingMechanism', .145, .01, (.02, y, .665), silver, group, normal='y')
        ring.scale.x = 1.4
    box('RingRail', (.08, 1.12, .035), (-.18, 0, .61), silver, group, .009)
    return group


binder('plec', '#36523c', -5.51, lean=.15, yaw=.018, depth=-.54)
binder('trama', '#36523c', -4.82, lean=.035, yaw=-.026, depth=-.61)
binder('resso', '#36523c', -4.06, lean=-.11, yaw=.012, depth=-.50)
binder('sentit', '#36523c', -3.37, lean=.11, yaw=-.018, depth=-.62)
binder('fil-i-compte', '#aa823c', -2.55, lean=-.065, yaw=-.018, depth=-.51)

# A box and two closed folders exercise the same catalogue with different objects.
blue = material('BoxFabric', '#53636a', .76)
box_group = empty('Item_relleu-obert', (-.6, 1.62 - 1.8, -.36), dynamic)
box_group.rotation_euler.z = .04
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


folder('pentagrama', '#ad6245', 2, -.45, -.075)
folder('pauta', '#9d9c76', 3.25, 1.5, .17)

# The final slot is reserved for future materials. This unlabelled, closed
# folder is scenery, with no Item_/Lid_ prefix and no invented project.
spare = empty('SpareFolder', (4.65, -.548, -.72), room)
spare.rotation_euler.z = .05
spare_card = material('SpareFolderCard', '#a39679', .94)
box('SpareFolderBack', (2.1, .014, 1.45), (0, -.015, 0), spare_card, spare, .005)
box('SpareFolderPaper', (1.98, .012, 1.34), (.018, 0, .008), paper_edge, spare, .003)
box('SpareFolderCover', (2.1, .014, 1.45), (0, .016, 0), spare_card, spare, .005)

# The centre stays empty for the opened samples. Lived-in stationery sits to the
# left of that working area, rather than in front of an interactive resource.
notes = empty('DeskNotes', (-4.65, -.575, 3.5), room)
for i, (angle, dx, dz) in enumerate([
        (-.105, -.08, -.075), (.075, .12, -.045), (-.032, -.035, .12),
        (.145, .10, .035), (-.045, -.015, .015)]):
    vertices, faces = [], []
    for row in range(22):
        z = -1.025 + 2.05 * row / 21
        for col in range(16):
            x = -.725 + 1.45 * col / 15
            corner = max(0, (x + .45) / 1.175) * max(0, (z - .45) / .575)
            lift = (.055 if i == 4 else .012) * corner ** 3
            vertices.append(xyz((x, lift + math.sin(z * 3 + i) * .0015, z)))
    for row in range(21):
        for col in range(15):
            n = row * 16 + col
            faces.append((n, n + 16, n + 17, n + 1))
    sheet = mesh_object('LooseWorksheet', vertices, faces, paper, notes)
    sheet.location = xyz((dx, i * .0038, dz))
    sheet.rotation_euler.z = angle
    thickness = sheet.modifiers.new('Paper thickness', 'SOLIDIFY')
    thickness.thickness = .0016
    bpy.context.view_layer.objects.active = sheet
    bpy.ops.object.modifier_apply(modifier=thickness.name)
curve('PaperClip', [(-.56, .017, -.75), (-.56, .017, -.48), (-.44, .017, -.48), (-.44, .017, -.78), (-.52, .017, -.78), (-.52, .017, -.54)], .0035, silver, notes)
loose_pencil = empty('LoosePencil', (-5.6, -.553, 1.6), room)
loose_pencil.rotation_euler.x = math.pi / 2
loose_pencil.rotation_euler.z = -.35
cylinder('LoosePencilBody', .024, .96, (0, .48, 0), material('LoosePencilPaint', '#a5793d', .65), loose_pencil)
cylinder('LoosePencilWood', .001, .12, (0, 1.02, 0), wood, loose_pencil, bottom=.024)
cylinder('LoosePencilGraphite', .001, .026, (0, 1.09, 0), dark_metal, loose_pencil, bottom=.006)


stapler = empty('DeskStapler', (-6.83, -.58, .61), room)
stapler.rotation_euler.z = -.61
stapler_plastic = material('StaplerEnamel', '#415b55', .37)
rubber = material('StationeryRubber', '#30312d', .91)
box('StaplerFoot', (.38, .028, .91), (0, .014, 0), rubber, stapler, .022)
box('StaplerBase', (.355, .045, .88), (0, .043, 0), stapler_plastic, stapler, .025)
box('StaplerAnvil', (.22, .009, .15), (0, .07, .315), silver, stapler, .007)
for x in [-.035, .035]:
    curve('StapleGroove', [(x - .018, .075, .29), (x, .075, .315), (x + .018, .075, .29)], .0014, dark_metal, stapler)
magazine = box('StapleMagazine', (.254, .041, .68), (0, .152, .005), silver, stapler, .007)
magazine.rotation_euler.x = -.115
# The hinge is carried by two folded ears on the base. The steel nose sits
# directly over the anvil, leaving daylight through the throat.
for side in [-.119, .119]:
    box('StaplerPivotEar', (.026, .11, .105), (side, .112, -.345), silver, stapler, .012)
box('StaplerDriver', (.225, .052, .043), (0, .177, .324), silver, stapler, .004)
profile = [(-.405, .134), (-.411, .206), (-.372, .246), (-.27, .271), (-.08, .294),
           (.13, .305), (.26, .299), (.343, .279), (.365, .247), (.365, .211), (.30, .204)]
vertices = [xyz((side, height, depth)) for side in [-.162, .162] for depth, height in profile]
faces = [tuple(reversed(range(len(profile)))), tuple(range(len(profile), len(profile) * 2))]
for i in range(len(profile)):
    j = (i + 1) % len(profile)
    faces.append((i, j, len(profile) + j, len(profile) + i))
upper = mesh_object('StaplerUpper', vertices, faces, stapler_plastic, stapler)
bevel = upper.modifiers.new('Moulded plastic edges', 'BEVEL')
bevel.width = .018
bevel.segments = 3
bpy.context.view_layer.objects.active = upper
bpy.ops.object.modifier_apply(modifier=bevel.name)
# Preserve planar cheeks and the straight mould line along the handle.
normal = upper.modifiers.new('Planar moulded faces', 'WEIGHTED_NORMAL')
normal.keep_sharp = True
bpy.ops.object.modifier_apply(modifier=normal.name)
hinge = cylinder('StaplerHinge', .024, .348, (0, .15, -.345), silver, stapler)
hinge.rotation_euler.y = math.pi / 2


def annulus(name, outer, inner, height, mat, parent, y=0):
    vertices, faces = [], []
    for radius, level in [(outer, 0), (outer, height), (inner, height), (inner, 0)]:
        for i in range(64):
            angle = i * math.tau / 64
            vertices.append(xyz((radius * math.cos(angle), level + y, radius * math.sin(angle))))
    for row in range(4):
        next_row = (row + 1) % 4
        for i in range(64):
            j = (i + 1) % 64
            faces.append((row * 64 + i, row * 64 + j, next_row * 64 + j, next_row * 64 + i))
    return mesh_object(name, vertices, faces, mat, parent)


adhesive = material('AdhesiveFilm', '#d9c797', .32)
cardboard = material('TapeCardboard', '#ab8b69', .94)
tape_roll = empty('DeskTapeRoll', (-6.78, -.58, 1.87), room)
tape_roll.rotation_euler.z = .3
roll = annulus('TapeRoll', .235, .145, .145, adhesive, tape_roll)
core = annulus('TapeCore', .146, .125, .148, cardboard, tape_roll, 0)
for ring in [roll, core]:
    # Split the end faces from the barrel. Smooth normals across this right
    # angle made the reel look inflated and rounded the hole in the core.
    for polygon in ring.data.polygons:
        polygon.use_smooth = abs(polygon.normal.z) < .5
    for edge in ring.data.edges:
        a, b = [ring.data.vertices[index].co for index in edge.vertices]
        edge.use_edge_sharp = abs(a.z - b.z) < .0001
    mesh = ring.data
    radial_uv = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            point = mesh.vertices[mesh.loops[loop].vertex_index].co
            radial_uv.data[loop].uv = (.5 + point.x, .5 + point.y)
# The free strip peels off the outside barrel tangentially at full roll width.
tail = material('TapeFreeFilm', '#ebe1c5', .24)
vertices = [xyz((.235 - .05 * (i / 7) ** 2, h + .009 * math.sin(i * math.pi / 7), .032 * i))
            for i in range(8) for h in [.003, .145]]
faces = [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(7)]
mesh_object('TapeLooseEnd', vertices, faces, tail, tape_roll)


case_cloth = material('Cloth_PencilCase', '#51616c', .92)
case_lining = material('CaseLining', '#adac99', .95)
case_piping = material('CasePiping', '#394853', .76)
pen_case = empty('OpenPencilCase', (6.5, -.578, 3.8), room)
pen_case.rotation_euler.z = -.115
box('CaseBottom', (1.46, .055, .74), (0, .03, 0), case_cloth, pen_case, .055)
box('CaseLining', (1.35, .018, .64), (0, .065, 0), case_lining, pen_case, .025)
for z in [-.35, .35]:
    box('CaseLongSide', (1.4, .13, .047), (0, .11, z), case_cloth, pen_case, .02)
for x in [-.7, .7]:
    box('CaseEnd', (.047, .13, .64), (x, .11, 0), case_cloth, pen_case, .02)
case_lid = empty('PencilCaseLid', (0, .16, -.35), pen_case)
case_lid.rotation_euler.x = -math.pi * .68
box('CaseLid', (1.43, .05, .69), (0, .015, .335), case_cloth, case_lid, .035)
box('CaseLidLining', (1.33, .012, .59), (0, -.017, .335), case_lining, case_lid, .025)
for parent, y in [(pen_case, .178), (case_lid, -.024)]:
    z0, z1 = (-.32, .32) if parent == pen_case else (.025, .645)
    edge = [(-.65, y, z0), (.65, y, z0), (.69, y, z0 + .05), (.69, y, z1 - .05),
            (.65, y, z1), (-.65, y, z1), (-.69, y, z1 - .05), (-.69, y, z0 + .05), (-.65, y, z0)]
    curve('CaseZipperRim', edge, .008, case_piping, parent)
    for z in [z0, z1]:
        for i in range(19):
            box('ZipperTooth', (.026, .008, .014), (-.61 + i * .068, y + .003, z), silver, parent, .002)
curve('ZipperPull', [(.62, .185, .28), (.7, .19, .27), (.735, .19, .32), (.70, .19, .36), (.64, .185, .33)], .007, silver, pen_case)


# Unbranded, hexagonal clear-barrel ballpoints with an ink cartridge, a coloured
# push-fit cap and a small metal nib. No logotype or proprietary geometry.
clear_barrel = material('ClearPenPlastic', '#dedccf', .17)
clear_barrel.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .36
clear_barrel.diffuse_color = (.78, .78, .72, .36)
clear_barrel.surface_render_method = 'DITHERED'
pen_tip = material('PenTipPlastic', '#c4b896', .25)


def ballpoint(name, position, angle, color, parent):
    group = empty(name, position, parent)
    group.rotation_euler = (0, math.pi / 2, angle)
    ink = material(name + 'Ink', color, .3)
    # Cone primitive along the local vertical; the enclosing group lays it flat.
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.023, depth=.88)
    finish(bpy.context.object, 'PenBarrel', clear_barrel, (0, .57, 0), group)
    cylinder('InkCartridge', .005, .89, (0, .55, 0), ink, group)
    cylinder('PenNose', .022, .095, (0, .104, 0), pen_tip, group, bottom=.009)
    cylinder('PenMetalNib', .009, .035, (0, .04, 0), silver, group, bottom=.0015)
    cylinder('PenCap', .029, .20, (0, 1.055, 0), ink, group, bottom=.023)
    cylinder('PenCapCrown', .021, .018, (0, 1.162, 0), ink, group, bottom=.027)
    box('PenCapClip', (.012, .145, .012), (0, 1.045, .038), ink, group, .005)
    return group


for i, color in enumerate(['#304c7b', '#292c2c', '#923e39', '#3e664f']):
    ballpoint('CaseBallpoint_' + str(i), (-.59 + (i % 2) * .045, .107 + i * .004, -.235 + i * .145),
              -.055 + i * .037, color, pen_case)
ballpoint('LooseBallpoint', (5.8, -.546, 4.55), -.24, '#304c7b', room)


# Separate leaves retain the IndoorLeaf_ names used by the browser's gentle
# sway. Veins and petioles move with each blade instead of floating above it.
plant = empty('Pothos', (-6.65, -.56, 3.1), living)
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
torus('PotRim', .378, .012, (0, .68, 0), ceramic, plant, normal='y')
soil_pebble = material('SoilPerlite', '#968571', 1)
for i in range(34):
    angle = random.random() * math.tau
    radius = .335 * math.sqrt(random.random())
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.008 + random.random() * .009)
    pebble = finish(bpy.context.object, 'PotSoilGrain', soil_pebble if i % 5 == 0 else soil,
                   (math.cos(angle) * radius, .632, math.sin(angle) * radius), plant)
    pebble.scale.z = .45

leaf_palette = ['#506a32', '#3c5d2b', '#5d763e', '#4c6f37', '#6e8348']
leaf_materials = [material('IndoorFoliage_' + str(i), color, .49 + i * .024)
                  for i, color in enumerate(leaf_palette)]
leaf_veins = material('IndoorLeafVeins', '#91a267', .75)
leaf_random = random.Random(712)
curve('PlantGrowingShoot', [(0, .59, 0), (-.06, 1.08, .035), (-.13, 1.54, .03), (-.17, 1.91, .11)], .009, stem_mat, plant)
curve('PlantSideShoot', [(0, .59, 0), (.12, .94, -.08), (.16, 1.38, -.16)], .008, stem_mat, plant)
curve('PlantTrailingVine', [(-.04, .61, .04), (-.30, 1.0, .16), (-.57, .87, .35), (-.82, .53, .57)], .008, stem_mat, plant)
for i in range(26):
    azimuth = i * 2.39996 + leaf_random.uniform(-.16, .16)
    radius = .12 + (i % 5) * .075
    height = .94 + leaf_random.random() * .94
    if i < 18:
        base = (-.14 + math.cos(azimuth) * radius, height, .03 + math.sin(azimuth) * radius)
        node = (base[0] * .36, .60 + (height - .60) * .72, base[2] * .36)
        direction_x, direction_z = math.cos(azimuth), math.sin(azimuth)
        # Favour the window; a few outward leaves should not mask the left binder.
        if direction_x > .5:
            direction_x, direction_z = .22, math.copysign(.72, direction_z or 1)
        direction_down = leaf_random.uniform(-.36, .16)
        length = .45 + leaf_random.random() * .30
    else:
        along = (i - 18) / 7
        base = (-.24 - along * .57, .98 - along * .39, .13 + along * .43)
        node = (base[0] + .08, base[1] + .045, base[2] - .035)
        direction_x, direction_z = -.38 - along * .18, (-1 if i % 2 else 1) * .75
        direction_down = -.16 - along * .30
        length = .40 + leaf_random.random() * .20
    width_ratio = .27 + leaf_random.random() * .09
    twist = leaf_random.uniform(-.055, .055)
    middle = ((node[0] + base[0]) * .5, (node[1] + base[1]) * .5 + .035, (node[2] + base[2]) * .5)
    curve('PlantPetiole', [node, middle, base], .005 + leaf_random.random() * .002, stem_mat, plant)

    def leaf_point(t, side):
        width = math.sin(t * math.pi) ** .62 * length * width_ratio
        width *= 1 + .25 * math.exp(-((t - .22) / .18) ** 2)
        x = side * width * (1 + .1 * math.sin(t * 5.2 + i))
        y = -length * t + .11 * length * side ** 2 * math.sin(t * math.pi) * math.exp(-t * 3)
        z = length * (.12 * math.sin(t * math.pi) - .24 * t ** 3 + .043 * side ** 2) + twist * side * t
        return (x, y, z)

    vertices = [leaf_point(row / 18, col / 5 - 1) for row in range(19) for col in range(11)]
    faces = []
    for row in range(18):
        for col in range(10):
            n = row * 11 + col
            faces.append((n, n + 1, n + 12, n + 11))
    leaf = mesh_object('IndoorLeaf_' + str(i), vertices, faces, leaf_materials[i % len(leaf_materials)], plant)
    leaf.location = xyz(base)
    direction = Vector((direction_x, direction_z, direction_down)).normalized()
    leaf.rotation_mode = 'QUATERNION'
    leaf.rotation_quaternion = Quaternion(direction, leaf_random.uniform(-.30, .30)) @ Vector((0, -1, 0)).rotation_difference(direction)
    uv = leaf.data.uv_layers.new(name='UVMap')
    for polygon in leaf.data.polygons:
        for loop_index in polygon.loop_indices:
            index = leaf.data.loops[loop_index].vertex_index
            uv.data[loop_index].uv = (index % 11 / 10, index // 11 / 18)
    # Vertex tints vary softly across one blade; geometry carries the raised vein.
    colors = leaf.data.color_attributes.new(name='LeafTint', type='BYTE_COLOR', domain='CORNER')
    shade = linear_hex(leaf_palette[i % len(leaf_palette)])
    for polygon in leaf.data.polygons:
        for loop_index in polygon.loop_indices:
            index = leaf.data.loops[loop_index].vertex_index
            side = abs(index % 11 / 5 - 1)
            along = index // 11 / 18
            value = .83 + .15 * math.sin(math.pi * along) + .03 * side
            colors.data[loop_index].color = (shade[0] * value, shade[1] * value, shade[2] * value, 1)
    mat = leaf.active_material
    if not mat.node_tree.nodes.get('LeafTint'):
        tint = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        tint.name = 'LeafTint'
        tint.layer_name = 'LeafTint'
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (1, 1, 1, 1)
        mat.node_tree.links.new(tint.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    # Curves take world-style xyz points; convert the blade's local Blender points
    # back once so the curve helper preserves their local coordinate system.
    def vein_curve(name, points, thickness):
        local = [(p[0], p[2] + .0015, -p[1]) for p in points]
        obj = curve(name, local, thickness, leaf_veins, leaf)
        obj.data.bevel_resolution = 0
        obj.data.resolution_u = 4
    vein_curve('LeafMidrib', [leaf_point(t, 0) for t in [.04, .3, .58, .82, .98]], .0018)
    for t in [.2, .36, .52, .68, .82]:
        for side in [-1, 1]:
            vein_curve('LeafSideVein', [leaf_point(t, 0), leaf_point(t + .05, side * .5), leaf_point(t + .105, side * .92)], .00075)


# Bake the little vein tubes into each blade, keeping only two primitives per
# moving leaf instead of hundreds of independent draw calls in the browser.
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
for leaf in [obj for obj in plant.children if obj.name.startswith('IndoorLeaf_')]:
    original = leaf.data
    vertices = [tuple(vertex.co) for vertex in original.vertices]
    faces = [tuple(polygon.vertices) for polygon in original.polygons]
    blade_faces = len(faces)
    blade_colors = [tuple(color.color) for color in original.color_attributes['LeafTint'].data]
    blade_uvs = [tuple(loop.uv) for loop in original.uv_layers['UVMap'].data]
    for vein in list(leaf.children):
        evaluated = vein.evaluated_get(depsgraph)
        tube = evaluated.to_mesh()
        start = len(vertices)
        vertices.extend(tuple(vein.matrix_local @ vertex.co) for vertex in tube.vertices)
        faces.extend(tuple(start + index for index in polygon.vertices) for polygon in tube.polygons)
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(vein, do_unlink=True)
    combined = bpy.data.meshes.new(leaf.name + 'Detailed')
    combined.from_pydata(vertices, [], faces)
    combined.materials.append(original.materials[0])
    combined.materials.append(leaf_veins)
    colors = combined.color_attributes.new(name='LeafTint', type='BYTE_COLOR', domain='CORNER')
    # Keep clean, normalised blade UVs for the browser's subtle colour/normal maps.
    # The separately shaded vein primitive does not use the leaf texture.
    uv = combined.uv_layers.new(name='UVMap')
    for index, color in enumerate(colors.data):
        color.color = blade_colors[index] if index < len(blade_colors) else (1, 1, 1, 1)
        uv.data[index].uv = blade_uvs[index] if index < len(blade_uvs) else (0, 0)
    for index, polygon in enumerate(combined.polygons):
        polygon.use_smooth = True
        polygon.material_index = 0 if index < blade_faces else 1
    leaf.data = combined
    bpy.data.meshes.remove(original)

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


print('DESK_STAGE modelled; baking static ambient occlusion with 64 samples', flush=True)
bake_ambient()
print('DESK_STAGE baked; packing and exporting the model', flush=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'escriptori.blend'))
bpy.ops.export_scene.gltf(filepath=str(DESTINATION / 'escriptori.glb'),
    export_format='GLB', export_apply=True, export_extras=True, export_image_format='JPEG',
    export_jpeg_quality=85, export_cameras=False, export_lights=False)
print('DESK_ASSET_READY', DESTINATION / 'escriptori.glb')
