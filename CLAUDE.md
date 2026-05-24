# Claude Code — Atticgrind project

## Project Identity

Personal creative project for Cillian Ó Murchú.
**Angular 19** · TypeScript 5.7 · RxJS 7 · Three.js r162 · Angular CLI · Karma/Jasmine.
No SSR. No state library — global state lives in `AppStateService` via `BehaviorSubject`.

---

## File Structure

```
src/app/
  app.component.ts/html/scss   Root shell — mounts navbar, skate, banner, router-outlet
  app.config.ts                provideRouter + provideZoneChangeDetection
  app.routes.ts                Routes (currently just '/' → HomeComponent)

  home/                        Route-level screen. Contains background image + <app-rain>
  navbar/                      Fixed top bar, z-index 10
  banner/                      Canvas banner animation (skater carrying sign), z-index 4
  skate/                       Canvas skater animation, fixed, pointer-events:none, z-index 5
    skate.component.ts         Animation loop, renders Skater using FrameState
    skate-moves.ts             Defines Move/Sequence types and exports roll, ollie, kickflip, shuvit, handstand, compose
    skater.ts                  Skater class — drawBody(ctx, state) stick-figure renderer
    skater-profiles.ts         Skater appearance configs
    climber.ts                 Climber character
    footballer.ts              Footballer character
    banner-message.ts          Text string shown on the banner canvas
  rain/                        Full-screen canvas rain + "Atticus" text + interactive flame animation
    rain.component.ts          All rain logic (drops, splashes, lightning, clouds, 3D text, A-fire animation)
    rain.component.html        <canvas #rainCanvas> inside overflow-hidden div
    rain.component.scss        canvas { display:block; position:absolute; top:0; left:0 }
  neural-network/              WebGL shader visualisation (currently commented out in app shell)
  components/
    neural-network/            Alternative neural-network component
  services/
    app-state.service.ts       AppStateService — text$ and weather$ BehaviorSubjects
  ui/
    button/                    Presentational button atom
    input/                     Presentational input atom
```

---

## Angular Conventions

- **Standalone components only.** Every component uses `standalone: true` and declares its own `imports: []`. Do not use NgModules.
- **Inject via `inject()`**, not constructor injection, for new code. Existing components use constructor injection — match what's already there.
- **Canvas setup in `ngAfterViewInit`**, not `ngOnInit`, because `@ViewChild({ static: true })` resolves before `ngAfterViewInit` but the canvas sizing depends on the DOM being ready.
- **All animation state is closure-scoped** inside `ngAfterViewInit`. Do not add class fields for per-frame variables — keep them local to the setup function.
- **Clean up in `ngOnDestroy`**: cancel `requestAnimationFrame` (store the id in a class field), `window.removeEventListener`, unsubscribe from RxJS subs via `this.subs.unsubscribe()`. Every component that sets up a loop must tear it down.
- **RxJS subscriptions**: collect with `this.subs = new Subscription()` and `this.subs.add(...)`. Unsubscribe in `ngOnDestroy`.
- **AppStateService**: inject with `private readonly appState = inject(AppStateService)`. Subscribe to `text$` and `weather$` for cross-component state.

---

## Canvas Animation Patterns

- Overlay canvases (skate, banner) use `position: fixed; pointer-events: none` so click events fall through to the rain canvas.
- The rain canvas sits inside the home component, not fixed — it fills the viewport via CSS.
- `canvas.width = window.innerWidth; canvas.height = window.innerHeight` inside a `resize()` function, called on `window.addEventListener('resize', ...)` and on init. Store the listener ref to remove it in `ngOnDestroy`.
- `hitCanvas` pattern in rain: an off-screen canvas used for pixel-perfect collision detection without reading back from the main canvas on every frame.
- Flame particles use `ctx.globalCompositeOperation = 'lighter'` (additive blending) for natural fire glow — overlapping particles brighten each other.

---

## Commands

```bash
npm start          # ng serve — dev server at localhost:4200
npm run build      # ng build — production build, also catches type errors
npm test           # ng test — Karma/Jasmine unit tests
```

Run `npm run build` after any structural change to catch TypeScript errors early.

---

## What NOT To Do

