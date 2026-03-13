import { generateEntityId, generateShortId } from "./utils.js"

const DB_NAME = "fakebook-db"
const DB_VERSION = 2

let dbPromise

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"))
  })
}

function withStore(storeName, mode, handler) {
  return getDb().then(async (db) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const result = await handler(store, transaction)
    await transactionDone(transaction)
    return result
  })
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" })
        }

        if (!db.objectStoreNames.contains("posts")) {
          const posts = db.createObjectStore("posts", { keyPath: "id" })
          posts.createIndex("authorId", "authorId", { unique: false })
          posts.createIndex("createdAt", "createdAt", { unique: false })
        }

        if (!db.objectStoreNames.contains("reactions")) {
          const reactions = db.createObjectStore("reactions", { keyPath: "id" })
          reactions.createIndex("postId", "postId", { unique: false })
          reactions.createIndex("profileId", "profileId", { unique: false })
        }

        if (!db.objectStoreNames.contains("comments")) {
          const comments = db.createObjectStore("comments", { keyPath: "id" })
          comments.createIndex("postId", "postId", { unique: false })
          comments.createIndex("authorId", "authorId", { unique: false })
          comments.createIndex("createdAt", "createdAt", { unique: false })
        }

        if (!db.objectStoreNames.contains("appmeta")) {
          db.createObjectStore("appmeta", { keyPath: "key" })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return dbPromise
}

export async function listProfiles() {
  return withStore("profiles", "readonly", async (store) => {
    const items = await requestToPromise(store.getAll())
    return items.sort((a, b) => a.name.localeCompare(b.name))
  })
}

export function getProfile(profileId) {
  return withStore("profiles", "readonly", (store) => requestToPromise(store.get(profileId)))
}

