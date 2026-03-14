import { cp, mkdir, readFile, watch, writeFile } from "node:fs/promises"
import { context } from "esbuild"

const outdir = "dist"
const assetVersion = Date.now().toString(36)

async function copyStatic() {
  await mkdir(outdir, { recursive: true })
  const sourceHtml = await readFile("index.html", "utf8")
  const versionedHtml = sourceHtml.replaceAll("__ASSET_VERSION__", assetVersion)
  await writeFile(`${outdir}/index.html`, versionedHtml)
  await cp("config.json", `${outdir}/config.json`)
}

const ctx = await context({
  entryPoints: ["src/main.js"],
  bundle: true,
  splitting: true,
  format: "esm",
  sourcemap: true,
  target: ["es2022"],
  outdir,
  define: {
    __DEV__: "true",
    __ASSET_VERSION__: JSON.stringify(assetVersion),
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
