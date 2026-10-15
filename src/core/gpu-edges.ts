import {
  EdgesGeometry,
  InstancedBufferGeometry,
  LineBasicMaterial,
  LineSegments,
} from "three";
import type { BufferGeometry, ColorRepresentation, InstancedMesh } from "three";

interface CachedEdges {
  geometry: EdgesGeometry;
  references: number;
}

const edgeCache = new WeakMap<BufferGeometry, Map<number, CachedEdges>>();

function acquireEdges(source: BufferGeometry, thresholdAngle: number) {
  let thresholds = edgeCache.get(source);
  if (!thresholds) {
    thresholds = new Map();
    edgeCache.set(source, thresholds);
  }
  let cached = thresholds.get(thresholdAngle);
  if (!cached) {
    cached = {
      geometry: new EdgesGeometry(source, thresholdAngle),
      references: 0,
    };
    thresholds.set(thresholdAngle, cached);
  }
  cached.references++;
  return {
    geometry: cached.geometry,
    release() {
      if (--cached.references === 0) {
        thresholds.delete(thresholdAngle);
        cached.geometry.dispose();
        if (thresholds.size === 0) edgeCache.delete(source);
        return true;
      }
      return false;
    },
  };
}

/** Owns only its VAO; positions belong to the cache and matrices to the mesh. */
class EdgeInstanceGeometry extends InstancedBufferGeometry {
  private disposed = false;
  private sourceDisposed = false;
  private readonly onSourceDispose = () => {
    this.sourceDisposed = true;
  };

  constructor(
    private readonly releaseEdges: () => boolean,
    private readonly source: InstancedMesh,
  ) {
    super();
    source.addEventListener("dispose", this.onSourceDispose);
  }

  override dispose() {
    if (this.disposed) return;
    this.disposed = true;
    // WebGLGeometries removes every attached attribute on the dispose event.
    // Detach borrowed attributes first so other meshes/edge objects stay valid.
    // A render-only BatchedMesh source may never have registered its own
    // instanceMatrix disposal listener with WebGLObjects. Once that source is
    // disposed, this edge geometry must release its uploaded matrix buffer.
    if (!this.sourceDisposed) this.deleteAttribute("instanceMatrix");
    this.source.removeEventListener("dispose", this.onSourceDispose);
    // The cached EdgesGeometry is never submitted to the renderer itself. Its
    // final wrapper must release the position GPU buffer through its own event.
    const lastReference = this.releaseEdges();
    if (!lastReference) this.deleteAttribute("position");
    super.dispose();
    this.deleteAttribute("instanceMatrix");
    this.deleteAttribute("position");
  }
}

export class InstancedEdges extends LineSegments<
  InstancedBufferGeometry,
  LineBasicMaterial
> {
  constructor(
    readonly source: InstancedMesh,
    color: ColorRepresentation,
    thresholdAngle: number,
  ) {
    const cached = acquireEdges(source.geometry, thresholdAngle);
    const geometry = new EdgeInstanceGeometry(cached.release, source);
    geometry.setAttribute("position", cached.geometry.getAttribute("position"));
    geometry.setAttribute("instanceMatrix", source.instanceMatrix);

    const material = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    // Keep Three's clipping, depth, fog and output-color handling. LineSegments
    // does not set USE_INSTANCING, so apply its matrix before project_vertex.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute mat4 instanceMatrix;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed = ( instanceMatrix * vec4( transformed, 1.0 ) ).xyz;",
      );
    };
    material.customProgramCacheKey = () => "gpu-edges-v1";
    super(geometry, material);
    this.name = "Instanced edges";
    this.matrixAutoUpdate = false;
    this.matrixWorldAutoUpdate = false;
    // A base-geometry sphere excludes translated/exploded instances. Avoid an
    // O(instance count) bounds rebuild; the viewer manages whole-model framing.
    this.frustumCulled = false;
    this.raycast = () => {};
    this.onBeforeRender = () => this.syncFromSource();
    this.syncFromSource();
  }

  /** Matrix values are borrowed directly; hide/explode requires no edge rebuild. */
  syncFromSource() {
    const { source, geometry, material } = this;
    geometry.instanceCount = source.visible ? source.count : 0;
    this.matrixWorld.copy(source.matrixWorld);
    const sourceMaterial = Array.isArray(source.material)
      ? source.material[0]
      : source.material;
    material.clippingPlanes = sourceMaterial?.clippingPlanes ?? null;
    material.clipIntersection = sourceMaterial?.clipIntersection ?? false;
    material.clipShadows = sourceMaterial?.clipShadows ?? false;
  }
}

/**
 * Create once per mesh and retain across edge toggles, hide and explode changes.
 * Add beside the source, then dispose geometry and material when clearing it.
 * The source geometry and instanceMatrix must retain their identities; recreate
 * this helper if either is replaced. Mark source.instanceMatrix.needsUpdate after
 * editing it, as for the mesh itself. Material arrays use their first entry's
 * clipping policy (the viewer applies the same section plane to every entry).
 */
export function createInstancedEdges(
  source: InstancedMesh,
  color: ColorRepresentation = 0x536e79,
  thresholdAngle = 25,
) {
  return new InstancedEdges(source, color, thresholdAngle);
}
