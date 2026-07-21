import bpy, sys, json, os

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)

def bbox_info():
    info = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        obj.select_set(False)
        bbox_corners = [obj.matrix_world @ __import__('mathutils').Vector(c) for c in obj.bound_box]
        xs = [c.x for c in bbox_corners]; ys = [c.y for c in bbox_corners]; zs = [c.z for c in bbox_corners]
        mats = [m.name for m in obj.data.materials] if obj.data.materials else []
        has_uv = len(obj.data.uv_layers) > 0
        info.append({
            "name": obj.name,
            "verts": len(obj.data.vertices),
            "polys": len(obj.data.polygons),
            "loc": list(obj.location),
            "rot_euler": list(obj.rotation_euler),
            "scale": list(obj.scale),
            "bbox_min": [min(xs), min(ys), min(zs)],
            "bbox_max": [max(xs), max(ys), max(zs)],
            "materials": mats,
            "has_uv": has_uv,
        })
    return info

results = {}

glb_dir = r"D:\AGENT WORKSPACE\blender\for ICE parallax\3 crystal ice"
for fname in ["Crystal 1.glb", "Crystal 2.glb", "ice_cube_texture.glb"]:
    clear_scene()
    path = os.path.join(glb_dir, fname)
    bpy.ops.import_scene.gltf(filepath=path)
    results[fname] = bbox_info()

fbx_dir = r"D:\AGENT WORKSPACE\blender\for ICE parallax\circle donut"
for i in range(1, 7):
    fname = f"{i}.fbx"
    clear_scene()
    path = os.path.join(fbx_dir, fname)
    bpy.ops.import_scene.fbx(filepath=path)
    results[fname] = bbox_info()

out_path = r"D:\AGENT WORKSPACE\ice-parallax\scripts\asset_inspect.json"
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)
print("WROTE", out_path)
