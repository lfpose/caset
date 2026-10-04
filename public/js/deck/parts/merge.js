// Draw-call diet: merge every static, opaque mesh under a group into one mesh per
// (material, shadow flags), baking each mesh's transform relative to the group.
import { mergeGeometries } from "../../../vendor/utils/BufferGeometryUtils.js";

export function mergeStatic(THREE, group, { deep = true } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const visit = (o) => {
    for (const c of [...o.children]) {
      if (c.isMesh && !Array.isArray(c.material) && !c.material.transparent && c.visible && !c.userData.keep) {
        const k = `${c.material.uuid}|${c.castShadow}|${c.receiveShadow}|${c.renderOrder}`;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(c);
      } else if (deep && !c.isMesh && c.children.length && !c.userData.keep) visit(c);
    }
  };
  visit(group);
  const m = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((mesh) => {
      m.multiplyMatrices(inv, mesh.matrixWorld);
      let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
      g.clearGroups();
      g.applyMatrix4(m);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const first = list[0];
    const out = new THREE.Mesh(merged, first.material);
    out.castShadow = first.castShadow;
    out.receiveShadow = first.receiveShadow;
    out.renderOrder = first.renderOrder;
    group.add(out);
    for (const mesh of list) mesh.parent.remove(mesh);
  }
  // drop groups left empty
  const prune = (o) => { for (const c of [...o.children]) { if (!c.isMesh && !c.isLight) { prune(c); if (!c.children.length && c.type === "Group") o.remove(c); } } };
  prune(group);
}
