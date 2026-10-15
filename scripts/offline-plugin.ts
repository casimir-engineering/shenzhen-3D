import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
export function offlinePlugin(): Plugin {
  return {
    name: "shenzhen-offline",
    apply: "build",
    async closeBundle() {
      const root = "dist";
      const list = async (path: string): Promise<string[]> => {
        const entries = await readdir(join(root, path), {
          withFileTypes: true,
        });
        return (
          await Promise.all(
            entries.map((e) =>
              e.isDirectory()
                ? list(join(path, e.name))
                : Promise.resolve([join(path, e.name)]),
            ),
          )
        ).flat();
      };
      const files = (await list("")).filter(
        (f) => f !== "sw.js" && !f.endsWith(".map"),
      );
      const hash = createHash("sha256");
      for (const f of files) hash.update(await readFile(join(root, f)));
      const cache = "shenzhen-3d-" + hash.digest("hex").slice(0, 12);
      // Bundled same-origin assets are identical across Origin/encoding variants.
      // Module requests carry Origin; precache requests may not (Vary: Origin).
      const source = `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(files.map((f) => "./" + f.replaceAll("\\", "/")))};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shenzhen-3d-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html',{ignoreVary:true})));return;}e.respondWith(caches.match(e.request,{ignoreVary:true}).then(hit=>hit||fetch(e.request)));});`;
      await writeFile(join(root, "sw.js"), source);
    },
  };
}
