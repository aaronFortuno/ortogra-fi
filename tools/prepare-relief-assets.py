"""Create lightweight, coloured GLB previews from the author's 3MF exports.

Run from the repository root with Blender 5.2:
blender --background --factory-startup --threads 4 --python tools/prepare-relief-assets.py
Original 3MF files remain in ignored output/desk/relleu/ and are never modified.
"""
from array import array
import gc
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import struct
import zlib
import xml.parsers.expat
import zipfile

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output' / 'desk' / 'relleu'
DESTINATION = ROOT / 'assets' / 'desk' / 'reliefs'
WORK = SOURCE / 'preview-work'
DESTINATION.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
# The Windows exporter must not write temporary files in restricted AppData.
bpy.context.preferences.filepaths.temporary_directory = str(WORK)

MODELS = [
    ('agulles-montserrat', 'Agulles de Montserrat'),
    ('tamariu', 'Tamariu'),
    ('sant-maurici', 'Estany de Sant Maurici'),
]


def matrix(value=None):
    if not value:
        return Matrix.Identity(4)
    p = list(map(float, value.split()))
    if len(p) != 12:
        raise ValueError('A 3MF transform must contain 12 values')
    return Matrix(((p[0], p[3], p[6], p[9]),
                   (p[1], p[4], p[7], p[10]),
                   (p[2], p[5], p[8], p[11]), (0, 0, 0, 1)))


def read_3mf(path):
    """Use Expat callbacks rather than retaining 200 MB of XML elements."""
    objects, palettes, build = {}, {}, []
    current = None
    palette = None
    unit = 'millimeter'
    def start(name, attributes):
        nonlocal current, palette, unit
        name = name.split(':')[-1]
        if name == 'model':
            unit = attributes.get('unit', 'millimeter')
        elif name == 'basematerials':
            palette = attributes['id']
            palettes[palette] = []
        elif name == 'base':
            palettes[palette].append(dict(attributes))
        elif name == 'object':
            current = dict(attributes)
            current.update(vertices=array('f'), triangles=array('I'), components=[])
            objects[current['id']] = current
        elif name == 'vertex':
            values = [float(attributes[key]) for key in ('x', 'y', 'z')]
            if not all(math.isfinite(value) for value in values):
                raise ValueError('Non-finite vertex')
            current['vertices'].extend(values)
        elif name == 'triangle':
            if any(key in attributes for key in ('pid', 'p1', 'p2', 'p3')):
                raise ValueError('Per-triangle material overrides need explicit conversion')
            current['triangles'].extend(int(attributes[key]) for key in ('v1', 'v2', 'v3'))
        elif name == 'component':
            if any(key.endswith(':path') for key in attributes):
                raise ValueError('External 3MF components are not supported by this preparer')
            current['components'].append(dict(attributes))
        elif name == 'item':
            build.append(dict(attributes))
    def end(name):
        nonlocal current, palette
        name = name.split(':')[-1]
        if name == 'object':
            current = None
        elif name == 'basematerials':
            palette = None
    parser = xml.parsers.expat.ParserCreate()
    parser.StartElementHandler = start
    parser.EndElementHandler = end
    with zipfile.ZipFile(path) as archive:
        model_name = next(name for name in archive.namelist() if name.lower() == '3d/3dmodel.model')
        with archive.open(model_name) as stream:
            while chunk := stream.read(1024 * 1024):
                parser.Parse(chunk, False)
            parser.Parse(b'', True)
        provenance = json.loads(archive.read('Metadata/provenance.json'))
    if unit != 'millimeter':
        raise ValueError('Expected the original Relleu Obert exports in millimetres')
    return objects, palettes, build, provenance


def instances(objects, build):
    def visit(identifier, transform, parents):
        if identifier in parents:
            raise ValueError('Cyclic 3MF component')
        obj = objects[identifier]
        if obj['triangles']:
            yield obj, transform
        for component in obj['components']:
            yield from visit(component['objectid'], transform @ matrix(component.get('transform')), parents | {identifier})
    for item in build:
        yield from visit(item['objectid'], matrix(item.get('transform')), set())


