"""Maja: editable wooden geometry reconstructed from maja-11-min.jpeg.
Author: colordrop.pl. Units: metres. No accessories or hardware.
"""
import bpy, bmesh, math, json, os
from mathutils import Vector

OUT_DIRS = [r'C:\WORK\wooden-boyz\modele\maja', r'C:\WORK\wooden-boyz\modele\maja\v2']
for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)
OUT = OUT_DIRS[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'METERS'
scene.unit_settings.scale_length = 1
root = bpy.data.collections.new('MAJA | tylko drewno')
scene.collection.children.link(root)
groups = {}
for name in ['01 Konstrukcja 7x7', '02 Zastrzaly 7x7', '03 Podesty i obramowanie 10x2', '04 Lamele 4x3', '05 Rampa drewniana', '06 Schodki drewniane']:
    c = bpy.data.collections.new(name)
    root.children.link(c)
    groups[name[:2]] = c

def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color,1)
    p.inputs['Roughness'].default_value = .72
    return m
wood = mat('Drewno naturalne | kolor pogladowy', (.57,.34,.15))
black = mat('Drewno malowane na czarno', (.018,.022,.025))
objects = []
def box(name, loc, dims, group, material=wood, section=''):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for c in list(o.users_collection): c.objects.unlink(o)
    groups[group].objects.link(o)
    o.data.materials.append(material)
    o['przekroj_nominalny'] = section
    o['material'] = 'drewno'
    bevel = o.modifiers.new('Delikatne krawedzie 1 mm', 'BEVEL')
    bevel.width = .001
    bevel.segments = 2
    objects.append(o)
    return o
def beam(name,a,b,group='01',material=black):
    a,b=Vector(a),Vector(b)
    o=box(name,(a+b)/2,(.07,.07,(b-a).length),group,material,'7 x 7 cm')
    o.rotation_mode='QUATERNION'
    o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    return o
