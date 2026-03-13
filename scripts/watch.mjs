import { cp, mkdir, watch } from "node:fs/promises"
import { context } from "esbuild"

const outdir = "dist"

async function copyStatic() {
  await mkdir(outdir, { recursive: true })
  await cp("index.html", `${outdir}/index.html`)
  await cp("config.json", `${outdir}/config.json`)
}

const ctx = await context({
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "esm",
  sourcemap: true,
  target: ["es2022"],
  outdir,
  define: {
    __DEV__: "true",
    "process.env.NODE_ENV": '"development"',
  },
  logLevel: "info",
})

await copyStatic()
await ctx.watch()

for await (const event of watch(".", { recursive: false })) {
  if (event.filename === "index.html" || event.filename === "config.json") {
    await copyStatic()
    console.log(`Copied ${event.filename}`)
  }
}
