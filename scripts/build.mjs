#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { build } from "esbuild"
import { minify as minifyHtml } from "html-minifier-terser"
import { transform } from "lightningcss"

const outdir = "dist"
const args = new Set(process.argv.slice(2))
const sourcemap = args.has("--sourcemap")
const analyze = args.has("--analyze")
const dev = args.has("--dev")

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const result = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  splitting: true,
  format: "esm",
  sourcemap,
  target: ["es2022"],
  outdir,
  minify: !dev,
  drop: dev ? [] : ["console", "debugger"],
  legalComments: "none",
  treeShaking: true,
  define: {
    __DEV__: String(dev),
    "process.env.NODE_ENV": dev ? '"development"' : '"production"',
  },
  metafile: analyze,
  logLevel: "info",
})

await cp("config.json", `${outdir}/config.json`)

const sourceHtml = await readFile("index.html", "utf8")
const outputHtml = dev
  ? sourceHtml
  : await minifyHtml(sourceHtml, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
    })
await writeFile(`${outdir}/index.html`, outputHtml)

if (!dev) {
  try {
    const cssInput = await readFile(`${outdir}/main.css`)
    const { code } = transform({
      filename: "main.css",
      code: cssInput,
      minify: true,
      sourceMap: false,
    })
    await writeFile(`${outdir}/main.css`, code)
  } catch (error) {
    console.warn("Skipping CSS post-minify:", error?.message || error)
  }
}

if (analyze && result.metafile) {
  await writeFile(`${outdir}/meta.json`, JSON.stringify(result.metafile, null, 2))
  console.log("Wrote dist/meta.json")
}