def brace(name,a,b):
    """7x7 stock, axis at 45 degrees, vertical first and horizontal second cut.
    End faces are geometric mitres, not bevel modifiers or rotated square ends.
    a and b are the centres of the two contact faces.
    """
    a,b=Vector(a),Vector(b)
    h=0 if abs(b.x-a.x)>.00001 else 1
    depth=1-h
    slope=(b.z-a.z)/(b[h]-a[h])
    assert abs(abs(slope)-1)<1e-6
    q=.07/math.sqrt(2)
    polygon=[(a[h],a.z-q),(b[h]+q/slope,b.z),
             (b[h]-q/slope,b.z),(a[h],a.z+q)]
    vertices=[]
    for offset in [-.035,.035]:
        for u,z in polygon:
            p=a.copy(); p[h]=u; p.z=z; p[depth]+=offset
            vertices.append(tuple(p))
    faces=[(0,3,2,1),(4,5,6,7)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
    mesh=bpy.data.meshes.new(name+' | ciecia 45 stopni')
    mesh.from_pydata(vertices,[],faces); mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    o=bpy.data.objects.new(name,mesh); groups['02'].objects.link(o)
    o.data.materials.append(wood)
    o['material']='drewno'; o['przekroj_nominalny']='7 x 7 cm'
    o['kat_ciecia_stopnie']=45.; o['kat_osi_stopnie']=45.
    o['styk_pionowy']=list(a); o['styk_poziomy']=list(b)
    bevel=o.modifiers.new('Krawedzie 1 mm','BEVEL'); bevel.width=.001; bevel.segments=2
    objects.append(o)
    return o
def centers(a,b,w):
    n=max(1,round((b-a)/(.04+.025)))
    if n==1: return [(a+b)/2]
    return [a+w/2+i*(b-a-w)/(n-1) for i in range(n)]
def slats(name, fixed, a,b,z0,z1,plane):
    for i,t in enumerate(centers(a,b,.04)):
        loc=(fixed,t,(z0+z1)/2) if plane=='YZ' else (t,fixed,(z0+z1)/2)
        dims=(.03,.04,z1-z0) if plane=='YZ' else (.04,.03,z1-z0)
        box(f'{name} | lamela {i+1:02}',loc,dims,'04',section='4 x 3 cm')

# Main frame occupies x=0..4; rear ramp is included in the 2 m depth.
X=[.065,1.215,3.935]
Y=[.065,1.115]
H=2.4
for ix,x in enumerate(X):
    for iy,y in enumerate(Y):
        box(f'Slup {ix+1}.{iy+1}',(x,y,1.2),(.07,.07,H),'01',black,'7 x 7 cm')
for y in Y:
    box('Belka gorna wzdluzna',(2,y,2.365),(3.94,.07,.07),'01',black,'7 x 7 cm')
for x in X:
    box('Belka gorna poprzeczna',(x,.59,2.365),(.07,.98,.07),'01',black,'7 x 7 cm')
# Two wooden top members visible over the swing bay.
for x in [2.12,3.025]:
    box('Poprzeczka nad przeslem',(x,.59,2.365),(.07,.98,.07),'01',black,'7 x 7 cm')
for x in [X[0],X[1]]:
    for z in [.165,1.145]:
        box('Legar boczny wiezy',(x,.59,z),(.07,.98,.07),'01',black,'7 x 7 cm')
for y in Y:
    for z in [.165,1.145]:
        box('Rygiel podestu',(.64,y,z),(1.08,.07,.07),'01',black,'7 x 7 cm')
for z in [.165,1.145]:
    box('Legar srodkowy',(.64,.59,z),(.07,.98,.07),'01',black,'7 x 7 cm')
for z in [.07,1.04]:
    box('Rygiel sciany koncowej',(3.935,.59,z),(.07,.98,.07),'01',black,'7 x 7 cm')

for y in Y:
    brace('Zastrzal podestu lewy',(.1,y,.81),(.4,y,1.11))
    brace('Zastrzal podestu prawy',(1.18,y,.81),(.88,y,1.11))
    brace('Zastrzal gorny przy wiezy',(1.25,y,2.04),(1.54,y,2.33))
    brace('Zastrzal gorny na koncu',(3.9,y,2.04),(3.61,y,2.33))
for a,b in [((3.935,.1,1.89),(3.935,.54,2.33)),((3.935,1.08,1.89),(3.935,.64,2.33)),((3.935,.1,.485),(3.935,.48,.105)),((3.935,1.08,.485),(3.935,.7,.105))]:
    brace('Zastrzal sciany koncowej',a,b)

# 10 cm wide x 2 cm thick deck boards; 5 mm gaps.
# Upper platform deck
for i in range(10):
    box(f'Podest gorny | deska {i+1:02}',(.64,.1175+i*.105,1.19),(1.08,.10,.02),'03',section='10 x 2 cm')

# Integrated sandbox at the bottom of the tower:
# Perimeter side boards (2 stacked 10x2 cm boards = 20 cm height)
for z in [.06,.16]:
    box('Piaskownica obramowanie przod',(.64,.02,z),(1.15,.02,.10),'03',section='10 x 2 cm')
    box('Piaskownica obramowanie lewe',(.02,.59,z),(.02,1.15,.10),'03',section='10 x 2 cm')
    box('Piaskownica obramowanie prawe',(1.26,.59,z),(.02,1.15,.10),'03',section='10 x 2 cm')
# Seating bench on top of the front of the sandbox (as seen in maja-11-min.jpeg)
box('Piaskownica siedzisko deska 01',(.64,.06,.21),(1.15,.10,.02),'03',section='10 x 2 cm')
box('Piaskownica siedzisko deska 02',(.64,.165,.21),(1.15,.10,.02),'03',section='10 x 2 cm')

slats('Sciana lewa pelna',.015,.03,1.15,.01,2.4,'YZ')
slats('Sciana koncowa pelna',3.985,.03,1.15,.01,2.4,'YZ')
slats('Balustrada wiezy od przesla',1.265,.10,1.08,1.2,2.4,'YZ')

# Front balustrade: solid slats on left (X=0.08..0.64), slide opening on right (X=0.64..1.14), 1 slat next to right post
slats('Balustrada przod lewa',.015,.08,.64,1.2,2.4,'XZ')
box('Balustrada przod prawa | lamela przy slupie',(1.16,.015,1.8),(.04,.03,1.2),'04',section='4 x 3 cm')

for x in [.065,.64,1.215]:
    box('Tyl | lamela przy wejsciu',(x,1.165,1.8),(.04,.03,1.2),'04',section='4 x 3 cm')
box('Prog obu wejsc',(.64,1.1675,1.19),(1.08,.10,.02),'03',section='10 x 2 cm')

# Rear ramp. Side members stay within the stated overall 2 m depth.
sy,sz,ez=1.19,1.14,.065
ey=1.97
for _ in range(20): ey=2-.035*(sz-ez)/math.hypot(ey-sy,sz-ez)
for x,label,group in [(.065,'Rampa lewy','05'),(.64,'Wspolny rampy i schodkow','05'),(1.215,'Schodki prawy','06')]:
    beam(label+' | policzek 7x7',(x,sy,sz),(x,ey,ez),group,black)
a,b=Vector((.3525,sy,sz)),Vector((.3525,ey,ez))
d=(b-a).normalized()
normal=Vector((0,-d.z,d.y))
length=(b-a).length
n=int(length/.105)
for i in range(n):
    p=a+d*(.09+i*(length-.18)/(n-1))+normal*.045
    o=box(f'Rampa | deska {i+1:02}',p,(.505,.10,.02),'05',section='10 x 2 cm')
    o.rotation_euler.x=math.atan2(d.z,d.y)

# Five horizontal wooden treads; the platform is the final sixth level.
# 10x2 boards are mounted on 4x3 timber cleats along the side members.
for i in range(1,6):
    top=.2*i
    y=sy+(ey-sy)*(sz-(top-.035))/(sz-ez)
    box(f'Schodki | stopien {i:02}',(.9275,y,top-.01),(.505,.10,.02),'06',black,'10 x 2 cm')
    for x in [.69,1.165]:
        box(f'Schodki | podparcie stopnia {i:02}',(x,y,top-.04),(.03,.10,.04),'06',black,'4 x 3 cm')

# Validate unmodified bounds and dimensions before saving/exporting.
verts=[o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
bpy.context.view_layer.update()
verts=[o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
lo=[min(v[i] for v in verts) for i in range(3)]
hi=[max(v[i] for v in verts) for i in range(3)]
dims=[hi[i]-lo[i] for i in range(3)]
assert abs(dims[0]-4)<1e-5, dims
assert dims[1]<=2.0001, dims
assert abs(dims[2]-2.4)<1e-5, dims
scene['Zalozenia']='4 x 2 m z rampa i schodkami; podest 1.2 m; wysokosc 2.4 m. Rekonstrukcja wizualna galerii Maja, niewidoczne detale przyblizone.'
scene['Autor']='colordrop.pl'
report={'objects':len(objects),'bounds_min_m':lo,'bounds_max_m':hi,'overall_m':dims,'platform_top_m':1.2,'brace_end_cut_degrees':45,'stair_tread_count':5,'source':'https://woodenboyz.pl/produkt/maja/','sections_cm':{'frame':[7,7],'boards':[10,2],'slats':[4,3]},'assumptions':['4 x 2 m includes the wooden rear ramp and adjacent stairs','Main frame depth 1.18 m; tower width approximately 1.3 m','Heights and obscured rear details estimated from gallery photographs','No hardware, swings, slide or ropes; black frame is painted wood']}
cut_checks=[]
for o in groups['02'].objects:
    bm=bmesh.new(); bm.from_mesh(o.data)
    assert all(e.is_manifold for e in bm.edges), o.name
    assert bm.calc_volume(signed=True)>0, o.name
    bm.free()
    direction=(Vector(o['styk_poziomy'])-Vector(o['styk_pionowy'])).normalized()
    # Side indices 3 and 5 are the horizontal and vertical end cuts.
    angles=[math.degrees(math.acos(min(1.,abs(o.data.polygons[j].normal.dot(direction))))) for j in [3,5]]
    assert all(abs(angle-45)<.001 for angle in angles), (o.name,angles)
    cut_checks.append({'name':o.name,'end_normal_angles_degrees':angles})
report['verified_brace_cuts']=cut_checks
for out_dir in OUT_DIRS:
    with open(os.path.join(out_dir,'wymiary.json'),'w',encoding='utf-8') as f:
        json.dump(report,f,ensure_ascii=False,indent=2)

# Isolate presentation equipment from the wooden model.
studio=bpy.data.collections.new('PREZENTACJA | kamery i swiatla')
scene.collection.children.link(studio)
def to_studio(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    studio.objects.link(o)

def camera(name,pos,target,cam_type='ORTHO',ortho_scale=5.7,lens=50):
    bpy.ops.object.camera_add(location=pos)
    o=bpy.context.object; o.name=name; to_studio(o)
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    o.data.type=cam_type
    if cam_type=='ORTHO':
        o.data.ortho_scale=ortho_scale
    else:
        o.data.lens=lens
    return o

front=camera('Widok od zjezdzalni',(-4.8,-7.8,4.5),(1.85,.6,1.15),'ORTHO',5.7)
rear=camera('Widok od rampy',(6.5,7.5,4.6),(1.8,.85,1.15),'ORTHO',5.7)
akso=camera('Widok perspektywiczny',(-5.5,-6.2,3.8),(2.0,.7,1.0),'PERSP',lens=42)

scene.camera=front
world=bpy.data.worlds.new('Neutralne jasne tlo | colordrop.pl')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.92,.93,.95,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.8

# Studio key, fill, and rim lights
for pos,power,size in [((-3,-5,7),2200,6),((6,4,6),1800,5),((0,6,5),1200,4)]:
    bpy.ops.object.light_add(type='AREA',location=pos)
    o=bpy.context.object; to_studio(o); o.data.energy=power; o.data.shape='DISK'; o.data.size=size
    o.rotation_euler=(Vector((2,.6,1))-o.location).to_track_quat('-Z','Y').to_euler()

scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.render.resolution_x=1600
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'

bpy.ops.object.select_all(action='DESELECT')
for o in objects: o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=6
            area.spaces.active.region_3d.view_location=(2,.7,1.2)
            area.spaces.active.region_3d.view_rotation=front.rotation_euler.to_quaternion()
            area.spaces.active.clip_end=100

for out_dir in OUT_DIRS:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir,'maja-drewno.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir,'maja-drewno.glb'),use_selection=True,export_apply=True,export_format='GLB')

renders = [(front,'maja-przod.png'),(rear,'maja-tyl.png'),(akso,'maja-akso.png')]
for cam,name in renders:
    scene.camera=cam
    temp_path=os.path.join(OUT_DIRS[0],name)
    scene.render.filepath=temp_path
    bpy.ops.render.render(write_still=True)
    import shutil
    for out_dir in OUT_DIRS[1:]:
        shutil.copyfile(temp_path, os.path.join(out_dir, name))

print('MAJA_DONE',json.dumps(report))
