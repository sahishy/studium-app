"""Run in live Blender MCP after importing the current GLB into its own scene.
Preserves its imported Idle NLA track and its existing UV atlas; no geometry rebuild.
"""
import bpy, math, os
from mathutils import Euler, Vector

scene = bpy.context.scene
root = next(o for o in scene.objects if o.name.startswith('StudiumLayeredCrate'))
layers = [next(o for o in scene.objects if o.name.startswith(name)) for name in ['Layer_Bottom', 'Layer_Middle', 'Layer_Top']]
core = next(o for o in scene.objects if o.name.startswith('Core_Cube'))
for o in list(scene.objects):
    if o.name.startswith(('Top_Glow_Plume', 'Top_Emission_Source')):
        bpy.data.objects.remove(o, do_unlink=True)
objects = [root, core] + layers
animated = [root] + layers
for o in animated:
    o.animation_data.action = None
    for track in list(o.animation_data.nla_tracks):
        if track.name != 'Idle': o.animation_data.nla_tracks.remove(track)
        else: track.mute = True
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (1, 0, 0, 0)
root.location = (0, 0, 0)
root.scale = (1, 1, 1)
rest = {o: o.location.copy() for o in animated}

def curve(points, frame):
    if frame <= points[0][0]: return points[0][1]
    for (a, va), (b, vb) in zip(points, points[1:]):
        if frame <= b:
            t = (frame-a)/(b-a)
            t = t*t*(3-2*t)
            return va + (vb-va)*t
    return points[-1][1]

def add_clip(name, frames, pose):
    for index, o in enumerate(animated):
        action = bpy.data.actions.new(name + '_' + o.name)
        o.animation_data.action = action
        for frame in range(1, frames+1):
            xyz, angles, scale = pose(frame, index)
            o.location = rest[o] + Vector(xyz)
            o.rotation_quaternion = Euler(angles, 'XYZ').to_quaternion()
            o.scale = scale
            for path in ['location', 'rotation_quaternion', 'scale']:
                o.keyframe_insert(data_path=path, frame=frame)
        slot = o.animation_data.action_slot
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        o.animation_data.action = None
        track = o.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, action)
        strip.action_slot = slot
        track.mute = True
        o.location = rest[o]
        o.rotation_quaternion = (1, 0, 0, 0)
        o.scale = (1, 1, 1)

def waiting(frame, index):
    t = (frame-1)/120 * math.tau
    if index == 0:
        return ((.035*math.sin(t), .022*math.sin(2*t), .12*(1-math.cos(t))),
                (.016*math.sin(t), .02*math.sin(2*t), .075*math.sin(t)), (1,1,1))
    lag = index*.7
    bob = .035*(math.sin(t+lag)-math.sin(lag)) + .012*math.sin(2*t)
    turn = .025*(math.sin(t+lag)-math.sin(lag))
    return ((0,0,bob), (0,0,turn), (1,1,1))
add_clip('WaitingIdle', 121, waiting)

for name, frames, direction in [('Hit_Left',24,(-.1,.19,-.16)), ('Hit_Right',22,(.14,-.17,.2)), ('Hit_Back',26,(-.2,-.06,.1))]:
    def hit(frame, index, end=frames, direction=direction):
        lag = index*.75
        f = max(1, frame-lag)
        kick = curve([(1,0),(3,1),(7,-.37),(12,.15),(end-4,-.04),(end,0)],f)
        if frame == end: kick = 0
        if index == 0:
            s = curve([(1,1),(3,.88),(7,1.105),(12,.975),(end-4,1.015),(end,1)],frame)
            z = curve([(1,0),(3,-.035),(7,.16),(12,.025),(end,0)],frame)
            return ((direction[1]*kick*.12,0,z), tuple(v*kick for v in direction), (s,s,s))
        z = curve([(1,0),(4,-.025),(8,.04+index*.016),(14,-.012),(end,0)],f)
        if frame == end: z = 0
        return ((0,0,z), (direction[0]*kick*.2, direction[1]*kick*.2, direction[2]*kick*(.8+index*.25)), (1,1,1))
    add_clip(name, frames, hit)

def upgrade(frame, index):
    spin = curve([(1,0),(5,-.16),(12,1.15),(22,4.6),(30,6.55),(35,6.18),(40,math.tau)],frame)
    bob = curve([(1,0),(5,-.03),(12,.22),(24,.34),(32,.07),(40,0)],frame)
    if index == 0:
        s = curve([(1,1),(5,.91),(12,1.08),(28,1.025),(35,.985),(40,1)],frame)
        tilt = .08*math.sin((frame-1)/39*math.tau)
        return ((0,0,bob), (tilt,-tilt*.65,spin), (s,s,s))
    f = max(1,frame-index*.8)
    layer_turn = curve([(1,0),(7,-.1*index),(16,.18*index),(29,-.075*index),(40,0)],f)
    layer_bob = curve([(1,0),(7,.04*index),(20,.065*index),(32,-.015),(40,0)],f)
    if frame == 40: layer_turn = layer_bob = 0
    return ((0,0,layer_bob), (0,0,layer_turn), (1,1,1))
add_clip('Upgrade', 40, upgrade)

scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 121
scene.frame_set(1)
for o in animated:
    for track in o.animation_data.nla_tracks: track.mute = track.name != 'WaitingIdle'
scene['crate_clips'] = 'Idle, WaitingIdle, Hit_Left, Hit_Right, Hit_Back, Upgrade'
scene['animation_notes'] = 'Impact poses return to neutral; Upgrade makes a full turn; atlas and geometry unchanged.'
out = '/Users/sahishdurgam/Documents/AppProjects/studium/artifacts/loot-crate-uv'
bpy.ops.wm.save_as_mainfile(filepath=out+'/loot-crate-interactive.blend', copy=True)

# Temporarily give exported objects/materials their stable runtime names, without
# renaming the user's original scene or altering its actions in the saved session.
renamed = []
names = {root:'StudiumLayeredCrate', core:'Core_Cube', **dict(zip(layers,['Layer_Bottom','Layer_Middle','Layer_Top']))}
for mat in {o.active_material for o in [core]+layers}:
    names[mat] = mat.name.removesuffix('.001')
try:
    for item, desired in names.items():
        collection = bpy.data.objects if isinstance(item,bpy.types.Object) else bpy.data.materials
        conflict = collection.get(desired)
        if conflict and conflict != item:
            renamed.append((conflict, conflict.name))
            conflict.name = '__export_backup_'+desired
        renamed.append((item,item.name))
        item.name = desired
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=out+'/loot-crate-interactive.glb', export_format='GLB', use_selection=True, use_active_scene=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True,
        export_force_sampling=True, export_frame_range=False)
finally:
    for item, name in reversed(renamed): item.name = name
print('Created six clips and exported interactive crate without changing the UV atlas.')
