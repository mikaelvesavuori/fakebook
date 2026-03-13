import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import { build } from "esbuild"

const outdir = "dist"
const args = new Set(process.argv.slice(2))
const sourcemap = args.has("--sourcemap")
const analyze = args.has("--analyze")

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const result = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "esm",
  sourcemap,
  target: ["es2022"],
  outdir,
  minify: true,
  drop: ["console", "debugger"],
  legalComments: "none",
  treeShaking: true,
  define: {
    __DEV__: "false",
    "process.env.NODE_ENV": '"production"',
  },
  metafile: analyze,
  logLevel: "info",
})

await cp("index.html", `${outdir}/index.html`)
await cp("config.json", `${outdir}/config.json`)

if (analyze && result.metafile) {
  await writeFile(`${outdir}/meta.json`, JSON.stringify(result.metafile, null, 2))
  console.log("Wrote dist/meta.json")
}
