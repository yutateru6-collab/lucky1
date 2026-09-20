"""Reproducible original Lucky asset. Run with Blender --background --python.
No external images, downloaded models or trademarked artwork.
Blender Z-up becomes glTF Y-up; the clover (heads) face is +Y.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/reveal'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0.8,rough=0.27):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
GOLD=material('Champagne gold',(0.72,0.45,0.12),0.86,0.24)
PALE=material('Polished raised gold',(0.94,0.72,0.33),0.86,0.2)
PINK=material('Rose enamel',(0.69,0.18,0.34),0.18,0.3)
CREAM=material('Cream enamel',(0.95,0.83,0.59),0.25,0.32)

def finish(o,name,mat,bevel=0):
    o.name=name;o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft minted edges','BEVEL');b.width=bevel;b.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def cylinder(name,r,depth,z,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=depth,location=(0,0,z))
    return finish(bpy.context.object,name,mat,.007)

def ring(name,r,z,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=8,location=(0,0,z),major_radius=r,minor_radius=.009)
    return finish(bpy.context.object,name,mat)

cylinder('Coin body',.76,.118,0,GOLD)
for sign,side in [(1,'heads'),(-1,'tails')]:
    cylinder(side+' inset',.683,.008,sign*.060,GOLD)
    ring(side+' rim',.718,sign*.064,PALE)
    ring(side+' inner border',.635,sign*.065,PALE)
    # Dotted minted border, represented by solid geometry, not a CSS texture.
    for i in range(40):
        a=i*math.tau/40
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.012,location=(.665*math.cos(a),.665*math.sin(a),sign*.067))
        o=bpy.context.object;o.scale.z=.45;finish(o,side+' bead',PALE)
# Milled edge glints change with view and lighting.
for i in range(96):
    a=i*math.tau/96
    bpy.ops.mesh.primitive_cube_add(size=1,location=(.754*math.cos(a),.754*math.sin(a),0))
    o=bpy.context.object;o.scale=(.008,.009,.083);o.rotation_euler.z=a
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,'Milled edge',PALE,.002)
# Four rounded leaves and an embossed stem. Heads is a clover, tails a star.
for x,y in [(-.12,.105),(.12,.105),(-.12,-.10),(.12,-.10)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(x,y,.079))
    o=bpy.context.object;o.scale=(.166,.159,.022);finish(o,'Heads clover',PALE)
# Rose enamel centre.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=8,radius=1,location=(0,0,.087))
o=bpy.context.object;o.scale=(.051,.051,.01);finish(o,'Clover centre',PINK)
verts=[]
for z in [-.068,-.094]:
    for i in range(16):
        a=math.pi/2+i*math.tau/16;r=.29 if i%2==0 else .12
        verts.append((math.cos(a)*r,math.sin(a)*r,z))
faces=[tuple(range(15,-1,-1)),tuple(range(16,32))]
faces += [(i,(i+1)%16,(i+1)%16+16,i+16) for i in range(16)]
mesh=bpy.data.meshes.new('Star mesh');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Tails compass star',mesh);bpy.context.collection.objects.link(o);finish(o,'Tails compass star',PALE,.006)

def text(body,y,z,sign,size):
    curve=bpy.data.curves.new('Coin lettering','FONT');curve.body=body;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.0018;curve.bevel_depth=.0007
    o=bpy.data.objects.new(body,curve);bpy.context.collection.objects.link(o);o.location=(0,y,z)
    if sign<0:o.rotation_euler.x=math.pi
    o.data.materials.append(CREAM)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
for sign,word in [(1,'HEADS'),(-1,'TAILS')]:
    text('lucky',.445*sign,.073*sign,sign,.128)
    text(word,-.43*sign,.073*sign,sign,.068)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'lucky-coin.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)
print('Lucky coin exported:',(OUT/'lucky-coin.glb').stat().st_size,'bytes')
