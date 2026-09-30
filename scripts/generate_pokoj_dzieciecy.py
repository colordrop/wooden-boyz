"""
Generator projektu pokoju dzieciecego w Blenderze dla Wooden Boyz / colordrop.pl
Autor: colordrop.pl
Stylistyka: Premium Scandinavian Light-Mode Kids Room
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler, Matrix, Quaternion

def clear_scene():
    """Usuwa domyslne obiekty i czysci scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m, do_unlink=True)

def setup_scene_properties():
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'METERS'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    
    # World background - cieple rozproszone swiatlo dzienne
    world = bpy.data.worlds.new("KidsRoom_World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.95, 0.96, 0.98, 1.0)
        bg.inputs["Strength"].default_value = 0.85

def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
    else:
        col = bpy.data.collections.new(name)
        if parent:
            parent.children.link(col)
        else:
            bpy.context.scene.collection.children.link(col)
    return col

def create_principled_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, 
                               metallic=0.0, transmission=0.0, emission=None, 
                               emission_strength=1.0, ior=1.45, specular=0.5):
    """Tworzy material Principled BSDF kompatybilny z Blender 4.x i 5.x."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        for n in nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bsdf = n
                break
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = base_color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular
        elif "Specular" in bsdf.inputs:
            bsdf.inputs["Specular"].default_value = specular
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        elif "Transmission" in bsdf.inputs:
            bsdf.inputs["Transmission"].default_value = transmission
        if "IOR" in bsdf.inputs:
            bsdf.inputs["IOR"].default_value = ior
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emission
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = emission
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def create_wood_material(name, base_rgb=(0.78, 0.62, 0.44), roughness=0.35, noise_scale=16.0):
    """Tworzy proceduralny material drewna skandynawskiego z naturalnym uslojeniem."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (600, 0)
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-700, 0)
    mapping = nodes.new(type='ShaderNodeMapping')
    mapping.location = (-500, 0)
    mapping.inputs['Scale'].default_value = (1.0, 1.0, 8.0)
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    noise = nodes.new(type='ShaderNodeTexNoise')
    noise.location = (-280, 0)
    noise.inputs['Scale'].default_value = noise_scale
    noise.inputs['Detail'].default_value = 3.5
    noise.inputs['Roughness'].default_value = 0.55
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

    ramp = nodes.new(type='ShaderNodeValToRGB')
    ramp.location = (-60, 100)
    c1 = (base_rgb[0] * 0.88, base_rgb[1] * 0.85, base_rgb[2] * 0.80, 1.0)
    c2 = (base_rgb[0] * 1.08, base_rgb[1] * 1.04, base_rgb[2] * 1.01, 1.0)
    ramp.color_ramp.elements[0].color = c1
    ramp.color_ramp.elements[1].color = c2
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.4
    return mat

