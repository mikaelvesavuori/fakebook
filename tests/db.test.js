import { beforeEach, describe, expect, it, vi } from "vitest"
import FDBFactory from "fake-indexeddb/lib/FDBFactory"
import FDBKeyRange from "fake-indexeddb/lib/FDBKeyRange"

async function loadDbModule() {
  vi.resetModules()
  return import("../src/db.js")
}

describe("db", () => {
  beforeEach(() => {
    globalThis.indexedDB = new FDBFactory()
    globalThis.IDBKeyRange = FDBKeyRange
  })

  it("creates, gets, updates and lists profiles", async () => {
    const db = await loadDbModule()
    const bob = await db.createProfile({
      name: "Bob",
      location: "SE",
      description: "B",
      isBot: true,
      picture: null,
    })
    const alice = await db.createProfile({
      name: "Alice",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })

    const listed = await db.listProfiles()
    expect(listed.map((profile) => profile.name)).toEqual(["Alice", "Bob"])

    const got = await db.getProfile(alice.id)
    expect(got?.id).toBe(alice.id)
    expect(got?.isBot).toBe(false)

    const updated = await db.updateProfile(bob.id, { location: "Stockholm", isBot: false })
    expect(updated.location).toBe("Stockholm")
    expect(updated.isBot).toBe(false)

    await expect(db.updateProfile("missing", { name: "X" })).rejects.toThrow(/Profile not found/)
  })

  it("creates, updates, lists and deletes posts with cascading comments/reactions", async () => {
    const db = await loadDbModule()
    const author = await db.createProfile({
      name: "Author",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })

    const post = await db.createPost({ authorId: author.id, text: "Hello", images: [] })
    await db.createComment({ postId: post.id, authorId: author.id, text: "First" })
    await db.createComment({ postId: post.id, authorId: author.id, text: "Second" })
    await db.toggleReaction({ postId: post.id, profileId: author.id, emoji: "👍" })

    const updated = await db.updatePost(post.id, { text: "Updated" })
    expect(updated.text).toBe("Updated")
    expect(updated.updatedAt).not.toBe(post.updatedAt)

    const listed = await db.listPosts({ authorId: author.id })
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(post.id)

    await db.deletePost(post.id)

    expect(await db.getPost(post.id)).toBeUndefined()
    expect(await db.listCommentsByPostId(post.id)).toEqual([])
    expect(await db.getReactionSummary(post.id, author.id)).toEqual({
      counts: {},
      mine: [],
      reactorProfileIds: [],
    })
  })

  it("handles reaction toggle including legacy reaction ids", async () => {
    const db = await loadDbModule()
    const profile = await db.createProfile({
      name: "User",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })
    const post = await db.createPost({ authorId: profile.id, text: "P", images: [] })

    const setResult = await db.toggleReaction({ postId: post.id, profileId: profile.id, emoji: "❤️" })
    expect(setResult).toEqual({ mode: "set", emoji: "❤️" })

    const removeResult = await db.toggleReaction({
      postId: post.id,
      profileId: profile.id,
      emoji: "❤️",
    })
    expect(removeResult).toEqual({ mode: "removed", emoji: "❤️" })

    const conn = await db.getDb()
    const tx = conn.transaction("reactions", "readwrite")
    tx.objectStore("reactions").put({
      id: `${post.id}:${profile.id}`,
      postId: post.id,
      profileId: profile.id,
      emoji: "🎉",
      createdAt: new Date().toISOString(),
    })
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    const legacyRemoved = await db.toggleReaction({
      postId: post.id,
      profileId: profile.id,
      emoji: "🎉",
    })
    expect(legacyRemoved).toEqual({ mode: "removed", emoji: "🎉" })
  })

  it("returns reaction summary counts and mine list", async () => {
    const db = await loadDbModule()
    const a = await db.createProfile({
      name: "A",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })
    const b = await db.createProfile({
      name: "B",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })
    const post = await db.createPost({ authorId: a.id, text: "Post", images: [] })

    await db.toggleReaction({ postId: post.id, profileId: a.id, emoji: "👍" })
    await db.toggleReaction({ postId: post.id, profileId: b.id, emoji: "👍" })
    await db.toggleReaction({ postId: post.id, profileId: b.id, emoji: "😂" })

    const summaryForA = await db.getReactionSummary(post.id, a.id)
    expect(summaryForA.counts).toEqual({ "👍": 2, "😂": 1 })
    expect(summaryForA.mine).toEqual(["👍"])
    expect(summaryForA.reactorProfileIds).toHaveLength(3)
  })

  it("sorts comments by createdAt ascending", async () => {
    const db = await loadDbModule()
    const profile = await db.createProfile({
      name: "Author",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })
    const post = await db.createPost({ authorId: profile.id, text: "Post", images: [] })

    const first = await db.createComment({ postId: post.id, authorId: profile.id, text: "A" })
    const second = await db.createComment({ postId: post.id, authorId: profile.id, text: "B" })

    const conn = await db.getDb()
    const tx = conn.transaction("comments", "readwrite")
    tx.objectStore("comments").put({ ...first, createdAt: "2025-01-01T00:00:00.000Z" })
    tx.objectStore("comments").put({ ...second, createdAt: "2025-01-02T00:00:00.000Z" })
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    const comments = await db.listCommentsByPostId(post.id)
    expect(comments.map((comment) => comment.id)).toEqual([first.id, second.id])
  })

  it("deletes profile and cascades authored content and authored interactions", async () => {
    const db = await loadDbModule()
    const alice = await db.createProfile({
      name: "Alice",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })
    const bob = await db.createProfile({
      name: "Bob",
      location: "",
      description: "",
      isBot: false,
      picture: null,
    })

    const alicePost = await db.createPost({ authorId: alice.id, text: "Alice post", images: [] })
    const bobPost = await db.createPost({ authorId: bob.id, text: "Bob post", images: [] })

    await db.createComment({ postId: alicePost.id, authorId: bob.id, text: "bob->alice" })
    await db.createComment({ postId: bobPost.id, authorId: alice.id, text: "alice->bob" })

    await db.toggleReaction({ postId: alicePost.id, profileId: bob.id, emoji: "👍" })
    await db.toggleReaction({ postId: bobPost.id, profileId: alice.id, emoji: "🎉" })

    await db.deleteProfile(alice.id)

    const profiles = await db.listProfiles()
    expect(profiles.map((profile) => profile.id)).toEqual([bob.id])

    const posts = await db.listPosts()
    expect(posts.map((post) => post.id)).toEqual([bobPost.id])

    const bobPostComments = await db.listCommentsByPostId(bobPost.id)
    expect(bobPostComments).toEqual([])

    const bobPostReactions = await db.getReactionSummary(bobPost.id, bob.id)
    expect(bobPostReactions).toEqual({ counts: {}, mine: [], reactorProfileIds: [] })
  })
})