- Do not create NgModules. This project is fully standalone-component.
- Do not add class fields for animation loop variables — keep them closure-scoped in `ngAfterViewInit`.
- Do not forget `ngOnDestroy` cleanup for any component that starts a `requestAnimationFrame` loop, adds a `window` listener, or opens an RxJS subscription.
- Do not use `any` types. Type canvas contexts as `CanvasRenderingContext2D` (cast from `getContext`).
- Do not add `console.log` to production code.
- Do not touch `neural-network.shaders.ts` without expecting pre-existing TypeScript errors there — they are known and unrelated to other features.
- Do not split a simple canvas animation across multiple files. Keep component logic co-located in its feature folder.

---

# Three.js Project Guide

Conventions for Three.js work in this repo. Three.js r162 is installed as a package dependency.

## Versions & APIs

- Three.js **r162** is the installed version. Do not suggest pre-r125 patterns.
- `Geometry` was removed in r125. Only `BufferGeometry` exists. Never write `new THREE.Geometry()`.
- `CapsuleGeometry` (r142+), `TubeGeometry`, etc. are available on `BufferGeometry` helpers.
- Renderer color management changed in r152: `THREE.ColorManagement.enabled` is on by default; assume sRGB output. Don't set `outputEncoding` (removed); use `renderer.outputColorSpace = THREE.SRGBColorSpace` if explicit.
- `WebGLRenderer` is the default. Use `WebGPURenderer` (`import * as THREE from 'three/webgpu'`) only when the task asks for it or when GPU compute / large instancing is the bottleneck. WebGPU init is **async** — `await renderer.init()` before the first render.
- Prefer TSL (`three/tsl`) over GLSL strings for new shader work in WebGPU contexts. For WebGL, `ShaderMaterial` with GLSL is fine.

## Imports

- Always tree-shakeable named imports: `import { Scene, Mesh, MeshStandardMaterial } from 'three'` — not `import * as THREE`. Exception: `three/webgpu` and `three/tsl` are namespace-imported by convention.
- Addons live under `three/addons/...` (e.g. `three/addons/controls/OrbitControls.js`), not `three/examples/jsm/...`. Both resolve, but `three/addons` is the documented path.

## Defaults to use without asking

- `MeshStandardMaterial` for PBR, `MeshBasicMaterial` for unlit. Don't reach for `MeshPhongMaterial` or `MeshLambertMaterial` unless specified.
- `PerspectiveCamera(50, w/h, 0.1, 100)` as the starting point; widen near/far only when scene scale demands it.
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — uncapped DPR tanks perf on retina.
- Always add a `resize` handler that updates both camera aspect and renderer size.
- Use `renderer.setAnimationLoop(fn)` over manual `requestAnimationFrame` — required for WebXR and works identically otherwise.

## Performance — apply by default

- **Instancing over loops.** >50 of the same mesh → `InstancedMesh`. Don't generate a loop of `scene.add(mesh.clone())`.
- **Reuse geometries and materials.** One geometry, one material, many meshes. Cloning materials kills batching.
- **Dispose on teardown.** Any scene created in an Angular component must dispose geometries, materials, and textures in `ngOnDestroy`.
- **Frustum culling is on by default** — don't disable it without reason.
- **Shadows are expensive.** Only enable `castShadow`/`receiveShadow` on objects that need it; prefer `PCFSoftShadowMap` with a tight `shadow.camera` frustum.
- Avoid per-frame allocations inside the animation loop. Reuse `Vector3`/`Quaternion`/`Matrix4` instances declared outside the loop.

## Code style

- **One file unless asked.** No unnecessary splits for demos under ~100 lines.
- Comments explain *why*, not *what*. `// reuse to avoid per-frame allocation` yes; `// create a vector` no.
- Numeric literals get units in comments when ambiguous: `0.016 // ~60fps delta in seconds`.

## Common traps to avoid

- `lookAt` after `position.set` — order matters; `lookAt` reads current position.
- Forgetting `material.needsUpdate = true` after changing textures or defines.
- Loading textures synchronously — always use the callback or `await loader.loadAsync()`.
- Using `THREE.Clock().getDelta()` and `getElapsedTime()` on different clock instances expecting consistency.
- Mixing radians and degrees. Three.js is radians everywhere; `MathUtils.degToRad()` exists.
- Setting `renderer.setSize()` without updating `camera.aspect` and calling `camera.updateProjectionMatrix()`.

## When to ask vs. assume

Ask only if the answer materially changes the code:
- Target renderer (WebGL vs WebGPU) **if** the task involves shaders or compute.
- Specific model formats (GLTF/GLB is the default; OBJ/FBX/USDZ → ask).
- Whether physics is needed (don't add Rapier/Cannon unless requested).

Otherwise, make the reasonable choice and state the assumption in one line.