def create_parquet_material(name, base_rgb=(0.74, 0.56, 0.38)):
    """Tworzy proceduralny cieply parkiet debowy z podzialem na deski."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (700, 0)
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (400, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-700, 0)
    
    # Noise dla desek
    noise = nodes.new(type='ShaderNodeTexNoise')
    noise.location = (-400, 100)
    noise.inputs['Scale'].default_value = 12.0
    noise.inputs['Detail'].default_value = 3.0
    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

    ramp = nodes.new(type='ShaderNodeValToRGB')
    ramp.location = (-150, 100)
    c1 = (base_rgb[0] * 0.85, base_rgb[1] * 0.82, base_rgb[2] * 0.76, 1.0)
    c2 = (base_rgb[0] * 1.12, base_rgb[1] * 1.08, base_rgb[2] * 1.02, 1.0)
    ramp.color_ramp.elements[0].color = c1
    ramp.color_ramp.elements[1].color = c2
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.32
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.45
    return mat

def create_cube(name, location, size, collection, material=None, bevel_width=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    if bevel_width > 0:
        mod = obj.modifiers.new(name="Bevel", type='BEVEL')
        mod.width = bevel_width
        mod.segments = 3
    for c in obj.users_collection:
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def create_cylinder(name, location, radius, depth, collection, material=None, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    for c in obj.users_collection:
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def look_at(cam_obj, target_vec):
    """Kieruje kamere bezposrednio w punkt target_vec."""
    direction = target_vec - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

def build_architecture(parent_col, mats):
    col = get_or_create_collection("01_Architektura", parent_col)
    
    # 1. Podloga (cieply debowy parkiet skandynawski)
    floor = create_cube("Podloga", (0.0, 0.0, -0.025), (4.8, 4.4, 0.05), col, mats['podloga'])
    
    # 2. Sciana Tylna (cieply kremowy off-white)
    back_wall = create_cube("Sciana_Tylna", (0.0, 2.25, 1.4), (4.8, 0.1, 2.8), col, mats['sciana_baza'])
    
    # 3. Sciana Lewa z oknem (elegancka pastelowa szalwia)
    create_cube("Sciana_Lewa_Dol", (-2.45, 0.0, 0.425), (0.1, 4.4, 0.85), col, mats['sciana_akcent'])
    create_cube("Sciana_Lewa_Gora", (-2.45, 0.0, 2.575), (0.1, 4.4, 0.45), col, mats['sciana_akcent'])
    create_cube("Sciana_Lewa_Tyl", (-2.45, 1.5, 1.6), (0.1, 1.4, 1.5), col, mats['sciana_akcent'])
    create_cube("Sciana_Lewa_Przod", (-2.45, -1.5, 1.6), (0.1, 1.4, 1.5), col, mats['sciana_akcent'])
    
    # Parapet drewniany
    create_cube("Parapet_Okna", (-2.38, 0.0, 0.86), (0.24, 1.7, 0.03), col, mats['drewno_jasne'], bevel_width=0.005)
    
    # Rama okienna (biala drewniana)
    create_cube("Rama_Gora", (-2.42, 0.0, 2.33), (0.06, 1.6, 0.04), col, mats['drewno_biale'])
    create_cube("Rama_Dol", (-2.42, 0.0, 0.87), (0.06, 1.6, 0.04), col, mats['drewno_biale'])
    create_cube("Rama_Lewa", (-2.42, -0.78, 1.6), (0.06, 0.04, 1.46), col, mats['drewno_biale'])
    create_cube("Rama_Prawa", (-2.42, 0.78, 1.6), (0.06, 0.04, 1.46), col, mats['drewno_biale'])
    create_cube("Szpros_Pionowy", (-2.42, 0.0, 1.6), (0.05, 0.035, 1.44), col, mats['drewno_biale'])
    create_cube("Szpros_Poziomy", (-2.42, 0.0, 1.6), (0.05, 1.54, 0.035), col, mats['drewno_biale'])
    create_cube("Szyba_Okna", (-2.42, 0.0, 1.6), (0.01, 1.54, 1.42), col, mats['szklo'])
    
    # Karnisz i miekkie lniane zaslonki
    create_cylinder("Karnisz", (-2.30, 0.0, 2.45), 0.015, 2.0, col, mats['drewno_jasne'], rotation=(math.radians(90), 0, 0))
    create_cube("Zaslonka_Lewa", (-2.28, -0.88, 1.65), (0.05, 0.28, 1.55), col, mats['tkanina_zaslonka'], bevel_width=0.01)
    create_cube("Zaslonka_Prawa", (-2.28, 0.88, 1.65), (0.05, 0.28, 1.55), col, mats['tkanina_zaslonka'], bevel_width=0.01)
    
    # Listwy przypodlogowe (biale listwy 10cm)
    create_cube("Listwa_Tylna", (0.0, 2.19, 0.05), (4.78, 0.018, 0.10), col, mats['drewno_biale'], bevel_width=0.002)
    create_cube("Listwa_Lewa", (-2.39, 0.0, 0.05), (0.018, 4.38, 0.10), col, mats['drewno_biale'], bevel_width=0.002)
    
    # Prawa sciana cutaway / cokol
    create_cube("Sciana_Prawa_Cokol", (2.45, 0.0, 0.2), (0.1, 4.4, 0.4), col, mats['sciana_baza'])
    create_cube("Listwa_Prawa", (2.39, 0.0, 0.05), (0.018, 4.38, 0.10), col, mats['drewno_biale'], bevel_width=0.002)

def build_house_bed(parent_col, mats, origin=(1.30, 1.05, 0.0)):
    """Buduje skandynawskie lozko domek z materacem, kolderka terakota i girlanda."""
    col = get_or_create_collection("02_Lozko_Domek", parent_col)
    ox, oy, oz = origin
    
    b_w = 0.95
    b_l = 1.85
    post_s = 0.05
    post_h = 1.25
    roof_h = 0.55
    
    # 4 slupki
    corners = [
        (-b_w/2 + post_s/2, -b_l/2 + post_s/2),
        ( b_w/2 - post_s/2, -b_l/2 + post_s/2),
        (-b_w/2 + post_s/2,  b_l/2 - post_s/2),
        ( b_w/2 - post_s/2,  b_l/2 - post_s/2)
    ]
    for i, (cx, cy) in enumerate(corners):
        create_cube(f"Lozko_Slupek_{i+1}", (ox + cx, oy + cy, oz + post_h/2), (post_s, post_s, post_h), col, mats['drewno_jasne'], bevel_width=0.003)
        
    # Dolna rama
    create_cube("Lozko_Rama_Dol_L", (ox - b_w/2 + post_s/2, oy, oz + 0.18), (post_s, b_l, 0.10), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Rama_Dol_R", (ox + b_w/2 - post_s/2, oy, oz + 0.18), (post_s, b_l, 0.10), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Rama_Dol_Przod", (ox, oy - b_l/2 + post_s/2, oz + 0.18), (b_w, post_s, 0.10), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Rama_Dol_Tyl", (ox, oy + b_l/2 - post_s/2, oz + 0.18), (b_w, post_s, 0.10), col, mats['drewno_jasne'], bevel_width=0.003)
    
    # Gorne belki ramy
    create_cube("Lozko_Belka_Gora_L", (ox - b_w/2 + post_s/2, oy, oz + post_h), (post_s, b_l, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Belka_Gora_R", (ox + b_w/2 - post_s/2, oy, oz + post_h), (post_s, b_l, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Belka_Gora_Przod", (ox, oy - b_l/2 + post_s/2, oz + post_h), (b_w, post_s, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Lozko_Belka_Gora_Tyl", (ox, oy + b_l/2 - post_s/2, oz + post_h), (b_w, post_s, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
    
    # Kalenica dachu
    create_cube("Lozko_Kalenica", (ox, oy, oz + post_h + roof_h), (post_s, b_l, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
    
    # Krokwie dachu
    krokiew_len = math.sqrt((b_w/2)**2 + roof_h**2)
    angle = math.atan2(roof_h, b_w/2)
    for y_pos, name_suffix in [(oy - b_l/2 + post_s/2, "Przod"), (oy + b_l/2 - post_s/2, "Tyl")]:
        kr_l = create_cube(f"Krokiew_L_{name_suffix}", (ox - b_w/4, y_pos, oz + post_h + roof_h/2), 
                           (krokiew_len, post_s, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
        kr_l.rotation_euler = (0, -angle, 0)
        kr_r = create_cube(f"Krokiew_R_{name_suffix}", (ox + b_w/4, y_pos, oz + post_h + roof_h/2), 
                           (krokiew_len, post_s, post_s), col, mats['drewno_jasne'], bevel_width=0.003)
        kr_r.rotation_euler = (0, angle, 0)
        
    # Barierka ochronna boczna
    for si, sy in enumerate([-0.5, -0.25, 0.0, 0.25, 0.5]):
        create_cube(f"Szczebelek_{si}", (ox + b_w/2 - post_s/2, oy + sy, oz + 0.45), (0.02, 0.04, 0.35), col, mats['drewno_jasne'], bevel_width=0.002)
    create_cube("Barierka_Porecz", (ox + b_w/2 - post_s/2, oy, oz + 0.64), (0.03, 1.3, 0.03), col, mats['drewno_jasne'], bevel_width=0.003)

    # Materac
    create_cube("Materac", (ox, oy, oz + 0.26), (0.85, 1.75, 0.16), col, mats['tkanina_materac'], bevel_width=0.025)
    
    # Posciel w odcieniu cieplej terakoty / koralu
    create_cube("Kolderka", (ox, oy - 0.25, oz + 0.36), (0.87, 1.15, 0.08), col, mats['tkanina_posciel'], bevel_width=0.03)
    create_cube("Kolderka_Wywiniecie", (ox, oy + 0.32, oz + 0.38), (0.87, 0.20, 0.06), col, mats['tkanina_posciel_akcent'], bevel_width=0.02)
    
    # Poduszki: glowna biala + dekoracyjna musztardowa + blekitna
    pillow_main = create_cube("Poduszka_Glowna", (ox, oy + 0.65, oz + 0.40), (0.65, 0.40, 0.12), col, mats['tkanina_materac'], bevel_width=0.04)
    pillow_main.rotation_euler = (math.radians(-12), 0, 0)
    
    pillow_deco1 = create_cube("Poduszka_Musztarda", (ox + 0.12, oy + 0.55, oz + 0.42), (0.35, 0.35, 0.10), col, mats['pastel_mustard'], bevel_width=0.03)
    pillow_deco1.rotation_euler = (math.radians(-18), 0, math.radians(15))
    
    pillow_deco2 = create_cube("Poduszka_Blekit", (ox - 0.18, oy + 0.58, oz + 0.41), (0.30, 0.30, 0.09), col, mats['pastel_blue'], bevel_width=0.025)
    pillow_deco2.rotation_euler = (math.radians(-15), 0, math.radians(-12))

    # Girlanda z kolorowymi proporczykami
    garland_col = get_or_create_collection("Girlanda_Lozka", col)
    num_flags = 7
    flag_colors = [mats['pastel_mint'], mats['pastel_mustard'], mats['pastel_pink'], mats['pastel_blue'], mats['pastel_mint'], mats['pastel_terracotta'], mats['pastel_pink']]
    for fi in range(num_flags):
        t = fi / (num_flags - 1)
        gx = (t - 0.5) * (b_w - 0.1)
        gy = oy - b_l/2 + post_s/2
        gz = oz + post_h - 0.04 - math.sin(t * math.pi) * 0.11
        flag = create_cube(f"Proporczyk_{fi+1}", (ox + gx, gy, gz), (0.075, 0.006, 0.095), garland_col, flag_colors[fi % len(flag_colors)], bevel_width=0.002)
        flag.rotation_euler = (0, 0, math.radians((t - 0.5) * 22))

def build_desk_and_chair(parent_col, mats, origin=(1.35, -1.20, 0.0)):
    """Buduje biurko dla dziecka z toczonymi nozkami, lampka, przybornikiem i krzeselkiem."""
    col = get_or_create_collection("03_Kacik_Nauki_Biurko", parent_col)
    ox, oy, oz = origin
    
    desk_w = 1.05
    desk_d = 0.55
    desk_h = 0.62
    create_cube("Biurko_Blat", (ox, oy, oz + desk_h), (desk_w, desk_d, 0.028), col, mats['drewno_jasne'], bevel_width=0.008)
    create_cube("Biurko_Szuflada", (ox + 0.24, oy, oz + desk_h - 0.06), (0.40, desk_d - 0.06, 0.08), col, mats['drewno_biale'], bevel_width=0.004)
    create_cylinder("Biurko_Uchwyt", (ox + 0.24, oy - desk_d/2 - 0.015, oz + desk_h - 0.06), 0.015, 0.02, col, mats['drewno_akcent'], rotation=(math.radians(90), 0, 0))
    
    leg_coords = [
        (-desk_w/2 + 0.08, -desk_d/2 + 0.08, math.radians(5), math.radians(-5)),
        ( desk_w/2 - 0.08, -desk_d/2 + 0.08, math.radians(5), math.radians(5)),
        (-desk_w/2 + 0.08,  desk_d/2 - 0.08, math.radians(-5), math.radians(-5)),
        ( desk_w/2 - 0.08,  desk_d/2 - 0.08, math.radians(-5), math.radians(5))
    ]
    for li, (lx, ly, rot_x, rot_y) in enumerate(leg_coords):
        leg = create_cylinder(f"Biurko_Noga_{li+1}", (ox + lx, oy + ly, oz + desk_h/2), 0.018, desk_h - 0.03, col, mats['drewno_jasne'])
        leg.rotation_euler = (rot_x, rot_y, 0)
        sock = create_cylinder(f"Biurko_Noga_Stopka_{li+1}", (ox + lx * 1.05, oy + ly * 1.05, oz + 0.04), 0.02, 0.08, col, mats['mosiadz'])
        sock.rotation_euler = (rot_x, rot_y, 0)

    # Krzeselko zwrocone lekko po skosie w strone biurka
    ch_ox, ch_oy = ox - 0.05, oy + 0.50
    seat_h = 0.36
    seat = create_cube("Krzeslo_Siedzisko", (ch_ox, ch_oy, oz + seat_h), (0.38, 0.38, 0.025), col, mats['drewno_biale'], bevel_width=0.008)
    seat.rotation_euler = (0, 0, math.radians(-12))
    cushion = create_cube("Krzeslo_Poduszka", (ch_ox, ch_oy, oz + seat_h + 0.02), (0.34, 0.34, 0.025), col, mats['pastel_mint'], bevel_width=0.01)
    cushion.rotation_euler = (0, 0, math.radians(-12))
    
    for c_li, (clx, cly) in enumerate([(-0.14, -0.14), (0.14, -0.14), (-0.14, 0.14), (0.14, 0.14)]):
        create_cylinder(f"Krzeslo_Noga_{c_li+1}", (ch_ox + clx, ch_oy + cly, oz + seat_h/2), 0.014, seat_h, col, mats['drewno_jasne'])
        
    create_cylinder("Krzeslo_Oparcie_Slupek_L", (ch_ox - 0.14, ch_oy + 0.16, oz + seat_h + 0.16), 0.012, 0.32, col, mats['drewno_jasne'])
    create_cylinder("Krzeslo_Oparcie_Slupek_R", (ch_ox + 0.14, ch_oy + 0.16, oz + seat_h + 0.16), 0.012, 0.32, col, mats['drewno_jasne'])
    create_cube("Krzeslo_Oparcie_Deska", (ch_ox, ch_oy + 0.16, oz + seat_h + 0.28), (0.36, 0.02, 0.12), col, mats['drewno_biale'], bevel_width=0.006)

    # Lampka biurkowa w stylu skandynawskim
    create_cylinder("Lampka_Podstawa", (ox - 0.34, oy - 0.12, oz + desk_h + 0.015), 0.065, 0.015, col, mats['pastel_mustard'])
    lamp_rod = create_cylinder("Lampka_Ramie", (ox - 0.34, oy - 0.12, oz + desk_h + 0.18), 0.008, 0.32, col, mats['mosiadz'])
    lamp_rod.rotation_euler = (math.radians(-10), math.radians(12), 0)
    create_cylinder("Lampka_Klosz", (ox - 0.30, oy - 0.06, oz + desk_h + 0.30), 0.055, 0.09, col, mats['pastel_mustard'], rotation=(math.radians(35), math.radians(-15), 0))
    create_cylinder("Lampka_Zarowka", (ox - 0.29, oy - 0.05, oz + desk_h + 0.28), 0.02, 0.02, col, mats['swiatlo_emisja_cieple'])
    
    # Przybornik na kredki
    create_cylinder("Przybornik", (ox + 0.36, oy - 0.10, oz + desk_h + 0.05), 0.04, 0.09, col, mats['drewno_jasne'])
    cray_colors = [mats['pastel_pink'], mats['pastel_blue'], mats['pastel_mint'], mats['pastel_mustard']]
    for pi in range(4):
        p_ang = pi * 1.5
        cray = create_cylinder(f"Kredka_{pi+1}", (ox + 0.36 + math.cos(p_ang)*0.018, oy - 0.10 + math.sin(p_ang)*0.018, oz + desk_h + 0.10), 
                               0.004, 0.12, col, cray_colors[pi % len(cray_colors)])
        cray.rotation_euler = (math.radians(5 * (pi-1.5)), math.radians(8 * (pi-1)), 0)
        
    # Otwarty szkicownik z rysunkiem
    sketchbook = create_cube("Szkicownik", (ox - 0.06, oy - 0.02, oz + desk_h + 0.01), (0.28, 0.20, 0.008), col, mats['papier_baza'], bevel_width=0.002)
    sketchbook.rotation_euler = (0, 0, math.radians(-6))

def build_montessori_bookshelf(parent_col, mats, origin=(-0.25, 2.05, 0.0)):
    """Buduje regalik na zabawki i ksiazki."""
    col = get_or_create_collection("04_Regal_Montessori", parent_col)
    ox, oy, oz = origin
    
    sh_w = 1.05
    sh_h = 0.82
    sh_d = 0.35
    th = 0.022
    
    create_cube("Regal_Blat_Gora", (ox, oy, oz + sh_h - th/2), (sh_w, sh_d, th), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Regal_Podstawa_Dol", (ox, oy, oz + 0.08 + th/2), (sh_w, sh_d, th), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Regal_Bok_L", (ox - sh_w/2 + th/2, oy, oz + sh_h/2 + 0.04), (th, sh_d, sh_h - 0.08), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Regal_Bok_R", (ox + sh_w/2 - th/2, oy, oz + sh_h/2 + 0.04), (th, sh_d, sh_h - 0.08), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Regal_Plecy", (ox, oy + sh_d/2 - 0.005, oz + sh_h/2 + 0.04), (sh_w - 2*th, 0.01, sh_h - 0.08), col, mats['drewno_biale'])
    
    create_cube("Regal_Polka_Srodek", (ox, oy, oz + 0.44), (sh_w - 2*th, sh_d - 0.02, th), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Regal_Przegroda_Pion", (ox, oy, oz + sh_h/2 + 0.04), (th, sh_d - 0.02, sh_h - 0.08 - th), col, mats['drewno_jasne'], bevel_width=0.003)
    
    for nxi_val in [-sh_w/2 + 0.06, sh_w/2 - 0.06]:
        for nyi_val in [-sh_d/2 + 0.06, sh_d/2 - 0.06]:
            create_cylinder(f"Regal_Nozka_{round(nxi_val,2)}_{round(nyi_val,2)}", (ox + nxi_val, oy + nyi_val, oz + 0.04), 0.018, 0.08, col, mats['drewno_akcent'])

    create_cube("Pudelko_Zabawki_1", (ox - 0.25, oy - 0.02, oz + 0.24), (0.38, 0.28, 0.22), col, mats['pastel_mint'], bevel_width=0.008)
    create_cube("Pudelko_Uchwyt", (ox - 0.25, oy - 0.165, oz + 0.30), (0.08, 0.01, 0.025), col, mats['drewno_akcent'], bevel_width=0.002)
    
    book_colors = [mats['pastel_terracotta'], mats['pastel_blue'], mats['pastel_mustard'], mats['pastel_mint'], mats['pastel_pink']]
    for bi in range(6):
        bx = ox - 0.42 + bi * 0.045
        bh = 0.20 + (bi % 3) * 0.025
        book = create_cube(f"Ksiazka_{bi+1}", (bx, oy - 0.02, oz + 0.45 + bh/2), (0.035, 0.22, bh), col, book_colors[bi % len(book_colors)], bevel_width=0.003)
        if bi == 5:
            book.rotation_euler = (0, math.radians(16), 0)
            book.location.x += 0.02
            book.location.z -= 0.01
            
    ring_colors = [mats['pastel_terracotta'], mats['pastel_mustard'], mats['pastel_mint'], mats['pastel_blue'], mats['drewno_jasne']]
    create_cylinder("Piramidka_Podstawa", (ox + 0.26, oy - 0.02, oz + 0.46), 0.08, 0.018, col, mats['drewno_jasne'])
    create_cylinder("Piramidka_Rdzen", (ox + 0.26, oy - 0.02, oz + 0.56), 0.012, 0.20, col, mats['drewno_jasne'])
    for ri, r_rad in enumerate([0.07, 0.058, 0.046, 0.034]):
        create_cylinder(f"Piramidka_Kolo_{ri+1}", (ox + 0.26, oy - 0.02, oz + 0.48 + ri * 0.032), r_rad, 0.026, col, ring_colors[ri % len(ring_colors)])

    create_cube("Zabawka_Autko_Karoseria", (ox + 0.26, oy - 0.02, oz + 0.16), (0.20, 0.11, 0.07), col, mats['drewno_jasne'], bevel_width=0.01)
    create_cube("Zabawka_Autko_Kabina", (ox + 0.24, oy - 0.02, oz + 0.21), (0.11, 0.10, 0.05), col, mats['pastel_blue'], bevel_width=0.006)
    for cwx_val in [-0.06, 0.06]:
        create_cylinder(f"Autko_Kolo_L_{cwx_val}", (ox + 0.26 + cwx_val, oy - 0.08, oz + 0.13), 0.024, 0.018, col, mats['drewno_ciemne'], rotation=(math.radians(90), 0, 0))
        create_cylinder(f"Autko_Kolo_R_{cwx_val}", (ox + 0.26 + cwx_val, oy + 0.04, oz + 0.13), 0.024, 0.018, col, mats['drewno_ciemne'], rotation=(math.radians(90), 0, 0))

    create_cylinder("Doniczka", (ox - 0.30, oy - 0.02, oz + sh_h + 0.055), 0.055, 0.10, col, mats['ceramika_terakota'])
    create_cube("Roslinka_Pilea", (ox - 0.30, oy - 0.02, oz + sh_h + 0.14), (0.12, 0.12, 0.08), col, mats['roslina_lisc'], bevel_width=0.02)
    
    frame_small = create_cube("Ramka_Mala_Regal", (ox + 0.24, oy + 0.05, oz + sh_h + 0.12), (0.16, 0.02, 0.20), col, mats['drewno_jasne'], bevel_width=0.003)
    frame_small.rotation_euler = (math.radians(-8), 0, math.radians(5))

def setup_wooden_boyz_zone(parent_col, mats, blend_path=r"C:\WORK\wooden-boyz\wooden-boyz-laura.blend", origin=(-1.45, 0.95, 0.0)):
    """Konfiguruje pelna strefe Wooden Boyz Laura z hustawka, siatka, drabinka i materacem."""
    col = get_or_create_collection("05_Strefa_WoodenBoyz", parent_col)
    ox, oy, oz = origin
    
    # 1. Gruby, bezpieczny materac asekuracyjny na podlodze pod hustawka i scianka
    create_cube("Materac_Asekuracyjny", (ox, oy - 0.35, oz + 0.05), (1.45, 1.65, 0.10), col, mats['tkanina_materac_crash'], bevel_width=0.02)
    
    # 2. Import z wooden-boyz-laura.blend
    target_names = ['konstrukcja-laura', 'kamienie', 'drazki-gora', 'siatka', 'ruchoma-drabinka', 'lina-wezly', 'GRUPA-hustawka-deska']
    loaded_objects = []
    
    if os.path.exists(blend_path):
        try:
            with bpy.data.libraries.load(blend_path) as (data_from, data_to):
                data_to.objects = [name for name in target_names if name in data_from.objects]
            
            # Root empty
            empty_root = bpy.data.objects.new("WoodenBoyz_Laura_Root", None)
            empty_root.empty_display_type = 'ARROWS'
            empty_root.location = (ox, oy, oz)
            # Kat obrotu: 0 sprawia, ze scianka wspinaczkowa jest przy scianie tylnej,
            # hustawka z przodu skierowana ku srodkowi pokoju, drabinka po prawej
            empty_root.rotation_euler = (0, 0, 0)
            col.objects.link(empty_root)
            
            for obj in data_to.objects:
                if obj:
                    col.objects.link(obj)
                    obj.parent = empty_root
                    # WAZNE: Odkryj w renderze (hustawka mogla miec hide_render = True)
                    obj.hide_render = False
                    obj.hide_viewport = False
                    
                    # Przypisz cieply material drewna do konstrukcji
                    for i, slot in enumerate(obj.material_slots):
                        if slot.material:
                            m_name = slot.material.name
                            if 'drewno' in m_name.lower():
                                slot.material = mats['drewno_jasne']
                            elif 'rope' in m_name.lower() or 'lina' in m_name.lower():
                                slot.material = mats['lina_naturalna']
                            elif 'plastic-deseczka' in m_name.lower():
                                slot.material = mats['drewno_akcent']
                                
                    loaded_objects.append(obj.name)
            print(f"Zaimportowano i zaktualizowano obiekty Wooden Boyz: {loaded_objects}")
        except Exception as e:
            print(f"Ostrzezenie przy imporcie z blend: {e}")
            
    if not loaded_objects:
        # Proceduralna drabinka
        lad_w = 0.85
        lad_h = 2.20
        create_cube("Drabinka_Policzek_L", (ox - lad_w/2, oy + 0.8, oz + lad_h/2), (0.04, 0.12, lad_h), col, mats['drewno_jasne'], bevel_width=0.005)
        create_cube("Drabinka_Policzek_R", (ox + lad_w/2, oy + 0.8, oz + lad_h/2), (0.04, 0.12, lad_h), col, mats['drewno_jasne'], bevel_width=0.005)
        for ri in range(10):
            rz = oz + 0.25 + ri * 0.20
            create_cylinder(f"Drabinka_Szczebelek_{ri+1}", (ox, oy + 0.8, rz), 0.016, lad_w, col, mats['drewno_jasne'], rotation=(0, math.radians(90), 0))
        create_cube("Drabinka_Wysiegnik_L", (ox - lad_w/2, oy + 0.55, oz + lad_h - 0.06), (0.04, 0.50, 0.12), col, mats['drewno_jasne'], bevel_width=0.005)
        create_cube("Drabinka_Wysiegnik_R", (ox + lad_w/2, oy + 0.55, oz + lad_h - 0.06), (0.04, 0.50, 0.12), col, mats['drewno_jasne'], bevel_width=0.005)
        create_cylinder("Drabinka_Drazek_Gora", (ox, oy + 0.35, oz + lad_h - 0.06), 0.018, lad_w, col, mats['drewno_jasne'], rotation=(0, math.radians(90), 0))

def build_cozy_center_rug(parent_col, mats, origin=(-0.1, -0.1, 0.0)):
    """Buduje miekki, pleciony okragly dywan, pufke welurowa i klocki drewniane."""
    col = get_or_create_collection("06_Strefa_Zabawy_Dywan", parent_col)
    ox, oy, oz = origin
    
    # Okragly dywan o srednicy niemal 2m
    create_cylinder("Dywan_Glowny", (ox, oy, oz + 0.007), 0.98, 0.014, col, mats['dywan_pleciony'])
    
    # Welurowa pufka w odcieniu musztardowym
    create_cylinder("Pufa_Dziecieca", (ox - 0.48, oy - 0.38, oz + 0.14), 0.25, 0.26, col, mats['pastel_mustard'])
    create_cylinder("Pufa_Guzik", (ox - 0.48, oy - 0.38, oz + 0.275), 0.03, 0.015, col, mats['drewno_ciemne'])
    
    # Drewniane klocki z zaokraglonymi krawedziami
    blocks_data = [
        (ox + 0.25, oy + 0.15, 0.035, mats['pastel_mint'], 15),
        (ox + 0.33, oy + 0.22, 0.035, mats['pastel_terracotta'], -30),
        (ox + 0.29, oy + 0.18, 0.090, mats['drewno_jasne'], 5),
        (ox + 0.15, oy - 0.20, 0.035, mats['pastel_blue'], 45),
        (ox + 0.40, oy - 0.10, 0.035, mats['pastel_pink'], -10)
    ]
    for bi, (bx, by, bz, bmat, brot) in enumerate(blocks_data):
        block = create_cube(f"Klocek_{bi+1}", (bx, by, oz + bz), (0.06, 0.06, 0.06), col, bmat, bevel_width=0.005)
        block.rotation_euler = (0, 0, math.radians(brot))

def build_wall_decorations(parent_col, mats):
    col = get_or_create_collection("07_Dekoracje_Scienne", parent_col)
    
    # Plakat 1: Nad regalem Montessori (doskonale widoczny z obu kamer)
    create_cube("Obraz_Plakat_1_Rama", (-0.25, 2.22, 1.62), (0.42, 0.02, 0.52), col, mats['drewno_jasne'], bevel_width=0.004)
    create_cube("Obraz_Plakat_1_Grafika", (-0.25, 2.21, 1.62), (0.36, 0.005, 0.46), col, mats['plakat_grafika_1'])
    
    # Plakat 2: Nad lozeczkiem
    create_cube("Obraz_Plakat_2_Rama", (1.45, 2.22, 1.95), (0.42, 0.02, 0.52), col, mats['drewno_jasne'], bevel_width=0.004)
    create_cube("Obraz_Plakat_2_Grafika", (1.45, 2.21, 1.95), (0.36, 0.005, 0.46), col, mats['plakat_grafika_2'])

    # Drewniana miarka wzrostu
    create_cube("Miarka_Wzrostu", (-0.95, 2.22, 1.25), (0.14, 0.015, 1.30), col, mats['drewno_jasne'], bevel_width=0.003)

    # Polka scienna
    create_cube("Polka_Scienna_Deska", (1.30, 2.20, 1.15), (0.75, 0.16, 0.02), col, mats['drewno_jasne'], bevel_width=0.003)
    create_cube("Polka_Wspornik_L", (1.00, 2.21, 1.10), (0.02, 0.14, 0.10), col, mats['drewno_biale'])
    create_cube("Polka_Wspornik_R", (1.60, 2.21, 1.10), (0.02, 0.14, 0.10), col, mats['drewno_biale'])
    create_cylinder("Zabawka_Drewniany_Ptak", (1.15, 2.14, 1.20), 0.028, 0.06, col, mats['pastel_terracotta'])
    create_cube("Zabawka_Klocek_Arch", (1.45, 2.14, 1.21), (0.08, 0.04, 0.08), col, mats['pastel_blue'], bevel_width=0.004)

def setup_lighting(parent_col):
    col = get_or_create_collection("08_Oswietlenie", parent_col)
    
    # 1. Zlociste swiatlo sloneczne (Sun Light) wpadajace przez okno
    sun_data = bpy.data.lights.new(name="Slonce_Wpadajace", type='SUN')
    sun_data.energy = 6.5
    sun_data.color = (1.0, 0.90, 0.78) # Cieple slonce ~3400K
    sun_data.angle = math.radians(4.5) # Lagodne, miekkie krawedzie cieni
    sun_obj = bpy.data.objects.new("Swiatlo_Slonce", sun_data)
    sun_obj.location = (-4.5, -2.2, 3.8)
    sun_obj.rotation_euler = (math.radians(48), math.radians(-28), math.radians(-52))
    col.objects.link(sun_obj)
    
    # 2. Okno Area Light (Soft Daylight Fill z nieba)
    sky_data = bpy.data.lights.new(name="Okno_Daylight_Fill", type='AREA')
    sky_data.shape = 'RECTANGLE'
    sky_data.size = 1.6
    sky_data.size_y = 1.4
    sky_data.energy = 85.0
    sky_data.color = (0.86, 0.93, 1.0)
    sky_obj = bpy.data.objects.new("Swiatlo_Okno_Area", sky_data)
    sky_obj.location = (-2.46, 0.0, 1.6)
    sky_obj.rotation_euler = (0, math.radians(90), 0)
    col.objects.link(sky_obj)
    
    # 3. Designerska Lampa Wiszaca (Scandinavian Dome Pendant) - subtelna, niezaslaniajaca konstrukcji
    ceil_col = get_or_create_collection("Lampa_Wiszaca_Sufit", col)
    create_cylinder("Lampa_Sufit_Przewod", (0.65, 0.10, 2.72), 0.004, 0.16, ceil_col, bpy.data.materials.get("Mat_Metal_Bialy"))
    create_cylinder("Lampa_Sufit_Klosz", (0.65, 0.10, 2.62), 0.15, 0.09, ceil_col, bpy.data.materials.get("Mat_Drewno_Biale"))
    create_cylinder("Lampa_Sufit_Zarowka", (0.65, 0.10, 2.57), 0.03, 0.03, ceil_col, bpy.data.materials.get("Mat_Swiatlo_Emisja"))
    
    lamp_data = bpy.data.lights.new(name="Lampa_Sufitowa_Punkt", type='POINT')
    lamp_data.energy = 45.0
    lamp_data.color = (1.0, 0.92, 0.82)
    lamp_data.shadow_soft_size = 0.35
    lamp_data.specular_factor = 0.15 # Zapobiega ostrym odbiciom na szybie
    lamp_obj = bpy.data.objects.new("Swiatlo_Lampa_Sufitowa", lamp_data)
    lamp_obj.location = (0.65, 0.10, 2.54)
    ceil_col.objects.link(lamp_obj)
    
    # 4. Swiatlo z lampki biurkowej
    desk_lamp_data = bpy.data.lights.new(name="Lampka_Biurkowa_Swiatlo", type='POINT')
    desk_lamp_data.energy = 15.0
    desk_lamp_data.color = (1.0, 0.88, 0.70)
    desk_lamp_data.shadow_soft_size = 0.10
    desk_lamp_obj = bpy.data.objects.new("Swiatlo_Lampka_Biurkowa", desk_lamp_data)
    desk_lamp_obj.location = (1.05, -1.25, 0.90)
    col.objects.link(desk_lamp_obj)
    
    # 5. Delikatny Warm Fill wnetrza
    fill_data = bpy.data.lights.new(name="Wnetrze_Warm_Fill", type='AREA')
    fill_data.shape = 'DISK'
    fill_data.size = 3.0
    fill_data.energy = 40.0
    fill_data.color = (1.0, 0.96, 0.92)
    fill_obj = bpy.data.objects.new("Swiatlo_Wnetrze_Fill", fill_data)
    fill_obj.location = (2.2, -2.2, 2.5)
    fill_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))
    col.objects.link(fill_obj)

def setup_cameras(parent_col):
    col = get_or_create_collection("09_Kamery", parent_col)
    
    # 1. Kamera Glowna (Izometryczna diorama 3D obejmujaca caly pokoj)
    cam_main_data = bpy.data.cameras.new("Kamera_Glowna_Izometryczna")
    cam_main_data.lens = 45.0
    cam_main_data.clip_start = 0.1
    cam_main_data.clip_end = 100.0
    
    cam_main = bpy.data.objects.new("Kamera_Glowna", cam_main_data)
    cam_main.location = (4.7, -4.5, 4.0)
    look_at(cam_main, Vector((-0.1, 0.25, 0.95)))
    col.objects.link(cam_main)
    
    # 2. Kamera Wnetrze (szerokokątny kadr z perspektywy wejscia do pokoju)
    cam_interior_data = bpy.data.cameras.new("Kamera_Wnetrze_Perspektywa")
    cam_interior_data.lens = 25.0
    cam_interior_data.clip_start = 0.1
    cam_interior_data.clip_end = 100.0
    
    cam_interior = bpy.data.objects.new("Kamera_Wnetrze", cam_interior_data)
    cam_interior.location = (2.15, -1.90, 1.30)
    look_at(cam_interior, Vector((-0.45, 0.7, 1.05)))
    col.objects.link(cam_interior)
    
    bpy.context.scene.camera = cam_main

def create_all_materials():
    mats = {}
    
    # Drewno naturalne, jasne skandynawskie
    mats['drewno_jasne'] = create_wood_material("Mat_Drewno_Jasne", base_rgb=(0.80, 0.65, 0.46), roughness=0.35, noise_scale=18.0)
    mats['drewno_akcent'] = create_wood_material("Mat_Drewno_Akcent", base_rgb=(0.70, 0.54, 0.36), roughness=0.40, noise_scale=14.0)
    mats['drewno_ciemne'] = create_principled_material("Mat_Drewno_Ciemne", (0.38, 0.26, 0.18, 1.0), roughness=0.45)
    mats['drewno_biale'] = create_principled_material("Mat_Drewno_Biale", (0.95, 0.95, 0.94, 1.0), roughness=0.35)
    
    # Ciepla debowa podloga parkietowa
    mats['podloga'] = create_parquet_material("Mat_Podloga_Parkiet", base_rgb=(0.76, 0.58, 0.40))
    
    # Sciany
    mats['sciana_baza'] = create_principled_material("Mat_Sciana_Cieply_Bialy", (0.96, 0.95, 0.93, 1.0), roughness=0.90)
    # Wyrazista, uspokajajaca szałwia skandynawska
    mats['sciana_akcent'] = create_principled_material("Mat_Sciana_Pastelowa_Szalwia", (0.50, 0.60, 0.53, 1.0), roughness=0.88)
    
    # Tkaniny
    mats['tkanina_materac'] = create_principled_material("Mat_Tkanina_Materac", (0.95, 0.94, 0.92, 1.0), roughness=0.95)
    # Ciepla terakota / ceglasty koral poscieli
    mats['tkanina_posciel'] = create_principled_material("Mat_Tkanina_Posciel", (0.80, 0.42, 0.32, 1.0), roughness=0.92)
    mats['tkanina_posciel_akcent'] = create_principled_material("Mat_Tkanina_Posciel_Akcent", (0.96, 0.94, 0.91, 1.0), roughness=0.92)
    mats['tkanina_zaslonka'] = create_principled_material("Mat_Tkanina_Zaslonka", (0.93, 0.92, 0.89, 1.0), roughness=0.85)
    mats['tkanina_materac_crash'] = create_principled_material("Mat_Materac_Asekuracyjny", (0.64, 0.76, 0.72, 1.0), roughness=0.80)
    mats['dywan_pleciony'] = create_principled_material("Mat_Dywan_Pleciony", (0.91, 0.88, 0.84, 1.0), roughness=0.95)
    mats['lina_naturalna'] = create_principled_material("Mat_Lina_Naturalna", (0.88, 0.84, 0.76, 1.0), roughness=0.90)

    # Detale, metal, szklo
    mats['szklo'] = create_principled_material("Mat_Szklo_Okna", (0.95, 0.98, 1.0, 1.0), roughness=0.03, transmission=0.92, ior=1.52)
    mats['mosiadz'] = create_principled_material("Mat_Metal_Mosiadz", (0.86, 0.72, 0.32, 1.0), roughness=0.25, metallic=0.92)
    mats['papier_baza'] = create_principled_material("Mat_Papier_Baza", (0.96, 0.96, 0.95, 1.0), roughness=0.70)
    mats['ceramika_terakota'] = create_principled_material("Mat_Ceramika_Doniczka", (0.78, 0.46, 0.32, 1.0), roughness=0.60)
    mats['roslina_lisc'] = create_principled_material("Mat_Roslina_Zielen", (0.24, 0.46, 0.20, 1.0), roughness=0.40)
    
    # Paleta zabawek i proporczykow
    mats['pastel_mint'] = create_principled_material("Mat_Pastel_Mieta", (0.58, 0.78, 0.72, 1.0), roughness=0.50)
    mats['pastel_mustard'] = create_principled_material("Mat_Pastel_Musztarda", (0.92, 0.72, 0.28, 1.0), roughness=0.50)
    mats['pastel_terracotta'] = create_principled_material("Mat_Pastel_Terakota", (0.82, 0.46, 0.36, 1.0), roughness=0.50)
    mats['pastel_blue'] = create_principled_material("Mat_Pastel_Blekit", (0.52, 0.68, 0.82, 1.0), roughness=0.50)
    mats['pastel_pink'] = create_principled_material("Mat_Pastel_Pudrowy_Roz", (0.90, 0.68, 0.72, 1.0), roughness=0.50)
    
    # Grafiki plakatow
    mats['plakat_grafika_1'] = create_principled_material("Mat_Plakat_Gory", (0.82, 0.78, 0.72, 1.0), roughness=0.60)
    mats['plakat_grafika_2'] = create_principled_material("Mat_Plakat_Balon", (0.74, 0.82, 0.86, 1.0), roughness=0.60)

    # Emisja swiatla
    mats['swiatlo_emisja'] = create_principled_material("Mat_Swiatlo_Emisja", (1.0, 0.94, 0.85, 1.0), emission=(1.0, 0.94, 0.85, 1.0), emission_strength=6.0)
    mats['swiatlo_emisja_cieple'] = create_principled_material("Mat_Swiatlo_Emisja_Cieple", (1.0, 0.85, 0.65, 1.0), emission=(1.0, 0.85, 0.65, 1.0), emission_strength=10.0)
    
    return mats

def main():
    print("=== Rozpoczynanie generowania projektu pokoju dzieciecego ===")
    clear_scene()
    setup_scene_properties()
    
    root_col = bpy.context.scene.collection
    mats = create_all_materials()
    
    build_architecture(root_col, mats)
    build_house_bed(root_col, mats, origin=(1.30, 1.05, 0.0))
    build_desk_and_chair(root_col, mats, origin=(1.35, -1.05, 0.0))
    build_montessori_bookshelf(root_col, mats, origin=(-0.25, 2.05, 0.0))
    setup_wooden_boyz_zone(root_col, mats, blend_path=r"C:\WORK\wooden-boyz\wooden-boyz-laura.blend", origin=(-1.45, 0.95, 0.0))
    build_cozy_center_rug(root_col, mats, origin=(-0.1, -0.1, 0.0))
    build_wall_decorations(root_col, mats)
    setup_lighting(root_col)
    setup_cameras(root_col)
    
    blend_output_path = r"C:\WORK\wooden-boyz\pokoj_dzieciecy.blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend_output_path)
    print(f"=== Projekt zostal pomyslnie zapisany do: {blend_output_path} ===")

if __name__ == "__main__":
    main()
