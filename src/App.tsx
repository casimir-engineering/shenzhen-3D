import { version as appVersion } from "../package.json";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Vector3 } from "three";
import { createId } from "./core/id";
import {
  Box,
  Upload,
  MousePointer2,
  ScanLine,
  Layers,
  Ruler,
  Move3D,
  Route,
  Triangle,
  Maximize,
  Camera,
  Grid3X3,
  Scissors,
  Settings2,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  Focus,
  Plus,
  Trash2,
  Download,
  Check,
  Copy,
  Sun,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  RotateCcw,
  LoaderCircle,
  FolderOpen,
  FileBox,
  Magnet,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
  Info,
  MessageSquare,
  Share2,
} from "lucide-react";
import { Viewport } from "./components/Viewport";
import { AssemblyTree } from "./components/AssemblyTree";
import { ReviewPanel } from "./components/ReviewPanel";
import { ReviewPins } from "./components/ReviewPins";
import {
  DisplaySettings,
  RenderStyleSelect,
  DEFAULT_DISPLAY,
  type DisplayOptions,
} from "./components/DisplaySettings";
import type { ReviewNote } from "./core/project-file";
import type { Viewer } from "./core/viewer";
import type { RayTracingState } from "./core/ray-tracing-types";
import { ACCEPT } from "./core/formats";
import { cad } from "./core/cad-client";
import {
  UNITS,
  conversion,
  formatValue,
  pointDistance,
  threePointAngle,
} from "./core/units";
import { isNative, nativeOpen, saveBlob } from "./core/files";
import type {
  ModelDocument,
  Pick,
  SelectionMode,
  FeatureFilter,
  ToolMode,
  Measurement,
  FeatureProperties,
  Unit,
  Vec3,
  ExactPair,
} from "./core/types";
type ModelRuntime = typeof import("./core/model-runtime");
// Failed chunk fetches can be retried by opening a file again.
let runtimePromise: Promise<ModelRuntime> | undefined;
const loadRuntime = () =>
  (runtimePromise ??= import("./core/model-runtime").catch((error) => {
    runtimePromise = undefined;
    throw error;
  }));
const readPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem("shenzhen-preferences") || "{}");
  } catch {
    return {};
  }
};
const uid = createId;
function noteTarget(pick: Pick, scope: ReviewNote["scope"]): Pick {
  return scope === "feature"
    ? pick
    : { ...pick, kind: "point", elementId: undefined };
}
function IconButton({
  title,
  active,
  onClick,
  children,
  disabled = false,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Metric({
  label,
  value,
  unit,
  axis,
}: {
  label: string;
  value: string;
  unit?: string;
  axis?: string;
}) {
  return (
    <div className="metric">
      <span className={axis ? "axis-" + axis : ""}>{label}</span>
      <strong>{value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  );
}
function App() {
  const preferences = useRef(readPrefs());
  const [doc, setDoc] = useState<ModelDocument>();
  const docRef = useRef<ModelDocument | undefined>(undefined);
  docRef.current = doc;
  const viewer = useRef<Viewer | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [runtime, setRuntime] = useState<ModelRuntime>();
  const [viewerAttempt, setViewerAttempt] = useState(0);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [dimensions, setDimensions] = useState<Vector3>();
  const fileInput = useRef<HTMLInputElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SelectionMode>("point"),
    [filter, setFilter] = useState<FeatureFilter>("auto"),
    [tool, setTool] = useState<ToolMode>("distance"),
    [snap, setSnap] = useState(true);
  const [distanceReference, setDistanceReference] = useState<
    "minimum" | "center" | "picked"
  >("minimum");
  const [points, setPoints] = useState<Pick[]>([]),
    [current, setCurrent] = useState<Measurement>(),
    [properties, setProperties] = useState<FeatureProperties>(),
    [pair, setPair] = useState<ExactPair>();
  const [saved, setSaved] = useState<Measurement[]>([]),
    [selectedPart, setSelectedPart] = useState<string>(),
    [hidden, setHidden] = useState<Set<string>>(new Set());
  const [unit, setUnit] = useState<Unit>(preferences.current.unit || "mm"),
    [source, setSource] = useState<Unit>("mm"),
    [scale, setScale] = useState(1),
    [precision, setPrecision] = useState(preferences.current.precision ?? 3);
  const [theme, setTheme] = useState<"dark" | "light">(
      preferences.current.theme || "dark",
    ),
    [navigation, setNavigation] = useState<"mouse" | "trackpad">(
      preferences.current.navigation || "mouse",
    );
  const [navigationDetail, setNavigationDetail] = useState<"auto" | "full">(
    preferences.current.navigationDetail === "full" ? "full" : "auto",
  );
  const [usingNavigationDetail, setUsingNavigationDetail] = useState(false);
  const [display, setDisplay] = useState<DisplayOptions>(DEFAULT_DISPLAY);
  const [rayTracing, setRayTracing] = useState(false);
  const [raySamples, setRaySamples] = useState<32 | 128 | 512>(128);
  const [rayResolution, setRayResolution] = useState<0.5 | 1>(0.5);
  const [rayState, setRayState] = useState<RayTracingState>();
  const lastRayUpdate = useRef(0);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<string>();
  const [noteScope, setNoteScope] = useState<ReviewNote["scope"]>("point");
  const [placingNote, setPlacingNote] = useState(false);
  const [noteAnchor, setNoteAnchor] = useState<Pick>();
  const [sharing, setSharing] = useState(false);
  const sourceFiles = useRef<File[]>([]);
  const demoProject = useRef(false);
  const [edges, setEdges] = useState(false),
    [grid, setGrid] = useState(true),
    [opacity, setOpacity] = useState(1),
    [explode, setExplode] = useState(0),
    [section, setSection] = useState(false),
    [sectionAxis, setSectionAxis] = useState<"x" | "y" | "z">("z"),
    [sectionPosition, setSectionPosition] = useState(0.5),
    [ortho, setOrtho] = useState(false);
  const [left, setLeft] = useState(window.innerWidth > 900),
    [right, setRight] = useState(window.innerWidth > 700),
    [panel, setPanel] = useState<"measure" | "saved" | "review">("measure");
  const [loading, setLoading] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [hover, setHover] = useState(""),
    [dragging, setDragging] = useState(false),
    [quality, setQuality] = useState("balanced"),
    [measuring, setMeasuring] = useState(false);
  const epoch = useRef(0),
    loadEpoch = useRef(0);
  const [recent, setRecent] = useState<{ name: string; format: string }[]>(
    () => {
      try {
        return JSON.parse(localStorage.getItem("shenzhen-recent") || "[]");
      } catch {
        return [];
      }
    },
  );
  const number = useCallback(
    (value: number, power = 1) =>
      formatValue(
        value * Math.pow(scale, power),
        source,
        unit,
        precision,
        power,
      ),
    [source, unit, precision, scale],
  );
  const notify = (message: string) => {
    setToast(message);
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(
      "shenzhen-preferences",
      JSON.stringify({ unit, precision, theme, navigation, navigationDetail }),
    );
  }, [unit, precision, theme, navigation, navigationDetail]);
  const clear = useCallback(() => {
    epoch.current++;
    setPoints([]);
    setCurrent(undefined);
    setProperties(undefined);
    setPair(undefined);
    setMeasuring(false);
    setPlacingNote(false);
    setNoteAnchor(undefined);
    viewer.current?.highlight([]);
    viewer.current?.setOverlay({ points: [] });
  }, []);
  const install = useCallback(
    (model: ModelDocument) => {
      clear();
      setSaved([]);
      setNotes([]);
      setSelectedNote(undefined);
      setHidden(new Set());
      setSelectedPart(undefined);
      setSource(model.unit);
      setScale(1);
      setExplode(0);
      setSection(false);
      setOpacity(1);
      setDoc(model);
      setOrtho(model.is2D);
    },
    [clear],
  );
  useEffect(() => {
    if (ready && doc) {
      viewer.current!.setModel(doc);
      setDimensions(
        viewer.current!.getBounds().getSize(new runtime!.Vector3()),
      );
    }
  }, [doc, ready]);
  useEffect(() => {
    if (ready)
      viewer.current!.applyOptions({
        edges,
        grid,
        opacity,
        explode,
        section,
        sectionAxis,
        sectionPosition,
        hidden,
        theme,
        navigation,
        navigationDetail,
        ...display,
        rayTracing,
        raySamples,
        rayResolution,
      });
  }, [
    ready,
    doc,
    edges,
    grid,
    opacity,
    explode,
    section,
    sectionAxis,
    sectionPosition,
    hidden,
    theme,
    navigation,
    navigationDetail,
    display,
    rayTracing,
    raySamples,
    rayResolution,
  ]);
  useEffect(() => {
    viewer.current?.setSelectionMode(mode, filter, snap);
  }, [mode, filter, snap, ready]);
  useEffect(() => {
    viewer.current?.setProjection(ortho);
  }, [ortho, ready]);
  const demo = async () => {
    const generation = ++loadEpoch.current;
    cad.cancel();
    clear();
    viewer.current?.clearModel();
    if (docRef.current) runtime!.disposeDocument(docRef.current);
    setDoc(undefined);
    setError("");
    setLoading("Opening sample model…");
    try {
      const engine = await loadRuntime();
      if (generation !== loadEpoch.current) return;
      setRuntime(engine);
      if (!ready) {
        setViewerFailed(false);
        setViewerAttempt((old) => old + 1);
      }
      sourceFiles.current = [];
      demoProject.current = true;
      install(engine.createDemo());
    } catch (failure) {
      if (generation === loadEpoch.current)
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (generation === loadEpoch.current) setLoading("");
    }
  };
  const load = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const generation = ++loadEpoch.current;
      cad.cancel();
      clear();
      setError("");
      setDoc(undefined);
      viewer.current?.clearModel();
      if (docRef.current) runtime!.disposeDocument(docRef.current);
      setLoading("Reading file…");
      try {
        const engine = await loadRuntime();
        if (generation !== loadEpoch.current) return;
        setRuntime(engine);
        if (!ready) {
          setViewerFailed(false);
          setViewerAttempt((old) => old + 1);
        }
        const projectFile = files.find((file) =>
          file.name.toLowerCase().endsWith(".sz3d"),
        );
        const projectTools = projectFile
          ? await import("./core/project-file")
          : undefined;
        if (generation !== loadEpoch.current) return;
        const project = projectFile
          ? await projectTools!.readProject(projectFile)
          : undefined;
        if (generation !== loadEpoch.current) return;
        const modelFiles = project?.files ?? files;
        const model = project?.demo
          ? engine.createDemo()
          : await engine.importFiles(
              modelFiles,
              project?.quality ?? quality,
              (message) => {
                if (generation === loadEpoch.current) setLoading(message);
              },
            );
        let restored;
        try {
          restored = project
            ? await projectTools!.restoreProjectState(project, model)
            : undefined;
        } catch (failure) {
          engine.disposeDocument(model);
          throw failure;
        }
        if (generation !== loadEpoch.current) {
          engine.disposeDocument(model);
          return;
        }
        sourceFiles.current = modelFiles;
        demoProject.current = project?.demo ?? false;
        install(model);
        if (restored) {
          setNotes(restored.notes);
          setSaved(restored.measurements);
          setSource(restored.source);
          setUnit(restored.unit);
          setScale(restored.scale);
          setQuality(restored.quality);
          setPanel("review");
          setRight(true);
          if (restored.warnings.length) setError(restored.warnings.join(" "));
          else notify(`Opened project · ${restored.notes.length} notes`);
        }
        const next = [
          { name: model.name, format: model.format },
          ...recent.filter((r) => r.name !== model.name),
        ].slice(0, 5);
        setRecent(next);
        localStorage.setItem("shenzhen-recent", JSON.stringify(next));
        if (window.innerWidth < 900) setLeft(false);
      } catch (e) {
        if (generation === loadEpoch.current)
          setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (generation === loadEpoch.current) setLoading("");
      }
    },
    [quality, clear, install, recent, runtime, ready],
  );
  const open = useCallback(async () => {
    try {
      if (isNative() && !/Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const files = await nativeOpen();
        await load(files);
      } else fileInput.current?.click();
    } catch (e) {
      setError(String(e));
    }
  }, [load]);
  const startNote = (scope: ReviewNote["scope"]) => {
    if (!doc) return;
    const previous = points.at(-1);
    clear();
    setNoteScope(scope);
    setMode(
      scope === "part" ? "part" : scope === "feature" ? "feature" : "point",
    );
    setPlacingNote(true);
    setPanel("review");
    setRight(true);
    if (previous && (scope !== "feature" || previous.kind !== "point"))
      setNoteAnchor(noteTarget(previous, scope));
    else if (scope === "part" && doc && selectedPart) {
      const part = doc.parts.find((item) => item.id === selectedPart);
      const geometry = part && doc.geometries.get(part.geometryId);
      if (part && geometry) {
        geometry.geometry.computeBoundingBox();
        const local = geometry.geometry.boundingBox!.getCenter(
          new runtime!.Vector3(),
        );
        const world = local
          .clone()
          .applyMatrix4(new runtime!.Matrix4().fromArray(part.matrix));
        setNoteAnchor({
          id: uid(),
          partId: part.id,
          partName: part.name,
          geometryId: part.geometryId,
          point: world.toArray(),
          localPoint: local.toArray(),
          kind: "point",
          snap: "Part center",
          matrix: part.matrix.slice(),
          exactHandle: geometry.exactHandle,
        });
      }
    }
  };
  const createNote = (text: string) => {
    if (!noteAnchor) return;
    const timestamp = new Date().toISOString();
    const note: ReviewNote = {
      id: uid(),
      text,
      createdAt: timestamp,
      updatedAt: timestamp,
      resolved: false,
      scope: noteScope,
      anchor: noteAnchor,
    };
    setNotes((old) => [...old, note]);
    setSelectedNote(note.id);
    setPlacingNote(false);
    setNoteAnchor(undefined);
    notify("Note attached to the model");
  };
  const selectNote = (note: ReviewNote) => {
    setSelectedNote(note.id);
    setSelectedPart(note.anchor.partId);
    setPlacingNote(false);
    setMode(
      note.scope === "part"
        ? "part"
        : note.scope === "feature"
          ? "feature"
          : "point",
    );
    setPanel("review");
    setRight(true);
    if (hidden.has(note.anchor.partId))
      setHidden((old) => {
        const next = new Set(old);
        next.delete(note.anchor.partId);
        return next;
      });
    viewer.current?.setSelectionMode(
      note.scope === "part"
        ? "part"
        : note.scope === "feature"
          ? "feature"
          : "point",
      filter,
      snap,
    );
    viewer.current?.highlight([note.anchor]);
    viewer.current?.focusPick(note.anchor);
  };
  const shareProject = async () => {
    if (!doc || sharing) return;
    const projectFiles = sourceFiles.current.slice();
    const isDemoProject = demoProject.current;
    setSharing(true);
    try {
      const { exportProject } = await import("./core/project-file");
      const blob = await exportProject({
        doc,
        files: projectFiles,
        notes,
        measurements: saved,
        source,
        unit,
        scale,
        quality,
        demo: isDemoProject,
      });
      const name = doc.name.replace(/\.[^.]+$/, "") + ".sz3d";
      const file = new File([blob], name, { type: "application/octet-stream" });
      if (!isNative() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: doc.name });
        } catch (failure) {
          if (failure instanceof DOMException && failure.name === "AbortError")
            throw failure;
          // A large archive may outlive the browser's transient share gesture.
          await saveBlob(blob, name);
        }
      } else await saveBlob(blob, name);
      notify("Project ready to share · model, notes and measurements included");
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError"))
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSharing(false);
    }
  };
  const cancel = () => {
    loadEpoch.current++;
    cad.cancel();
    setLoading("");
    setError("Import canceled. Choose another file to continue.");
  };
  const complete = useCallback(
    async (next: Pick[]) => {
      const generation = ++epoch.current;
      setPoints(next);
      setCurrent(undefined);
      setPair(undefined);
      setProperties(undefined);
      viewer.current?.highlight(next);
      if (!doc) return;
      const first = next[0];
      setSelectedPart(next.at(-1)?.partId);
      setRight(true);
      setPanel("measure");
      if (mode === "feature" && next.length === 1) {
        setMeasuring(true);
        try {
          const props = await runtime!.featureProperties(doc, first);
          if (epoch.current === generation) setProperties(props);
        } catch (e) {
          if (epoch.current === generation)
            notify("Feature query unavailable: " + String(e));
        } finally {
          if (epoch.current === generation) setMeasuring(false);
        }
      }
      const count = tool === "angle" && mode !== "feature" ? 3 : 2;
      if (next.length < count) return;
      const measurement: Measurement = {
        id: uid(),
        name:
          tool === "distance"
            ? "Distance"
            : tool === "angle"
              ? "Angle"
              : "Surface path",
        kind: tool,
        reference: distanceReference,
        points: next,
        exact: false,
      };
      if (tool === "angle" && next.length === 3) {
        measurement.angle = threePointAngle(
          next[0].point,
          next[1].point,
          next[2].point,
        );
        measurement.note = "Angle at point B";
      } else {
        Object.assign(measurement, pointDistance(next[0].point, next[1].point));
        measurement.note =
          mode === "feature"
            ? "Distance between picked positions"
            : "Straight-line distance between picked points";
      }
      if (tool === "angle" && next.length === 2 && !doc.exactModelId) {
        const a = runtime!.featureDirection(doc, next[0]),
          b = runtime!.featureDirection(doc, next[1]);
        if (a && b) {
          measurement.angle = (a.angleTo(b) * 180) / Math.PI;
          measurement.note =
            "Angle between mesh surface normals or line directions (approximate).";
        } else
          measurement.note =
            "Angle is unavailable for this pair; use three-point angle mode.";
      }
      if (tool === "path") {
        if (next[0].partId !== next[1].partId) {
          measurement.note =
            "Surface paths require two points on the same part.";
          setCurrent(measurement);
          return;
        }
        setMeasuring(true);
        await new Promise((resolve) => setTimeout(resolve, 20));
        try {
          const g = doc.geometries.get(first.geometryId)!.geometry;
          const path = runtime!.surfacePath(
            g,
            first.localPoint,
            next[1].localPoint,
            first.triangleIndex,
            next[1].triangleIndex,
          );
          if (path) {
            const matrix = new runtime!.Matrix4().fromArray(first.matrix);
            measurement.path = path.points.map(
              (p) =>
                new runtime!.Vector3()
                  .fromArray(p)
                  .applyMatrix4(matrix)
                  .toArray() as Vec3,
            );
            measurement.surfaceLength = measurement.path
              .slice(1)
              .reduce(
                (sum, p, i) =>
                  sum + pointDistance(measurement.path![i], p).distance,
                0,
              );
            measurement.note =
              "Approximate shortest route along mesh edges; not an exact geodesic.";
          } else
            measurement.note =
              "No connected surface route between these points.";
        } catch (e) {
          measurement.note = String(e);
        } finally {
          if (epoch.current === generation) setMeasuring(false);
        }
      }
      if (tool === "distance" && distanceReference === "center") {
        setMeasuring(true);
        try {
          const [a, b] = await Promise.all(
            next.map((p) => runtime!.featureProperties(doc, p)),
          );
          if (!a.center || !b.center) {
            measurement.distance = undefined;
            measurement.delta = undefined;
            measurement.note =
              "Center is unavailable for one of these features. Select circular features, planar faces, or edges.";
          } else {
            Object.assign(measurement, pointDistance(a.center, b.center));
            measurement.points = next.map((p, i) => ({
              ...p,
              point: i === 0 ? a.center! : b.center!,
            }));
            measurement.exact = a.exact && b.exact;
            measurement.note = "Distance between feature centers / centroids";
          }
        } catch (e) {
          measurement.distance = undefined;
          measurement.delta = undefined;
          measurement.note = "Center query unavailable.";
        } finally {
          if (epoch.current === generation) setMeasuring(false);
        }
      } else if (
        doc.exactModelId &&
        next.length === 2 &&
        next.every((p) => p.exactHandle && p.kind !== "point") &&
        tool !== "path" &&
        (tool === "angle" || distanceReference === "minimum")
      ) {
        setMeasuring(true);
        try {
          const exact = await cad.pair(doc.exactModelId, next[0], next[1]);
          if (epoch.current !== generation) return;
          setPair(exact);
          if (tool === "angle") {
            if (exact.angle?.ok) {
              measurement.angle = exact.angle.value;
              measurement.exact = true;
              measurement.note = "Exact angle between CAD features";
            } else
              measurement.note =
                exact.angle?.message ||
                "Angle is unavailable for this feature pair.";
          } else if (exact.distance?.ok) {
            measurement.distance = exact.distance.value;
            measurement.delta = pointDistance(
              exact.distance.pointA,
              exact.distance.pointB,
            ).delta;
            measurement.points = next.map((p, i) => ({
              ...p,
              point: i === 0 ? exact.distance!.pointA : exact.distance!.pointB,
            }));
            measurement.exact = true;
            measurement.note = "Exact minimum distance between CAD features";
          }
        } catch (e) {
          measurement.note =
            "Exact query failed; showing picked-position distance.";
        } finally {
          if (epoch.current === generation) setMeasuring(false);
        }
      }
      if (epoch.current === generation) setCurrent(measurement);
    },
    [doc, mode, tool, distanceReference, runtime],
  );
  const pick = useCallback(
    (p: Pick) => {
      if (placingNote) {
        if (noteScope === "feature" && p.kind === "point") {
          notify("Pick an edge, face or vertex to attach this feature note.");
          return;
        }
        setNoteAnchor(noteTarget(p, noteScope));
        setSelectedPart(p.partId);
        viewer.current?.highlight([p]);
        setPanel("review");
        setRight(true);
        return;
      }
      if (mode === "part") {
        setSelectedPart(p.partId);
        viewer.current?.highlight([p]);
        setLeft(true);
        return;
      }
      if (explode) {
        setExplode(0);
        notify(
          "Assembly restored for measurement. Dimensions use original coordinates.",
        );
      }
      const count = tool === "angle" && mode !== "feature" ? 3 : 2;
      const next = points.length >= count ? [p] : [...points, p];
      void complete(next);
    },
    [points, tool, mode, explode, complete, placingNote, noteScope],
  );
  useEffect(() => {
    const p = current?.points || points;
    const text = current
      ? current.kind === "angle"
        ? current.angle !== undefined
          ? current.angle.toFixed(precision) + "°"
          : undefined
        : number(current.surfaceLength ?? current.distance ?? 0) + " " + unit
      : undefined;
    viewer.current?.setOverlay({
      points: p.map((p) => p.point),
      text,
      path: current?.path,
    });
  }, [current, points, number, unit, precision, ready]);
  const changeMode = (m: SelectionMode) => {
    clear();
    setMode(m);
  };
  const changeTool = (t: ToolMode) => {
    clear();
    setTool(t);
    if (t === "path" || mode === "part") setMode("point");
  };
  const toggleHidden = useCallback(
    (ids: string[]) =>
      setHidden((old) => {
        const next = new Set(old);
        const show = ids.every((id) => next.has(id));
        ids.forEach((id) => (show ? next.delete(id) : next.add(id)));
        return next;
      }),
    [],
  );
  const selectParts = useCallback((ids: string[]) => {
    setSelectedPart(ids[0]);
    viewer.current?.fit(ids);
  }, []);
  const isolate = useCallback(
    (ids: string[]) => {
      if (doc) {
        const keep = new Set(ids);
        setHidden(
          new Set(doc.parts.filter((p) => !keep.has(p.id)).map((p) => p.id)),
        );
      }
    },
    [doc],
  );
  const saveMeasurement = () => {
    if (!current) return;
    const m = { ...current, name: current.name + " " + (saved.length + 1) };
    setSaved((old) => [...old, m]);
    notify("Measurement saved");
  };
  const saveOutput = async (blob: Blob, name: string) => {
    try {
      await saveBlob(blob, name);
    } catch (e) {
      setError(
        "Could not save file: " + (e instanceof Error ? e.message : String(e)),
      );
    }
  };
  const exportMeasurements = async (format: "json" | "csv") => {
    if (!doc) return;
    const rows = saved.length ? saved : current ? [current] : [];
    if (!rows.length) {
      notify("Create a measurement first");
      return;
    }
    const report = {
      application: "Shenzhen 3D",
      version: 1,
      file: doc.name,
      sourceUnit: source,
      customScale: scale,
      displayUnit: unit,
      measurements: rows.map((m) => ({
        ...m,
        displayDistance:
          m.distance !== undefined
            ? m.distance * scale * conversion(source, unit)
            : undefined,
        displaySurfaceLength:
          m.surfaceLength !== undefined
            ? m.surfaceLength * scale * conversion(source, unit)
            : undefined,
      })),
    };
    const escape = (s: unknown) =>
      '"' + String(s ?? "").replaceAll('"', '""') + '"';
    const text =
      format === "json"
        ? JSON.stringify(report, null, 2)
        : [
            [
              "Name",
              "Type",
              "Distance (" + unit + ")",
              "Delta X",
              "Delta Y",
              "Delta Z",
              "Angle (deg)",
              "Surface path (" + unit + ")",
              "Accuracy",
              "Note",
            ],
            ...rows.map((m) => [
              m.name,
              m.kind,
              m.distance === undefined
                ? ""
                : m.distance * scale * conversion(source, unit),
              ...(m.delta || ["", "", ""]).map((v) =>
                typeof v === "number"
                  ? v * scale * conversion(source, unit)
                  : v,
              ),
              m.angle ?? "",
              m.surfaceLength === undefined
                ? ""
                : m.surfaceLength * scale * conversion(source, unit),
              m.exact ? "Exact CAD" : "Approximate / picked points",
              m.note,
            ]),
          ]
            .map((row) => row.map(escape).join(","))
            .join("\r\n");
    await saveOutput(
      new Blob([text], {
        type: format === "json" ? "application/json" : "text/csv",
      }),
      doc.name.replace(/\.[^.]+$/, "") + "-measurements." + format,
    );
  };
  const screenshot = async () => {
    if (viewer.current)
      await saveOutput(
        await viewer.current.screenshot(),
        (doc?.name || "shenzhen-3d") + ".png",
      );
  };
  const actions = useRef({
    open,
    clear,
    screenshot,
    exportMeasurements,
    startNote,
    shareProject,
  });
  actions.current = {
    open,
    clear,
    screenshot,
    exportMeasurements,
    startNote,
    shareProject,
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void actions.current.open();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void actions.current.shareProject();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setLeft(true);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>('[aria-label="Search assembly"]')
            ?.focus(),
        );
        return;
      }
      if (typing) return;
      if (event.key === "Escape") {
        actions.current.clear();
        return;
      }
      if (event.key.toLowerCase() === "f") {
        viewer.current?.fit();
        event.preventDefault();
      }
      if (event.key === "1") viewer.current?.preset("iso");
      if (event.key === "2") viewer.current?.preset("top");
      if (event.key === "3") viewer.current?.preset("front");
      if (event.key === "4") viewer.current?.preset("right");
      if (event.key.toLowerCase() === "p") {
        setMode("point");
        actions.current.clear();
      }
      if (event.key.toLowerCase() === "e") {
        setMode("feature");
        actions.current.clear();
      }
      if (event.key.toLowerCase() === "n") actions.current.startNote("point");
      if (event.key === "?") help.current?.showModal();
      if (event.key === "Delete" || event.key === "Backspace")
        actions.current.clear();
    };
    window.addEventListener("keydown", key);
    let unlisten: (() => void) | undefined;
    if (isNative())
      void import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen<{ action: string } | string>("native-menu", ({ payload }) => {
            const action =
              typeof payload === "string" ? payload : payload.action;
            if (action === "open") void actions.current.open();
            if (action === "fit") viewer.current?.fit();
            if (["isometric", "front", "top", "right"].includes(action))
              viewer.current?.preset(
                action === "isometric"
                  ? "iso"
                  : (action as "front" | "top" | "right"),
              );
            if (action === "clear") actions.current.clear();
            if (action === "point" || action === "feature") {
              setMode(action);
              actions.current.clear();
            }
            if (action === "help") help.current?.showModal();
            if (action === "settings") settings.current?.showModal();
            if (action === "export")
              void actions.current.exportMeasurements("csv");
          }),
        )
        .then((fn) => (unlisten = fn));
    return () => {
      window.removeEventListener("keydown", key);
      unlisten?.();
    };
  }, []);
  const instruction =
    mode === "part"
      ? "Select a part to inspect"
      : points.length === 0
        ? "Pick a point on the model"
        : tool === "angle" && mode !== "feature"
          ? points.length === 1
            ? "Pick the angle vertex (B)"
            : points.length === 2
              ? "Pick the third point (C)"
              : "Angle complete · pick to start again"
          : points.length === 1
            ? "Pick a second " + (mode === "feature" ? "feature" : "point")
            : "Measurement complete · pick to start again";
  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void load(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept={
          /Android|iPhone|iPad|iPod/.test(navigator.userAgent)
            ? undefined
            : ACCEPT + ",.sz3d"
        }
        multiple
        hidden
        onChange={(e) => {
          void load(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Shenzhen 3D"
        >
          <img src="/icon.svg" alt="" />
          <span>
            shenzhen<span className="brand-3d">3D</span>
          </span>
        </a>
        <div className="header-divider" />
        <div className="document-title">
          {doc ? (
            <>
              <span>{doc.name}</span>
              <small>{doc.format.toUpperCase()}</small>
            </>
          ) : (
            <span className="muted">A clearer view of every detail.</span>
          )}
        </div>
        <span className="local-badge">
          <span /> On your device
        </span>
        <button
          className="button primary"
          onClick={() => void open()}
          disabled={!!loading}
        >
          <FolderOpen size={16} />
          <span>Open file</span>
          <kbd>⌘ O</kbd>
        </button>
        {doc && (
          <IconButton
            title="Share commented project"
            disabled={sharing}
            onClick={() => void shareProject()}
          >
            <Share2 size={18} />
          </IconButton>
        )}
        <IconButton
          title="Settings"
          onClick={() => settings.current?.showModal()}
        >
          <Settings2 size={18} />
        </IconButton>
        <IconButton
          title="Help & shortcuts"
          onClick={() => help.current?.showModal()}
        >
          <HelpCircle size={18} />
        </IconButton>
      </header>
      <div className="workspace-toolbar">
        <div className="toolbar-cluster">
          <IconButton
            title={left ? "Hide assembly" : "Show assembly"}
            onClick={() => setLeft(!left)}
          >
            {left ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </IconButton>
          <div className="segmented" aria-label="Selection mode">
            <button
              className={mode === "point" ? "active" : ""}
              onClick={() => changeMode("point")}
              title="Pick points · P"
            >
              <MousePointer2 size={15} />
              <span>Point</span>
            </button>
            <button
              className={mode === "feature" ? "active" : ""}
              onClick={() => changeMode("feature")}
              title="Pick CAD features · E"
            >
              <ScanLine size={15} />
              <span>Feature</span>
            </button>
            <button
              className={mode === "part" ? "active" : ""}
              onClick={() => changeMode("part")}
            >
              <Box size={15} />
              <span>Part</span>
            </button>
          </div>
          {mode === "feature" && (
            <select
              aria-label="Feature selection filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FeatureFilter)}
            >
              <option value="auto">Auto feature</option>
              <option value="face">Faces</option>
              <option value="edge">Edges</option>
              <option value="vertex">Vertices</option>
            </select>
          )}
          <IconButton
            title="Snap to vertices and edges"
            active={snap}
            onClick={() => setSnap(!snap)}
          >
            <Magnet size={17} />
          </IconButton>
        </div>
        <div className="toolbar-cluster display-tools">
          <RenderStyleSelect
            value={display.renderStyle}
            onChange={(renderStyle) => {
              setDisplay((value) => ({ ...value, renderStyle }));
              if (renderStyle !== "shaded") setRayTracing(false);
            }}
          />
          <IconButton
            title="Review notes"
            active={panel === "review" && right}
            onClick={() => {
              setPanel("review");
              setRight(true);
            }}
          >
            <MessageSquare size={17} />
          </IconButton>
          <IconButton
            title="Fit model · F"
            onClick={() => viewer.current?.fit()}
            disabled={!doc}
          >
            <Maximize size={17} />
          </IconButton>
          <IconButton
            title="Show edges"
            disabled={display.renderStyle !== "shaded" || rayTracing}
            active={edges || display.renderStyle === "shaded-edges"}
            onClick={() => setEdges(!edges)}
          >
            <Box size={17} />
          </IconButton>
          <IconButton
            title="Ground grid"
            disabled={rayTracing}
            active={grid}
            onClick={() => setGrid(!grid)}
          >
            <Grid3X3 size={17} />
          </IconButton>
          <IconButton
            title="Section plane"
            active={section}
            onClick={() => setSection(!section)}
            disabled={!doc}
          >
            <Scissors size={17} />
          </IconButton>
          <IconButton
            title="Save screenshot"
            onClick={() => void screenshot()}
            disabled={!doc}
          >
            <Camera size={17} />
          </IconButton>
          <span className="toolbar-separator" />
          <button
            className={`text-tool ${ortho ? "active" : ""}`}
            onClick={() => setOrtho(!ortho)}
          >
            {ortho ? "Orthographic" : "Perspective"}
          </button>
          <IconButton
            title={right ? "Hide measurements" : "Show measurements"}
            onClick={() => setRight(!right)}
          >
            {right ? (
              <PanelRightClose size={17} />
            ) : (
              <PanelRightOpen size={17} />
            )}
          </IconButton>
        </div>
      </div>
      <main
        className={`workspace ${left ? "with-tree" : ""} ${right ? "with-inspector" : ""}`}
      >
        {left && (
          <aside className="assembly-panel">
            <div className="panel-heading">
              <h2>Assembly</h2>
              <button
                className="text-link"
                onClick={() => setHidden(new Set())}
                disabled={!hidden.size}
              >
                Show all
              </button>
              <button
                className="mobile-close icon-button"
                aria-label="Close assembly"
                onClick={() => setLeft(false)}
              >
                <X size={16} />
              </button>
            </div>
            {doc ? (
              <AssemblyTree
                key={doc.name + doc.importMs}
                doc={doc}
                hidden={hidden}
                selected={selectedPart}
                onToggle={toggleHidden}
                onSelect={selectParts}
                onIsolate={isolate}
              />
            ) : (
              <div className="empty-panel">
                <Layers size={28} />
                <p>
                  Your model’s structure,
                  <br />
                  one part at a time.
                </p>
              </div>
            )}
            {doc && (
              <div className="assembly-controls">
                <label>
                  <span>Explode assembly</span>
                  <output>{Math.round(explode * 100)}%</output>
                </label>
                <input
                  aria-label="Explode assembly"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))}
                />
                <label>
                  <span>Opacity</span>
                  <output>{Math.round(opacity * 100)}%</output>
                </label>
                <input
                  aria-label="Model opacity"
                  type="range"
                  min=".08"
                  max="1"
                  step=".01"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                />
                <div className="document-size">
                  <span>Model envelope</span>
                  {dimensions && (
                    <strong>
                      {[dimensions.x, dimensions.y, dimensions.z]
                        .map((x) => number(x))
                        .join(" × ")}{" "}
                      <small>{unit}</small>
                    </strong>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
        <section className="viewport-region">
          <Viewport
            key={viewerAttempt}
            ViewerClass={runtime?.Viewer}
            onPick={pick}
            onHover={setHover}
            onReady={(v) => {
              viewer.current = v;
              v.onNavigationDetail = setUsingNavigationDetail;
              v.onRayTracingState = (state) => {
                const now = performance.now();
                if (
                  state.status !== "rendering" ||
                  now - lastRayUpdate.current > 100
                ) {
                  lastRayUpdate.current = now;
                  setRayState(state);
                }
              };
              setReady(true);
            }}
            onError={(message) => {
              setViewerFailed(true);
              setError(message);
            }}
          />
          {sharing && (
            <div className="project-progress" role="status">
              <LoaderCircle size={15} className="spin" /> Preparing commented
              project…
            </div>
          )}
          {rayTracing && doc && (
            <div className="ray-status-badge" role="status">
              {rayState?.status === "unsupported" ||
              rayState?.status === "error" ? (
                <button onClick={() => settings.current?.showModal()}>
                  Ray tracing unavailable · details
                </button>
              ) : (
                <>
                  <span
                    className={
                      rayState?.status === "ready" ? "status-dot" : "trace-busy"
                    }
                  />
                  {rayState?.status === "preparing"
                    ? "Preparing ray tracing"
                    : rayState?.status === "ready"
                      ? `Ray traced · ${rayState.samples} samples`
                      : `Ray tracing · ${rayState?.samples ?? 0}/${raySamples}`}
                  <button
                    aria-label="Stop ray tracing"
                    onClick={() => setRayTracing(false)}
                  >
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          )}
          {doc && (
            <ReviewPins
              viewer={ready ? viewer.current : undefined}
              notes={notes}
              selected={selectedNote}
              onSelect={selectNote}
            />
          )}
          {doc && (
            <>
              <div className="viewport-top">
                <div className="model-badge">
                  <span className="status-dot" />
                  {doc.is2D
                    ? "2D drawing"
                    : doc.exactModelId
                      ? "CAD model"
                      : "Mesh model"}
                  <span className="dot-divider">·</span>
                  {doc.parts.length.toLocaleString()} parts
                </div>
                <div className="view-presets">
                  <button
                    onClick={() => viewer.current?.preset("iso")}
                    title="Isometric · 1"
                  >
                    ISO
                  </button>
                  <button
                    onClick={() => viewer.current?.preset("top")}
                    title="Top · 2"
                  >
                    TOP
                  </button>
                  <button
                    onClick={() => viewer.current?.preset("front")}
                    title="Front · 3"
                  >
                    FRONT
                  </button>
                  <button
                    onClick={() => viewer.current?.preset("right")}
                    title="Right · 4"
                  >
                    RIGHT
                  </button>
                </div>
              </div>
              <div className="viewport-bottom">
                <span className="pick-instruction">
                  <span className="pick-dot" />
                  {placingNote
                    ? `Pick ${noteScope === "part" ? "a part" : noteScope === "feature" ? "a feature" : "a point"} to attach your note`
                    : instruction}
                </span>
                <div className="zoom-controls">
                  <IconButton
                    title="Zoom out"
                    onClick={() => viewer.current?.zoom(1 / 1.2)}
                  >
                    <ZoomOut size={16} />
                  </IconButton>
                  <IconButton
                    title="Zoom in"
                    onClick={() => viewer.current?.zoom(1.2)}
                  >
                    <ZoomIn size={16} />
                  </IconButton>
                  <IconButton
                    title="Fit model"
                    onClick={() => viewer.current?.fit()}
                  >
                    <Maximize size={16} />
                  </IconButton>
                </div>
              </div>
              <div className="axis-key">
                <span className="axis-x">X</span>
                <span className="axis-y">Y</span>
                <span className="axis-z">Z</span>
              </div>
            </>
          )}
          {!doc && !loading && (
            <div className="welcome">
              <div className="welcome-symbol">
                <Box size={48} strokeWidth={1} />
                <span className="welcome-dimension">80.000</span>
              </div>
              <div className="eyebrow">SHENZHEN 3D / ENGINEERING VIEWER</div>
              <h1>
                Every detail.
                <br />
                <span>Within reach.</span>
              </h1>
              <p>
                Open a model. Pick two points.
                <br />
                Go from geometry to understanding.
              </p>
              <button
                className="button primary large"
                onClick={() => void open()}
              >
                <Upload size={18} /> Open a model or drawing{" "}
                <ArrowUpRight size={16} />
              </button>
              <button className="demo-button" onClick={demo}>
                Explore a sample model <ChevronRight size={15} />
              </button>
              <div className="format-list">
                STEP <span>·</span> STL <span>·</span> OBJ <span>·</span> 3MF{" "}
                <span>·</span> GLTF <span>·</span> DWG <span>·</span> DXF{" "}
                <span>·</span> SVG
              </div>
              <small className="drop-hint">
                Drop files anywhere. Include textures and companion files
                together.
              </small>
              {recent.length > 0 && (
                <div className="recent">
                  <span>RECENTLY VIEWED</span>
                  {recent.slice(0, 3).map((r) => (
                    <button
                      key={r.name}
                      title="Reopen using the file picker"
                      onClick={() => void open()}
                    >
                      <FileBox size={14} />
                      {r.name}
                      <small>{r.format.toUpperCase()}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {section && doc && (
            <div className="section-controls">
              <Scissors size={16} />
              <strong>Section</strong>
              <select
                aria-label="Section axis"
                value={sectionAxis}
                onChange={(e) =>
                  setSectionAxis(e.target.value as "x" | "y" | "z")
                }
              >
                <option value="x">X plane</option>
                <option value="y">Y plane</option>
                <option value="z">Z plane</option>
              </select>
              <input
                aria-label="Section position"
                type="range"
                min="0"
                max="1"
                step=".001"
                value={sectionPosition}
                onChange={(e) => setSectionPosition(Number(e.target.value))}
              />
              <button
                aria-label="Close section"
                className="icon-button"
                onClick={() => setSection(false)}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {(!!loading || (doc && !ready && !viewerFailed)) && (
            <div className="loading-overlay" role="status">
              <LoaderCircle className="spin" size={30} />
              <h2>{loading || "Starting 3D viewer…"}</h2>
              <p>Geometry is processed locally on your device.</p>
              <div className="indeterminate-progress" />
              <button className="button subtle" onClick={cancel}>
                Cancel import
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <Info size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </section>
        {right && (
          <aside className="inspector">
            <div className="panel-heading inspector-tabs">
              <button
                className={panel === "measure" ? "selected" : ""}
                onClick={() => setPanel("measure")}
              >
                Measure
              </button>
              <button
                className={panel === "saved" ? "selected" : ""}
                onClick={() => setPanel("saved")}
              >
                Saved <span>{saved.length}</span>
              </button>
              <button
                className={panel === "review" ? "selected" : ""}
                onClick={() => setPanel("review")}
              >
                Notes{" "}
                <span>{notes.filter((note) => !note.resolved).length}</span>
              </button>
              <button
                className="mobile-close icon-button"
                aria-label="Close measurements"
                onClick={() => setRight(false)}
              >
                <X size={16} />
              </button>
            </div>
            {panel === "review" ? (
              <ReviewPanel
                notes={notes}
                selected={selectedNote}
                anchor={noteAnchor}
                scope={noteScope}
                placing={placingNote}
                enabled={!!doc}
                sharing={sharing}
                onStart={startNote}
                onCancel={() => {
                  setPlacingNote(false);
                  setNoteAnchor(undefined);
                }}
                onCreate={createNote}
                onSelect={selectNote}
                onUpdate={(updated) =>
                  setNotes((old) =>
                    old.map((note) =>
                      note.id === updated.id ? updated : note,
                    ),
                  )
                }
                onDelete={(id) => {
                  setNotes((old) => old.filter((note) => note.id !== id));
                  if (selectedNote === id) {
                    setSelectedNote(undefined);
                    viewer.current?.highlight([]);
                  }
                }}
                onShare={() => void shareProject()}
              />
            ) : panel === "measure" ? (
              <div className="inspector-content">
                <div className="measurement-tools">
                  <button
                    className={tool === "distance" ? "active" : ""}
                    onClick={() => changeTool("distance")}
                  >
                    <Ruler size={17} />
                    <span>Distance</span>
                  </button>
                  <button
                    className={tool === "angle" ? "active" : ""}
                    onClick={() => changeTool("angle")}
                  >
                    <Triangle size={17} />
                    <span>Angle</span>
                  </button>
                  <button
                    className={tool === "path" ? "active" : ""}
                    onClick={() => changeTool("path")}
                  >
                    <Route size={17} />
                    <span>Surface</span>
                  </button>
                </div>
                <div className="unit-line">
                  <span>Display units</span>
                  <select
                    aria-label="Display units"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as Unit)}
                  >
                    {Object.keys(UNITS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                {mode === "feature" && tool === "distance" && (
                  <label className="reference-select">
                    Measure between
                    <select
                      aria-label="Distance reference"
                      value={distanceReference}
                      onChange={(e) => {
                        setDistanceReference(
                          e.target.value as "minimum" | "center" | "picked",
                        );
                        clear();
                      }}
                    >
                      <option value="minimum">Closest features</option>
                      <option value="center">Centers / centroids</option>
                      <option value="picked">Picked positions</option>
                    </select>
                  </label>
                )}
                <div className="point-list">
                  {Array.from(
                    { length: tool === "angle" && mode !== "feature" ? 3 : 2 },
                    (_, i) => (
                      <div
                        className={`point-row ${points[i] ? "filled" : ""}`}
                        key={i}
                      >
                        <span className={"point-letter point-" + i}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div>
                          {points[i] ? (
                            <>
                              <strong title={points[i].partName}>
                                {points[i].partName}
                              </strong>
                              <small>
                                {mode === "feature"
                                  ? points[i].snap
                                  : points[i].point
                                      .map((v) => number(v))
                                      .join(", ") +
                                    " " +
                                    unit}
                              </small>
                            </>
                          ) : (
                            <>
                              <strong>
                                {i === 0
                                  ? "Start here"
                                  : tool === "angle" && i === 1
                                    ? "Angle vertex"
                                    : "Then pick here"}
                              </strong>
                              <small>
                                {mode === "feature"
                                  ? "Select a face, edge or vertex"
                                  : "Select a point on the model"}
                              </small>
                            </>
                          )}
                        </div>
                        {points[i] && <Check size={14} />}
                      </div>
                    ),
                  )}
                </div>
                {measuring && (
                  <div className="query-status">
                    <LoaderCircle size={14} className="spin" /> Calculating
                    geometry…
                  </div>
                )}
                {current ? (
                  <>
                    <div className="result-hero">
                      <span>
                        {tool === "angle"
                          ? "ANGLE"
                          : tool === "path"
                            ? "SURFACE ROUTE"
                            : distanceReference === "center"
                              ? "CENTER DISTANCE"
                              : distanceReference === "picked"
                                ? "PICKED DISTANCE"
                                : "SHORTEST DISTANCE"}
                      </span>
                      <div>
                        <strong>
                          {tool === "angle"
                            ? (current.angle?.toFixed(precision) ?? "—")
                            : current.surfaceLength !== undefined
                              ? number(current.surfaceLength)
                              : tool === "path"
                                ? "—"
                                : current.distance !== undefined
                                  ? number(current.distance)
                                  : "—"}
                        </strong>
                        <small>{tool === "angle" ? "°" : unit}</small>
                      </div>
                      <span className="accuracy-tag">
                        <span />
                        {current.exact
                          ? "Exact CAD geometry"
                          : tool === "path"
                            ? "Approximate mesh route"
                            : "Picked-point measurement"}
                      </span>
                    </div>
                    {current.delta && (
                      <div className="delta-grid">
                        <Metric
                          label="ΔX"
                          axis="x"
                          value={number(current.delta[0])}
                          unit={unit}
                        />
                        <Metric
                          label="ΔY"
                          axis="y"
                          value={number(current.delta[1])}
                          unit={unit}
                        />
                        <Metric
                          label="ΔZ"
                          axis="z"
                          value={number(current.delta[2])}
                          unit={unit}
                        />
                      </div>
                    )}
                    {pair?.angle?.ok && tool !== "angle" && (
                      <Metric
                        label="Feature angle"
                        value={pair.angle.value.toFixed(precision)}
                        unit="°"
                      />
                    )}
                    {pair?.thickness?.ok && (
                      <Metric
                        label="Normal thickness"
                        value={number(pair.thickness.value)}
                        unit={unit}
                      />
                    )}
                    <p className="measurement-note">{current.note}</p>
                    <div className="result-actions">
                      <button
                        className="button primary"
                        onClick={saveMeasurement}
                      >
                        <Plus size={15} /> Save measurement
                      </button>
                      <IconButton
                        title="Copy measurement"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(
                              tool === "angle"
                                ? `${current.angle?.toFixed(precision)}°`
                                : `${number(current.distance ?? 0)} ${unit}; ΔX ${number(current.delta?.[0] ?? 0)}, ΔY ${number(current.delta?.[1] ?? 0)}, ΔZ ${number(current.delta?.[2] ?? 0)}`,
                            )
                            .then(() => notify("Copied measurement"))
                            .catch(() =>
                              notify("Use Export to save this measurement."),
                            );
                        }}
                      >
                        <Copy size={16} />
                      </IconButton>
                    </div>
                  </>
                ) : (
                  <div className="measure-empty">
                    <Move3D size={32} strokeWidth={1} />
                    <h3>
                      {points.length
                        ? "One more selection."
                        : "A little precision goes a long way."}
                    </h3>
                    <p>
                      {tool === "path"
                        ? "Trace a route over a connected mesh. Pick two points on the same part."
                        : tool === "angle"
                          ? "Pick three points (B is the vertex), or two CAD features."
                          : "Pick two points to see the shortest distance and each axis component."}
                    </p>
                    <div className="empty-deltas">
                      <span className="axis-x">ΔX —</span>
                      <span className="axis-y">ΔY —</span>
                      <span className="axis-z">ΔZ —</span>
                    </div>
                  </div>
                )}
                {properties && (
                  <div className="feature-properties">
                    <div className="subheading">
                      <h3>Feature properties</h3>
                      <span>{properties.exact ? "Exact" : "Approx."}</span>
                    </div>
                    {properties.family && (
                      <div className="property-type">{properties.family}</div>
                    )}
                    {properties.radius !== undefined && (
                      <Metric
                        label="Radius"
                        value={number(properties.radius)}
                        unit={unit}
                      />
                    )}{" "}
                    {properties.diameter !== undefined && (
                      <Metric
                        label="Diameter"
                        value={number(properties.diameter)}
                        unit={unit}
                      />
                    )}{" "}
                    {properties.length !== undefined && (
                      <Metric
                        label="Length"
                        value={number(properties.length)}
                        unit={unit}
                      />
                    )}{" "}
                    {properties.perimeter !== undefined && (
                      <Metric
                        label="Perimeter"
                        value={number(properties.perimeter)}
                        unit={unit}
                      />
                    )}{" "}
                    {properties.area !== undefined && (
                      <Metric
                        label="Area"
                        value={number(properties.area, 2)}
                        unit={unit + "²"}
                      />
                    )}
                  </div>
                )}
                {points.length > 0 && (
                  <button className="clear-button" onClick={clear}>
                    <RotateCcw size={14} /> Start a new measurement{" "}
                    <kbd>Esc</kbd>
                  </button>
                )}
                <details className="units-details">
                  <summary>
                    <Settings2 size={14} /> Source units & scale
                  </summary>
                  <p>
                    {doc?.sourceUnit ? `File reports: ${doc.sourceUnit}. ` : ""}
                    {doc?.exactModelId
                      ? "CAD coordinates are normalized to mm. "
                      : ""}
                    Override how one model coordinate is interpreted.
                  </p>
                  <label>
                    Interpret coordinates as
                    <select
                      aria-label="Source units"
                      value={source}
                      onChange={(e) => setSource(e.target.value as Unit)}
                    >
                      {Object.entries(UNITS).map(([u, v]) => (
                        <option key={u} value={u}>
                          {v.label} ({u})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Custom scale factor
                    <input
                      aria-label="Custom scale factor"
                      type="number"
                      min="0.000000001"
                      step="any"
                      value={scale}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n > 0) setScale(n);
                      }}
                    />
                  </label>
                  {["wrl", "vrml"].includes(doc?.format || "") && (
                    <button
                      className="text-link"
                      onClick={() => {
                        setSource("in");
                        setScale(0.1);
                      }}
                    >
                      Use KiCad WRL convention (0.1 inch)
                    </button>
                  )}
                  <button
                    className="text-link"
                    onClick={() => {
                      setSource(doc?.unit || "mm");
                      setScale(1);
                    }}
                  >
                    Reset to imported units
                  </button>
                </details>
              </div>
            ) : (
              <div className="saved-content">
                {saved.length ? (
                  <>
                    <div className="export-row">
                      <button
                        className="button subtle"
                        onClick={() => void exportMeasurements("csv")}
                      >
                        <Download size={14} /> CSV
                      </button>
                      <button
                        className="button subtle"
                        onClick={() => void exportMeasurements("json")}
                      >
                        <Download size={14} /> JSON
                      </button>
                    </div>
                    {saved.map((m) => (
                      <div className="saved-measurement" key={m.id}>
                        <button
                          onClick={() => {
                            clear();
                            setCurrent(m);
                            setPoints(m.points);
                            viewer.current?.highlight(m.points);
                            setTool(m.kind);
                            setDistanceReference(m.reference || "minimum");
                            setPanel("measure");
                          }}
                        >
                          <span>
                            {m.kind === "angle" ? (
                              <Triangle size={16} />
                            ) : (
                              <Ruler size={16} />
                            )}
                            <strong>{m.name}</strong>
                          </span>
                          <b>
                            {m.kind === "angle"
                              ? m.angle?.toFixed(precision) + "°"
                              : number(m.surfaceLength ?? m.distance ?? 0) +
                                " " +
                                unit}
                          </b>
                          <small>
                            {m.exact ? "Exact CAD" : "Picked / approximate"}
                          </small>
                        </button>
                        <IconButton
                          title="Delete measurement"
                          onClick={() =>
                            setSaved((s) => s.filter((x) => x.id !== m.id))
                          }
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="empty-panel">
                    <Ruler size={28} />
                    <h3>Keep the useful numbers.</h3>
                    <p>
                      Saved measurements stay in this session.
                      <br />
                      Export them as CSV or JSON to keep a record.
                    </p>
                  </div>
                )}
              </div>
            )}
            {doc && doc.warnings.length > 0 && (
              <details className="import-notes">
                <summary>
                  <Info size={13} />
                  {doc.warnings.length} import note
                  {doc.warnings.length > 1 ? "s" : ""}
                </summary>
                {doc.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </details>
            )}
          </aside>
        )}
      </main>
      <footer className="status-bar">
        <span className="status-main">
          {hover || (!doc ? "Ready to explore" : doc.name)}
        </span>
        <span>
          {doc?.importMs
            ? `Imported in ${(doc.importMs / 1000).toFixed(2)}s`
            : "Local-first"}
        </span>
        <span className="status-navigation">
          {usingNavigationDetail
            ? "Navigation detail · full detail when still"
            : navigation === "trackpad"
              ? "Two-finger pan · pinch zoom"
              : "Drag orbit · right-drag pan · scroll zoom"}
        </span>
        <button onClick={() => settings.current?.showModal()}>
          {unit} <ChevronDown size={11} />
        </button>
        <span className="version">v{appVersion}</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={40} />
          <h2>Drop to open</h2>
          <p>Models, drawings, textures, and companion files</p>
        </div>
      )}
      <dialog ref={help} className="dialog">
        <div className="dialog-heading">
          <h2>Make yourself at home.</h2>
          <IconButton title="Close help" onClick={() => help.current?.close()}>
            <X size={20} />
          </IconButton>
        </div>
        <p>
          A lightweight workbench for your geometry. All file processing happens
          on your device.
        </p>
        <div className="help-columns">
          <div>
            <h3>Move around</h3>
            <dl>
              <dt>Orbit</dt>
              <dd>Left drag / one finger</dd>
              <dt>Pan</dt>
              <dd>Right drag / two fingers</dd>
              <dt>Zoom</dt>
              <dd>Scroll / pinch</dd>
              <dt>Set orbit center</dt>
              <dd>Double-click a surface</dd>
              <dt>Fit everything</dt>
              <dd>
                <kbd>F</kbd>
              </dd>
              <dt>Standard views</dt>
              <dd>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dd>
            </dl>
          </div>
          <div>
            <h3>Measure naturally</h3>
            <dl>
              <dt>Point mode</dt>
              <dd>
                <kbd>P</kbd> · Pick on geometry
              </dd>
              <dt>Feature mode</dt>
              <dd>
                <kbd>E</kbd> · Edges, faces, vertices
              </dd>
              <dt>Clear selections</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
              <dt>Open file</dt>
              <dd>
                <kbd>⌘ / Ctrl O</kbd>
              </dd>
              <dt>Angle</dt>
              <dd>Three points, vertex at B</dd>
              <dt>Surface route</dt>
              <dd>Approximate mesh-edge path</dd>
            </dl>
          </div>
        </div>
        <p className="help-note">
          Use <kbd>N</kbd> or the Notes tab to attach a comment to a point,
          feature or part. <kbd>⌘ / Ctrl S</kbd> shares a project containing the
          original model, notes and saved measurements. Open that .sz3d file to
          continue the review.
        </p>
        <p className="help-note">
          STEP, IGES and BREP retain CAD topology for exact feature queries.
          Mesh measurements depend on tessellation. “Shortest distance” is
          straight-line separation; “Surface” follows the mesh. Section planes
          hide geometry without modifying it. Source-unit overrides apply to all
          measurements and exports.
        </p>
        <div className="dialog-footer">
          <button
            className="button primary"
            onClick={() => help.current?.close()}
          >
            Got it
          </button>
        </div>
      </dialog>
      <dialog ref={settings} className="dialog settings-dialog">
        <div className="dialog-heading">
          <h2>Your workbench</h2>
          <IconButton
            title="Close settings"
            onClick={() => settings.current?.close()}
          >
            <X size={20} />
          </IconButton>
        </div>
        <div className="settings-view">
          <h3>View controls</h3>
          <div className="settings-toggles">
            <button
              className={
                edges || display.renderStyle === "shaded-edges" ? "active" : ""
              }
              disabled={display.renderStyle !== "shaded" || rayTracing}
              onClick={() => setEdges(!edges)}
            >
              <Box size={16} /> Edges
            </button>
            <button
              className={grid ? "active" : ""}
              disabled={rayTracing}
              onClick={() => setGrid(!grid)}
            >
              <Grid3X3 size={16} /> Grid
            </button>
            <button
              className={ortho ? "active" : ""}
              onClick={() => setOrtho(!ortho)}
            >
              <Focus size={16} /> Orthographic
            </button>
            <button
              className={section ? "active" : ""}
              onClick={() => {
                setSection(!section);
                settings.current?.close();
              }}
            >
              <Scissors size={16} /> Section
            </button>
            <button onClick={() => void screenshot()}>
              <Camera size={16} /> Screenshot
            </button>
            <button
              onClick={() => {
                viewer.current?.fit();
                settings.current?.close();
              }}
            >
              <Maximize size={16} /> Fit model
            </button>
          </div>
          <label>
            Model opacity
            <input
              aria-label="Settings opacity"
              type="range"
              min=".08"
              max="1"
              step=".01"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          <label>
            Explode assembly
            <input
              aria-label="Settings explode"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={explode}
              onChange={(e) => setExplode(Number(e.target.value))}
            />
          </label>
        </div>
        <DisplaySettings
          value={display}
          onChange={(next) => {
            setDisplay(next);
            if (next.renderStyle !== "shaded") setRayTracing(false);
          }}
        />
        <div className="raytrace-controls">
          <label>
            <span>GPU ray tracing</span>
            <input
              type="checkbox"
              aria-label="GPU ray tracing"
              checked={rayTracing}
              disabled={!doc || doc.is2D}
              onChange={(event) => {
                setRayTracing(event.target.checked);
                if (event.target.checked)
                  setDisplay((value) => ({ ...value, renderStyle: "shaded" }));
              }}
            />
          </label>
          <p className="render-status">
            Progressively refines lighting while still. Navigation uses the fast
            shaded view. The ground grid is omitted from traced views.
          </p>
          {rayTracing && (
            <>
              <label>
                Samples
                <select
                  aria-label="Ray tracing samples"
                  value={raySamples}
                  onChange={(event) =>
                    setRaySamples(Number(event.target.value) as 32 | 128 | 512)
                  }
                >
                  <option value={32}>32 · Preview</option>
                  <option value={128}>128 · Balanced</option>
                  <option value={512}>512 · Refined</option>
                </select>
              </label>
              <label>
                Resolution
                <select
                  aria-label="Ray tracing resolution"
                  value={rayResolution}
                  onChange={(event) =>
                    setRayResolution(Number(event.target.value) as 0.5 | 1)
                  }
                >
                  <option value={0.5}>Half · Faster</option>
                  <option value={1}>Full · Sharper</option>
                </select>
              </label>
              <p className="render-status" role="status">
                {rayState?.reason ||
                  (rayState?.status === "preparing"
                    ? "Preparing geometry for GPU tracing…"
                    : rayState?.status === "ready"
                      ? `Refined · ${rayState.samples} samples`
                      : rayState?.status === "rendering"
                        ? `Refining · ${rayState.samples} / ${rayState.target} samples`
                        : "Starting GPU ray tracing…")}
              </p>
              {rayState?.status === "rendering" && (
                <progress
                  aria-label="Ray tracing progress"
                  value={rayState.samples}
                  max={rayState.target}
                />
              )}
            </>
          )}
        </div>
        <label>
          Appearance
          <div className="segmented">
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setTheme("dark")}
            >
              <Moon size={15} /> Graphite
            </button>
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setTheme("light")}
            >
              <Sun size={15} /> Paper
            </button>
          </div>
        </label>
        <label>
          Navigation
          <select
            value={navigation}
            onChange={(e) =>
              setNavigation(e.target.value as "mouse" | "trackpad")
            }
          >
            <option value="mouse">Mouse · wheel zooms</option>
            <option value="trackpad">
              Trackpad · two fingers pan, pinch zooms
            </option>
          </select>
        </label>
        <label>
          Navigation detail
          <select
            aria-label="Navigation detail"
            value={navigationDetail}
            onChange={(e) =>
              setNavigationDetail(e.target.value as "auto" | "full")
            }
          >
            <option value="auto">Automatic · smoother large models</option>
            <option value="full">Full detail at all times</option>
          </select>
          <small>
            Automatic adjusts distant geometry while moving. Full detail returns
            when still; measurements always use the original model.
          </small>
        </label>
        <label>
          Decimal places
          <select
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          CAD tessellation
          <select value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="fast">Fast · 0.2 mm</option>
            <option value="balanced">Balanced · 0.05 mm</option>
            <option value="fine">Fine · 0.01 mm</option>
          </select>
        </label>
        <p className="muted">
          Tessellation changes apply to the next import. Exact CAD feature
          measurements use the original geometry at every quality setting.
        </p>
        <div className="dialog-footer">
          <button
            className="button primary"
            onClick={() => settings.current?.close()}
          >
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
export default App;