def material(properties):
    rgba = properties['displaycolor'].lstrip('#')
    channels = [int(rgba[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    colour = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in channels]
    mat = bpy.data.materials.new(properties.get('name', 'Material'))
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = .84
    shader.inputs['Metallic'].default_value = 0
    return mat


def write_colour_png(path, labels, colours, resolution):
    """Encode original sRGB palette bytes without another colour conversion."""
    palette = [bytes.fromhex(properties['displaycolor'][1:7]) for properties in colours]
    scanlines = bytearray()
    # Source rows increase northwards; PNG rows start at the top of the image.
    for row in range(resolution - 1, -1, -1):
        scanlines.append(0)
        for column in range(resolution):
            scanlines.extend(palette[labels[row * resolution + column]])
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', resolution, resolution, 8, 2, 0, 0, 0))
    data += chunk(b'sRGB', b'\x00')
    data += chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b'')
    path.write_bytes(data)


def surface_material(image_path):
    mat = material({'name': 'Original surface colours', 'displaycolor': '#FFFFFFFF'})
    nodes = mat.node_tree.nodes
    image = bpy.data.images.load(str(image_path), check_existing=False)
    image.colorspace_settings.name = 'sRGB'
    image.pack()
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.interpolation = 'Linear'
    texture.extension = 'EXTEND'
    mat.node_tree.links.new(texture.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    return mat


def surface_preview(identifier, source_instances, palettes, normalise, width, depth, height):
    """Separate geometric detail from the original surface colour footprint.

    Geometry has 192x192 cells and shared normals; a 512px source-sampled colour
    map keeps coastlines, paths and vegetation independent of triangle edges.
    Fine printable topology and overhangs are intentionally not reconstructed.
    """
    nx = nz = 192
    colour_resolution = 512
    stride = nx + 1
    vertices_count = (nx + 1) * (nz + 1)
    heights = array('f', [-math.inf]) * vertices_count
    colour_heights = array('f', [-math.inf]) * (colour_resolution * colour_resolution)
    colour_labels = array('B', [0]) * (colour_resolution * colour_resolution)
    material_values, material_indices = [], {}
    part_records = []
    original_triangles = 0
    downward = Vector((0, 0, -1))
    ray_top = height + max(width, depth)
    ray_length = height + 2 * max(width, depth)
    for source, transform in source_instances:
        started = time.perf_counter()
        key = (source['pid'], source.get('pindex', '0'))
        if key not in material_indices:
            material_indices[key] = len(material_values)
            material_values.append(palettes[key[0]][int(key[1])])
        colour_index = material_indices[key]
        coordinates, indices = source['vertices'], source['triangles']
        face_count = len(indices) // 3
        original_triangles += face_count
        transform = normalise @ transform
        positions = [transform @ Vector(coordinates[i:i + 3]) for i in range(0, len(coordinates), 3)]
        polygons = [tuple(indices[i:i + 3]) for i in range(0, len(indices), 3)]
        tree = BVHTree.FromPolygons(positions, polygons, all_triangles=True, epsilon=1e-8)
        del positions, polygons
        source['vertices'] = array('f'); source['triangles'] = array('I')
        gc.collect()
        for row in range(nz + 1):
            y = (row / nz - .5) * depth
            sample_y = max(-depth / 2 + 1e-7, min(depth / 2 - 1e-7, y))
            for column in range(nx + 1):
                x = (column / nx - .5) * width
                sample_x = max(-width / 2 + 1e-7, min(width / 2 - 1e-7, x))
                point, _, _, _ = tree.ray_cast(Vector((sample_x, sample_y, ray_top)), downward, ray_length)
                index = row * stride + column
                if point is not None and point.z > heights[index]:
                    heights[index] = point.z
        for row in range(colour_resolution):
            y = ((row + .5) / colour_resolution - .5) * depth
            for column in range(colour_resolution):
                x = ((column + .5) / colour_resolution - .5) * width
                point, _, _, _ = tree.ray_cast(Vector((x, y, ray_top)), downward, ray_length)
                index = row * colour_resolution + column
                if point is not None and point.z >= colour_heights[index] - 1e-7:
                    colour_heights[index] = point.z; colour_labels[index] = colour_index
        part_records.append({'name': source.get('name', source['id']), 'color': material_values[colour_index]['displaycolor'], 'sourceTriangles': face_count, 'sourceMaterialIndex': colour_index})
        del tree
        gc.collect()
        print(f"  Sampled {source.get('name', source['id'])}: {face_count:,} source triangles ({time.perf_counter() - started:.1f}s)", flush=True)
    missing = sum(not math.isfinite(height) for height in heights)
    missing_colour = sum(not math.isfinite(height) for height in colour_heights)
    if missing or missing_colour:
        raise ValueError(f'{missing} height / {missing_colour} colour samples had no source geometry')
    vertices = [((column / nx - .5) * width, (row / nz - .5) * depth, heights[row * stride + column]) for row in range(nz + 1) for column in range(nx + 1)]
    faces, face_materials, smooth = [], [], []
    for row in range(nz):
        for column in range(nx):
            a = row * stride + column
            # Alternate the diagonal to avoid one visually dominant grid direction.
            if (row + column) % 2:
                faces.extend(((a, a + 1, a + stride), (a + 1, a + stride + 1, a + stride)))
            else:
                faces.extend(((a, a + 1, a + stride + 1), (a, a + stride + 1, a + stride)))
            face_materials.extend((0, 0)); smooth.extend((True, True))
    # Hard base/side edges have separate vertices; the top surface shares normals.
    boundaries = [
        [column for column in range(nx, -1, -1)],
        [row * stride for row in range(nz + 1)],
        [nz * stride + column for column in range(nx + 1)],
        [row * stride + nx for row in range(nz, -1, -1)],
    ]
    for boundary in boundaries:
        wall_start = len(vertices)
        for index in boundary:
            x, y, z = vertices[index]
            vertices.extend(((x, y, z), (x, y, 0)))
        for index in range(len(boundary) - 1):
            a = wall_start + index * 2
            faces.extend(((a, a + 3, a + 1), (a, a + 2, a + 3)))
            face_materials.extend((1, 1)); smooth.extend((False, False))
    bottom = len(vertices)
    vertices.extend(((-width / 2, -depth / 2, 0), (-width / 2, depth / 2, 0), (width / 2, depth / 2, 0), (width / 2, -depth / 2, 0)))
    faces.extend(((bottom, bottom + 1, bottom + 2), (bottom, bottom + 2, bottom + 3)))
    face_materials.extend((1, 1)); smooth.extend((False, False))
    mesh = bpy.data.meshes.new('Source relief preview')
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=True):
        raise ValueError('The reconstructed surface required geometry repairs')
    mesh.update()
    image_path = WORK / (identifier + '-source-colours.png')
    write_colour_png(image_path, colour_labels, material_values, colour_resolution)
    mesh.materials.append(surface_material(image_path))
    base_properties = {**material_values[0], 'name': 'Relief base and sides'}
    mesh.materials.append(material(base_properties))
    uv = mesh.uv_layers.new(name='SourceSurfaceUV')
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = face_materials[index]
        polygon.use_smooth = smooth[index]
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (coordinate.x / width + .5, coordinate.y / depth + .5)
    obj = bpy.data.objects.new('Preview surface', mesh)
    bpy.context.collection.objects.link(obj)
    for record in part_records:
        record['texturePixels'] = colour_labels.count(record['sourceMaterialIndex'])
    obj.data.calc_loop_triangles()
    return obj, part_records, original_triangles, len(obj.data.loop_triangles), max(heights), missing


def provenance_summary(provenance):
    terrain = provenance.get('terrain') or {}
    result = {'terrain': {key: terrain[key] for key in ('provider', 'attribution', 'url', 'resolutionMeters') if key in terrain}}
    coverage = provenance.get('coverage')
    if coverage:
        result['coverage'] = {key: coverage[key] for key in ('provider', 'license', 'citation', 'url') if key in coverage}
    # Only the source fields are redistributed, not the complete internal export.
    for key in ('lakes', 'waterways', 'oceans', 'forests', 'trails', 'buildings'):
        item = provenance.get(key)
        if item and item.get('provider'):
            result[key] = {field: item[field] for field in ('provider', 'license', 'attribution', 'url') if field in item}
    landforms = provenance.get('catalogueLandforms', [])
    if landforms:
        result['catalogueLandforms'] = [{key: item[key] for key in ('id', 'name', 'revision', 'attribution', 'license', 'spatialDataLicense') if key in item} for item in landforms]
    return result


def render_preview(identifier, height):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(WORK / (identifier + '.png'))
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.world.color = (.2, .2, .2)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = .35
    floor = bpy.data.materials.new('Preview background')
    floor.diffuse_color = (.38, .4, .38, 1)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.004))
    bpy.context.object.data.materials.append(floor)
    for position, energy, size in [((-1.3, -1.6, 2.2), 130, 1.4), ((1.8, .4, 1.9), 55, 1.8)]:
        data = bpy.data.lights.new('Preview softbox', type='AREA')
        data.energy = energy; data.shape = 'DISK'; data.size = size
        light = bpy.data.objects.new('Preview softbox', data)
        scene.collection.objects.link(light); light.location = position
        light.rotation_euler = (Vector((0, 0, height / 3)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Preview camera')
    camera = bpy.data.objects.new('Preview camera', data)
    scene.collection.objects.link(camera)
    camera.location = (1.3, -1.55, 1.25)
    camera.rotation_euler = (Vector((0, 0, height / 2)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    data.type = 'ORTHO'; data.ortho_scale = 1.63
    scene.camera = camera
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / (identifier + '.blend')))
    bpy.ops.render.render(write_still=True)


def build(identifier, title):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    gc.collect()
    path = SOURCE / (identifier + '.3mf')
    print('Reading ' + path.name, flush=True)
    objects, palettes, build_items, provenance = read_3mf(path)
    source_instances = list(instances(objects, build_items))
    low, high = Vector((math.inf,) * 3), Vector((-math.inf,) * 3)
    for source, transform in source_instances:
        coordinates = source['vertices']
        for index in range(0, len(coordinates), 3):
            point = transform @ Vector(coordinates[index:index + 3])
            for axis in range(3):
                low[axis] = min(low[axis], point[axis]); high[axis] = max(high[axis], point[axis])
    dimensions = high - low
    scale = 1 / max(dimensions.x, dimensions.y)
    origin = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    normalise = Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(-origin)
    root = bpy.data.objects.new(title, None)
    bpy.context.collection.objects.link(root)
    obj, parts, original_triangles, triangles, sampled_height, missing = surface_preview(identifier, source_instances, palettes, normalise, dimensions.x * scale, dimensions.y * scale, dimensions.z * scale)
    obj.parent = root
    root['source'] = path.name
    root['source_units'] = 'millimeter'
    root['preview_only'] = True
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children:
        child.select_set(True)
    destination = DESTINATION / (identifier + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_yup=True, export_normals=True, export_texcoords=True,
                              export_attributes=False, export_extras=True)
    record = {
        'id': identifier, 'title': title, 'url': destination.name,
        'width': round(dimensions.x * scale, 7), 'height': round(sampled_height, 7), 'depth': round(dimensions.y * scale, 7),
        'triangles': triangles, 'sourceTriangles': original_triangles, 'bytes': destination.stat().st_size,
        'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'source': path.name, 'sourceSHA256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'sourceSizeMM': [round(value, 6) for value in dimensions], 'normalisationScale': scale,
        'parts': parts, 'provenance': provenance_summary(provenance),
        'strategy': 'source-heightfield-with-independent-source-colour-map', 'resolution': [192, 192], 'colourResolution': [512, 512], 'materialCount': 2, 'missingSurfaceSamples': missing, 'missingColourSamples': 0,
    }
    (WORK / (identifier + '.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Finished ' + identifier + ': ' + str(record['bytes']) + ' bytes', flush=True)
    if '--render' in requested:
        render_preview(identifier, sampled_height)
    return record


requested = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
requested_ids = [argument for argument in requested if not argument.startswith('--')]
records = []
for identifier, title in MODELS:
    if requested_ids and identifier not in requested_ids:
        existing = WORK / (identifier + '.json')
        if existing.exists():
            record = json.loads(existing.read_text(encoding='utf-8'))
            source = SOURCE / record['source']
            if hashlib.sha256(source.read_bytes()).hexdigest() != record['sourceSHA256']:
                raise ValueError('An unchanged preview references a changed source; regenerate ' + identifier)
            # Metadata filtering can evolve independently of the geometry. A
            # partial regeneration must not restore a stale credit summary.
            with zipfile.ZipFile(source) as archive:
                record['provenance'] = provenance_summary(json.loads(archive.read('Metadata/provenance.json')))
            existing.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
            records.append(record)
        continue
    records.append(build(identifier, title))
(DESTINATION / 'manifest.json').write_text(json.dumps({'version': 1, 'models': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print('Relief manifest complete.', flush=True)
