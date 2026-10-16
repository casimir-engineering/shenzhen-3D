import type { CadResult, ExactPair, FeatureProperties, Pick } from "./types";
class CadClient {
  private worker?: Worker;
  private workerGeneration = 0;
  private serial = 0;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();

  private call<T>(
    action: string,
    payload: unknown,
    transfer: Transferable[] = [],
  ): Promise<T> {
    if (!this.worker) {
      const worker = new Worker(
        new URL("../workers/cad.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker = worker;
      this.workerGeneration++;
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return;
        const request = this.pending.get(data.id);
        if (request) {
          this.pending.delete(data.id);
          if (data.error) request.reject(new Error(data.error));
          else request.resolve(data.result);
        }
      };
      worker.onerror = (event) => {
        if (this.worker === worker)
          this.cancel(event.message || "CAD engine failed");
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, action, payload }, transfer);
    });
  }

  open(format: string, buffer: ArrayBuffer, quality = "balanced") {
    const result = this.call<CadResult>("open", { format, buffer, quality }, [
      buffer,
    ]);
    const generation = this.workerGeneration;
    return result.then((value) => ({
      ...value,
      exactWorkerGeneration: generation,
    }));
  }
  properties(modelId: number, pick: Pick) {
    return this.call<FeatureProperties>("properties", { modelId, pick });
  }
  pair(modelId: number, a: Pick, b: Pick) {
    return this.call<ExactPair>("pair", { modelId, a, b });
  }
  release(modelId: number, generation?: number): Promise<unknown> {
    // A terminated worker already freed its native models. Never start a worker
    // for cleanup, or send an old ID into a new worker that may reuse that ID.
    if (!this.worker || generation !== this.workerGeneration)
      return Promise.resolve(false);
    return this.call("release", { modelId });
  }
  cancel(reason = "Import canceled") {
    this.worker?.terminate();
    this.worker = undefined;
    for (const request of this.pending.values())
      request.reject(new Error(reason));
    this.pending.clear();
  }
}
export const cad = new CadClient();
