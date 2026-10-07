"""Run through Blender MCP in Studium_InteractiveDrop; preserve all existing clips and UVs."""
import bpy, math
from mathutils import Euler, Vector

scene = bpy.context.scene
root = next(o for o in scene.objects if o.name.startswith('StudiumLayeredCrate'))
layers = [next(o for o in scene.objects if o.name.startswith(n)) for n in ['Layer_Bottom','Layer_Middle','Layer_Top']]
core = next(o for o in scene.objects if o.name.startswith('Core_Cube'))
animated = [root] + layers
for obj in animated:
    obj.animation_data.action = None
    for track in list(obj.animation_data.nla_tracks):
        if track.name == 'RevealBurst': obj.animation_data.nla_tracks.remove(track)
        else: track.mute = True
scene.frame_set(1)
root.location = (0,0,0)
root.rotation_quaternion = (1,0,0,0)
root.scale = (1,1,1)
rest = {obj: obj.location.copy() for obj in animated}

def curve(points, frame):
    if frame <= points[0][0]: return points[0][1]
    for (a,va),(b,vb) in zip(points,points[1:]):
        if frame <= b:
            t=(frame-a)/(b-a); t=t*t*(3-2*t)
            return va+(vb-va)*t
    return points[-1][1]

def pose(frame,index):
    energy = curve([(1,0),(6,.28),(11,.6),(16,1),(18,.25),(21,0),(27,0)],frame)
    jitter = math.sin(frame*2.05) * energy
    jitter2 = math.sin(frame*2.73+.6) * energy
    burst = curve([(1,0),(16,0),(19,1),(22,1.16),(27,1.08)],frame)
    if index == 0:
        size = curve([(1,1),(7,.98),(13,.94),(16,.90),(19,1.29),(22,1.21),(27,1.16)],frame)
        bob = curve([(1,0),(7,.015),(16,-.05),(19,.18),(22,.26),(27,.2)],frame)
        return ((jitter*.027,jitter2*.018,bob),
                (jitter*.034,jitter2*.027,jitter*.035+burst*.08), (size,size,size))
    side = [-1,1,-1][index-1]
    spread_z = [-.30,.18,.82][index-1] * burst
    twist = side*(jitter*.028*index + burst*(.10+index*.065))
    squeeze = -index*.025*energy
    return ((side*.12*burst, .045*burst*(index-2), spread_z+squeeze+jitter2*.012*index),
            (side*.075*burst,jitter*.01,twist), (1,1,1))

for index,obj in enumerate(animated):
    action = bpy.data.actions.new('RevealBurst_'+obj.name)
    obj.animation_data.action = action
    obj.rotation_mode = 'QUATERNION'
    for frame in range(1,28):
        xyz,angles,scale = pose(frame,index)
        obj.location = rest[obj] + Vector(xyz)
        obj.rotation_quaternion = Euler(angles,'XYZ').to_quaternion()
        obj.scale = scale
        for path in ['location','rotation_quaternion','scale']: obj.keyframe_insert(data_path=path,frame=frame)
    slot = obj.animation_data.action_slot
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points: key.interpolation = 'LINEAR'
    obj.animation_data.action = None
    track = obj.animation_data.nla_tracks.new(); track.name = 'RevealBurst'
    strip = track.strips.new('RevealBurst',1,action); strip.action_slot = slot
    track.mute = False
    obj.location = rest[obj]; obj.rotation_quaternion = (1,0,0,0); obj.scale = (1,1,1)

scene.render.fps = 24
scene.frame_set(1)
scene['crate_clips'] = 'Idle, WaitingIdle, Hit_Left, Hit_Right, Hit_Back, Upgrade, RevealBurst'
scene['reveal_burst_cue_seconds'] = 17/24
scene['reveal_burst_notes'] = '27-frame charge and pop. Start UI fade and rarity flash at 17/24 seconds.'
out = '/Users/sahishdurgam/Documents/AppProjects/studium/artifacts/loot-crate-uv'
bpy.ops.wm.save_as_mainfile(filepath=out+'/loot-crate-reveal-burst.blend',copy=True)

renamed=[]
names={root:'StudiumLayeredCrate',core:'Core_Cube',**dict(zip(layers,['Layer_Bottom','Layer_Middle','Layer_Top']))}
for mat in {o.active_material for o in [core]+layers}: names[mat]=mat.name.removesuffix('.001')
try:
    for item,desired in names.items():
        collection=bpy.data.objects if isinstance(item,bpy.types.Object) else bpy.data.materials
        conflict=collection.get(desired)
        if conflict and conflict != item:
            renamed.append((conflict,conflict.name)); conflict.name='__export_backup_'+desired
        renamed.append((item,item.name)); item.name=desired
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,core]+layers: obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=out+'/loot-crate-reveal-burst.glb',export_format='GLB',use_selection=True,use_active_scene=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_frame_range=False)
finally:
    for item,name in reversed(renamed): item.name=name
print('Added RevealBurst; retained six existing clips, four meshes and the shared atlas.')