export async function createProfile(input) {
  return withStore("profiles", "readwrite", async (store) => {
    let id = generateShortId()
    while (await requestToPromise(store.get(id))) {
      id = generateShortId()
    }

    const now = new Date().toISOString()
    const profile = {
      id,
      name: input.name,
      location: input.location,
      description: input.description,
      picture: input.picture ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await requestToPromise(store.add(profile))
    return profile
  })
}

export async function updateProfile(profileId, input) {
  return withStore("profiles", "readwrite", async (store) => {
    const existing = await requestToPromise(store.get(profileId))
    if (!existing) {
      throw new Error("Profile not found")
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    }

    await requestToPromise(store.put(updated))
    return updated
  })
}

export async function deleteProfile(profileId) {
  const db = await getDb()
  const transaction = db.transaction(["profiles", "posts", "reactions", "comments"], "readwrite")
  const profiles = transaction.objectStore("profiles")
  const posts = transaction.objectStore("posts")
  const reactions = transaction.objectStore("reactions")
  const comments = transaction.objectStore("comments")

  profiles.delete(profileId)

  const postsByAuthor = posts.index("authorId").getAll(IDBKeyRange.only(profileId))
  const ownReactions = reactions.index("profileId").getAll(IDBKeyRange.only(profileId))
  const ownComments = comments.index("authorId").getAll(IDBKeyRange.only(profileId))

  const [authorPosts, authorReactions, authorComments] = await Promise.all([
    requestToPromise(postsByAuthor),
    requestToPromise(ownReactions),
    requestToPromise(ownComments),
  ])

  for (const post of authorPosts) {
    posts.delete(post.id)

    const postReactions = await requestToPromise(
      reactions.index("postId").getAll(IDBKeyRange.only(post.id)),
    )
    const postComments = await requestToPromise(
      comments.index("postId").getAll(IDBKeyRange.only(post.id)),
    )

    for (const reaction of postReactions) {
      reactions.delete(reaction.id)
    }
    for (const comment of postComments) {
      comments.delete(comment.id)
    }
  }

  for (const reaction of authorReactions) {
    reactions.delete(reaction.id)
  }
  for (const comment of authorComments) {
    comments.delete(comment.id)
  }

  await transactionDone(transaction)
}

export async function listPosts({ authorId = null } = {}) {
  return withStore("posts", "readonly", async (store) => {
    const allPosts = authorId
      ? await requestToPromise(store.index("authorId").getAll(IDBKeyRange.only(authorId)))
      : await requestToPromise(store.getAll())

    return allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })
}

export function getPost(postId) {
  return withStore("posts", "readonly", (store) => requestToPromise(store.get(postId)))
}

export async function createPost(input) {
  return withStore("posts", "readwrite", async (store) => {
    const now = new Date().toISOString()
    const post = {
      id: generateEntityId("post"),
      authorId: input.authorId,
      text: input.text,
      images: input.images,
      createdAt: now,
      updatedAt: now,
    }

    await requestToPromise(store.add(post))
    return post
  })
}

export async function updatePost(postId, input) {
  return withStore("posts", "readwrite", async (store) => {
    const existing = await requestToPromise(store.get(postId))
    if (!existing) {
      throw new Error("Post not found")
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    }

    await requestToPromise(store.put(updated))
    return updated
  })
}

export async function deletePost(postId) {
  const db = await getDb()
  const transaction = db.transaction(["posts", "reactions", "comments"], "readwrite")
  const posts = transaction.objectStore("posts")
  const reactions = transaction.objectStore("reactions")
  const comments = transaction.objectStore("comments")

  posts.delete(postId)
  const postReactions = await requestToPromise(
    reactions.index("postId").getAll(IDBKeyRange.only(postId)),
  )
  for (const reaction of postReactions) {
    reactions.delete(reaction.id)
  }

  const postComments = await requestToPromise(
    comments.index("postId").getAll(IDBKeyRange.only(postId)),
  )
  for (const comment of postComments) {
    comments.delete(comment.id)
  }

  await transactionDone(transaction)
}

export async function listCommentsByPostId(postId) {
  return withStore("comments", "readonly", async (store) => {
    const comments = await requestToPromise(store.index("postId").getAll(IDBKeyRange.only(postId)))
    return comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  })
}

export async function createComment(input) {
  return withStore("comments", "readwrite", async (store) => {
    const comment = {
      id: generateEntityId("comment"),
      postId: input.postId,
      authorId: input.authorId,
      text: input.text,
      createdAt: new Date().toISOString(),
    }
    await requestToPromise(store.add(comment))
    return comment
  })
}

export async function toggleReaction({ postId, profileId, emoji }) {
  return withStore("reactions", "readwrite", async (store) => {
    // One reaction record per (post, profile, emoji) so different emojis can co-exist.
    const reactionId = `${postId}:${profileId}:${emoji}`
    const legacyReactionId = `${postId}:${profileId}`
    const existing = await requestToPromise(store.get(reactionId))
    const legacy = await requestToPromise(store.get(legacyReactionId))
    const legacyMatchesEmoji = legacy && legacy.emoji === emoji

    if (existing || legacyMatchesEmoji) {
      if (existing) {
        await requestToPromise(store.delete(reactionId))
      }
      if (legacyMatchesEmoji) {
        await requestToPromise(store.delete(legacyReactionId))
      }
      return { mode: "removed", emoji }
    }

    const created = {
      id: reactionId,
      postId,
      profileId,
      emoji,
      createdAt: new Date().toISOString(),
    }
    await requestToPromise(store.put(created))
    return { mode: "set", emoji }
  })
}

export async function getReactionSummary(postId, profileId) {
  return withStore("reactions", "readonly", async (store) => {
    const postReactions = await requestToPromise(
      store.index("postId").getAll(IDBKeyRange.only(postId)),
    )
    const counts = {}
    const mine = new Set()
    const reactorProfileIds = []

    for (const reaction of postReactions) {
      counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1
      reactorProfileIds.push(reaction.profileId)
      if (reaction.profileId === profileId) {
        mine.add(reaction.emoji)
      }
    }

    return { counts, mine: [...mine], reactorProfileIds }
  })
}
