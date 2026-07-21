import bpy, os

# Clear the default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

fbx_dir = r"D:\AGENT WORKSPACE\blender\for ICE parallax\circle donut"

# Import all 6 pieces WITHOUT altering their transforms — inspection
# showed they already tile into one broken ring by their baked
# positions (angular centers ~60 deg apart with slight irregular
# gaps, radius ~1.47), so importing them together into one scene
# reconstructs the ring exactly as modeled.
for i in range(1, 7):
    path = os.path.join(fbx_dir, f"{i}.fbx")
    bpy.ops.import_scene.fbx(filepath=path)

# Parent everything under one empty so it exports as a single
# logical group (three.js side can just load the whole scene).
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
root = bpy.context.active_object
root.name = "PortalRing"
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH':
        obj.select_set(True)
        bpy.context.view_layer.objects.active = root
bpy.context.view_layer.objects.active = root
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.parent is None:
        obj.parent = root

out_path = r"D:\AGENT WORKSPACE\ice-parallax\public\models\portal-ring.glb"
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB')
print("EXPORTED", out_path)
