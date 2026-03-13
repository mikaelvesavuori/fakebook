import "./styles.css"
import { loadConfig } from "./config.js"
import { LIMITS, REACTIONS } from "./constants.js"
import {
  createComment,
  createPost,
  createProfile,
  deletePost,
  deleteProfile,
  getPost,
  getReactionSummary,
  listCommentsByPostId,
  listPosts,
  listProfiles,
  toggleReaction,
  updatePost,
  updateProfile,
} from "./db.js"
import { processImageFile, processImageFiles } from "./images.js"
import { escapeHtml, formatDate } from "./utils.js"
import { validateCommentInput, validatePostInput, validateProfile } from "./validators.js"

const app = document.querySelector("#app")
const LAST_PROFILE_KEY = "fakebook:lastProfileId"

function createFeedState() {
  return {
    filter: "all",
    all: [],
    visible: [],
    hasMore: false,
    loadingMore: false,
    reactionByPostId: new Map(),
    commentsByPostId: new Map(),
    openReactionPostId: null,
    openCommentsPostId: null,
  }
}

const state = {
  config: {
    platformName: "Fakebook",
    platformIcon: "💬",
  },
  view: "signin",
  notice: null,
  currentProfileId: null,
  profiles: [],
  profileMap: new Map(),
  profileCreatePicture: null,
  profileEditPicture: null,
  feed: createFeedState(),
  postEditor: {
    mode: "create",
    postId: null,
    text: "",
    images: [],
  },
  ui: {
    accountMenuOpen: false,
  },
}

function setNotice(type, message) {
  state.notice = { type, message }
  render()
  window.clearTimeout(setNotice.timeoutId)
  setNotice.timeoutId = window.setTimeout(() => {
    state.notice = null
    render()
  }, 3500)
}

function currentProfile() {
  return state.profileMap.get(state.currentProfileId) ?? null
}

function initialsFromName(name) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()

  return letters || "?"
}

function iconPlus() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  `
}

function iconEdit() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  `
}

function iconTrash() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 7V5h6v2" />
    </svg>
  `
}

function iconReact() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 14.5h7" />
      <path d="M9 9h.01M15 9h.01" />
      <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
    </svg>
  `
}

function iconComment() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    </svg>
  `
}

function resetEditor() {
  state.postEditor = {
    mode: "create",
    postId: null,
    text: "",
    images: [],
  }
}

function resetFeedViewState() {
  state.feed.visible = []
  state.feed.hasMore = false
  state.feed.loadingMore = false
  state.feed.reactionByPostId = new Map()
  state.feed.commentsByPostId = new Map()
  state.feed.openReactionPostId = null
  state.feed.openCommentsPostId = null
}

function closeOpenOverlays(target, { ignoreAccount = false, ignoreReaction = false } = {}) {
  let changed = false

  if (!ignoreAccount && state.ui.accountMenuOpen && !target.closest(".account")) {
    state.ui.accountMenuOpen = false
    changed = true
  }

  if (!ignoreReaction && state.feed.openReactionPostId && !target.closest(".reaction-picker")) {
    state.feed.openReactionPostId = null
    changed = true
  }

  return changed
}

async function refreshProfiles() {
  state.profiles = await listProfiles()
  state.profileMap = new Map(state.profiles.map((profile) => [profile.id, profile]))
  if (state.currentProfileId && !state.profileMap.has(state.currentProfileId)) {
    state.currentProfileId = null
  }
}

async function refreshFeed({ reset = true } = {}) {
  if (!state.currentProfileId) {
    return
  }

  const authorId = state.feed.filter === "mine" ? state.currentProfileId : null
  state.feed.all = await listPosts({ authorId })

  if (reset) {
    resetFeedViewState()
  }

  await appendFeedBatch()
}

async function appendFeedBatch() {
  const start = state.feed.visible.length
  const end = start + LIMITS.feedBatchSize
  const nextPosts = state.feed.all.slice(start, end)

  const summaries = await Promise.all(
    nextPosts.map((post) => getReactionSummary(post.id, state.currentProfileId)),
  )
  const commentLists = await Promise.all(nextPosts.map((post) => listCommentsByPostId(post.id)))

  for (let index = 0; index < nextPosts.length; index += 1) {
    state.feed.reactionByPostId.set(nextPosts[index].id, summaries[index])
    state.feed.commentsByPostId.set(nextPosts[index].id, commentLists[index])
  }

  state.feed.visible = [...state.feed.visible, ...nextPosts]
  state.feed.hasMore = state.feed.visible.length < state.feed.all.length
}

function signIn(profileId) {
  if (!state.profileMap.has(profileId)) {
    setNotice("error", "Profile no longer exists.")
    return
  }

  state.currentProfileId = profileId
  localStorage.setItem(LAST_PROFILE_KEY, profileId)
  state.view = "posts"
}

function signOut() {
  if (window.confirm("Sign out?")) {
    localStorage.removeItem(LAST_PROFILE_KEY)
    state.currentProfileId = null
    state.view = "signin"
    state.profileEditPicture = null
    state.profileCreatePicture = null
    resetEditor()
    state.feed = createFeedState()
    state.ui.accountMenuOpen = false
    setNotice("info", "Signed out.")
  }
}

function renderNotice() {
  if (!state.notice) {
    return ""
  }
  return `<p class="notice notice--${state.notice.type}">${escapeHtml(state.notice.message)}</p>`
}

function renderHeader() {
  const signedIn = Boolean(currentProfile())
  const profile = currentProfile()

  return `
    <header class="topbar">
      <div class="topbar__main">
        <div class="brand">
          <span class="brand__icon">${escapeHtml(state.config.platformIcon)}</span>
          <div>
            <h1>${escapeHtml(state.config.platformName)}</h1>
          </div>
        </div>
        ${
          signedIn
            ? `<div class="account">
                <button
                  class="account__trigger"
                  data-action="toggle-account-menu"
                  aria-label="Open account menu"
                  aria-expanded="${state.ui.accountMenuOpen ? "true" : "false"}"
                >
                  ${
                    profile.picture
                      ? `<img class="avatar avatar--sm" src="${escapeHtml(profile.picture)}" alt="${escapeHtml(profile.name)}" />`
                      : `<span class="avatar avatar--sm avatar--placeholder">${escapeHtml(initialsFromName(profile.name))}</span>`
                  }
                </button>
                <div class="account__menu ${state.ui.accountMenuOpen ? "account__menu--open" : ""}">
                  <button data-action="goto-profile">Profile</button>
                  <button class="danger" data-action="signout">Sign out</button>
                </div>
              </div>`
            : ""
        }
      </div>
    </header>
  `
}

function renderSignIn() {
  return `
    <section class="panel panel--narrow">
      <h2 class="panel__title">Sign in</h2>
      <p class="panel__text">Choose an existing profile or create a new one.</p>
      <div class="stack stack--lg">
        ${
          state.profiles.length
            ? state.profiles
                .map(
                  (profile) => `
                    <article class="list-item">
                      <div class="list-item__profile">
                        ${
                          profile.picture
                            ? `<img class="avatar" src="${escapeHtml(profile.picture)}" alt="${escapeHtml(profile.name)}" />`
                            : `<span class="avatar avatar--placeholder">${escapeHtml(initialsFromName(profile.name))}</span>`
                        }
                        <div>
                        <p class="list-item__title"><strong>${escapeHtml(profile.name)}</strong></p>
                        <p class="muted">${escapeHtml(profile.location || "No location")}</p>
                        </div>
                      </div>
                      <button class="primary" data-action="signin" data-profile-id="${escapeHtml(profile.id)}">Sign in</button>
                    </article>
                  `,
                )
                .join("")
            : '<p class="muted">No profiles yet.</p>'
        }
      </div>
      <button class="primary" data-action="goto-create-profile">Create profile</button>
    </section>
  `
}

function renderCreateProfile() {
  return `
    <section class="panel panel--narrow">
      <h2 class="panel__title">Create profile</h2>
      <p class="panel__text">Set up your local profile. Everything stays on this device.</p>
      <form id="create-profile-form" class="stack">
        <label>
          Name
          <input name="name" minlength="${LIMITS.profileNameMin}" maxlength="${LIMITS.profileNameMax}" required />
        </label>
        <label>
          Location
          <input name="location" maxlength="${LIMITS.locationMax}" />
        </label>
        <label>
          Description
          <textarea name="description" maxlength="${LIMITS.descriptionMax}"></textarea>
        </label>
        <label>
          Picture (optional)
          <input id="create-profile-picture-input" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>
        ${state.profileCreatePicture ? `<img class="preview" src="${state.profileCreatePicture}" alt="Profile preview" />` : ""}
        <div class="row row--end">
          <button class="primary" type="submit">Create profile</button>
          <button type="button" data-action="cancel-create-profile">Cancel</button>
        </div>
      </form>
    </section>
  `
}

function renderProfileView() {
  const profile = currentProfile()
  if (!profile) {
    return ""
  }

  const picture = state.profileEditPicture ?? profile.picture

  return `
    <div class="profile-view">
      <button class="back-nav" data-action="goto-posts">← Back to posts</button>
      <section class="panel">
        <h2 class="panel__title">Profile</h2>
        <p class="panel__text">Update your details and picture.</p>
        <form id="edit-profile-form" class="stack">
          <p class="muted">User ID: ${escapeHtml(profile.id)}</p>
          <label>
            Name
            <input name="name" minlength="${LIMITS.profileNameMin}" maxlength="${LIMITS.profileNameMax}" required value="${escapeHtml(
              profile.name,
            )}" />
          </label>
          <label>
            Location
            <input name="location" maxlength="${LIMITS.locationMax}" value="${escapeHtml(
              profile.location || "",
            )}" />
          </label>
          <label>
            Description
            <textarea name="description" maxlength="${LIMITS.descriptionMax}">${escapeHtml(
              profile.description || "",
            )}</textarea>
          </label>
          <div class="profile-photo-card">
            <div class="profile-photo-preview-wrap">
              ${
                picture
                  ? `<img class="preview preview--avatar" src="${picture}" alt="Profile picture" />`
                  : `<span class="preview preview--avatar avatar--placeholder">${escapeHtml(initialsFromName(profile.name))}</span>`
              }
              <input
                id="edit-profile-picture-input"
                class="profile-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
            <div class="profile-photo-meta">
              <p class="list-item__title"><strong>Profile picture</strong></p>
              <p class="muted">Use a square image for best results. JPEG/PNG/WebP supported.</p>
              <div class="row row--tight">
                <label class="btn-file btn-file--primary" for="edit-profile-picture-input">Upload new</label>
                <button type="button" data-action="remove-profile-picture">Remove picture</button>
              </div>
            </div>
          </div>
          <div class="row row--end">
            <button class="primary" type="submit">Save profile</button>
            <button type="button" class="danger" data-action="delete-profile">Delete profile</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function renderReactorNames(reactorProfileIds) {
  const uniqueIds = [...new Set(reactorProfileIds ?? [])]
  if (uniqueIds.length === 0) {
    return ""
  }

  const names = uniqueIds.map(
    (profileId) => state.profileMap.get(profileId)?.name ?? "Unknown user",
  )
  const visibleNames = names.slice(0, 4)
  const overflow = names.length - visibleNames.length
  const namesLabel = `${visibleNames.join(", ")}${overflow > 0 ? ` +${overflow} more` : ""}`
  const label = `${namesLabel} reacted to this`

  return `<p class="reaction-names">${escapeHtml(label)}</p>`
}

function renderPostComments(postId, comments) {
  const listMarkup = comments.length
    ? comments
        .map((comment) => {
          const authorName = state.profileMap.get(comment.authorId)?.name ?? "Unknown user"
          return `<article class="comment">
            <p class="comment__meta"><strong>${escapeHtml(authorName)}</strong> · ${escapeHtml(
              formatDate(comment.createdAt),
            )}</p>
            <p class="comment__text">${escapeHtml(comment.text).replaceAll("\n", "<br />")}</p>
          </article>`
        })
        .join("")
    : '<p class="muted">No comments yet.</p>'

  return `
    <section class="comments">
      <p class="comments__title">Comments</p>
      <div class="comments__list">${listMarkup}</div>
      <form class="comment-form" data-action="create-comment" data-post-id="${escapeHtml(postId)}">
        <input
          name="commentText"
          maxlength="${LIMITS.commentTextMax}"
          placeholder="Write a comment"
          required
        />
        <button class="primary" type="submit">Post</button>
      </form>
    </section>
  `
}

function renderPostCard(post) {
  const summary = state.feed.reactionByPostId.get(post.id) ?? {
    counts: {},
    mine: [],
    reactorProfileIds: [],
  }
  const comments = state.feed.commentsByPostId.get(post.id) ?? []
  const author = state.profileMap.get(post.authorId)
  const mine = post.authorId === state.currentProfileId
  const authorName = author?.name ?? "Unknown profile"
  const authorPicture = author?.picture ?? null
  const isReactionPanelOpen = state.feed.openReactionPostId === post.id
  const isCommentsOpen = state.feed.openCommentsPostId === post.id
  const reactionEntries = Object.entries(summary.counts).filter(([, count]) => count > 0)

  return `
    <article class="post" data-post-id="${escapeHtml(post.id)}">
      <header class="post__header">
        <div class="post__author">
          ${
            authorPicture
              ? `<img class="avatar" src="${escapeHtml(authorPicture)}" alt="${escapeHtml(authorName)}" />`
              : `<span class="avatar avatar--placeholder">${escapeHtml(initialsFromName(authorName))}</span>`
          }
          <div class="post__identity">
            <p class="list-item__title"><strong>${escapeHtml(authorName)}</strong></p>
            <p class="muted">${escapeHtml(formatDate(post.createdAt))}${
              post.updatedAt !== post.createdAt ? " (edited)" : ""
            }</p>
          </div>
        </div>
        ${
          mine
            ? `<div class="row row--tight">
                <button class="icon-btn" data-action="edit-post" data-post-id="${escapeHtml(post.id)}" aria-label="Edit post">
                  ${iconEdit()}
                </button>
                <button class="icon-btn icon-btn--danger" data-action="delete-post" data-post-id="${escapeHtml(post.id)}" aria-label="Delete post">
                  ${iconTrash()}
                </button>
              </div>`
            : ""
        }
      </header>
      ${
        post.text
          ? `<p class="post__text">${escapeHtml(post.text).replaceAll("\n", "<br />")}</p>`
          : ""
      }
      ${
        post.images.length
          ? `<div class="gallery">${post.images
              .map((image, index) => `<img src="${image}" alt="Post image ${index + 1}" />`)
              .join("")}</div>`
          : ""
      }
      <div class="reactions">
        <div class="reaction-summary">
          ${
            reactionEntries.length
              ? reactionEntries
                  .map(([emoji, count]) => {
                    if (summary.mine.includes(emoji)) {
                      return `<button
                        class="reaction-badge reaction-badge-btn reaction-badge--mine"
                        data-action="react"
                        data-post-id="${escapeHtml(post.id)}"
                        data-emoji="${emoji}"
                        aria-label="Remove your ${emoji} reaction"
                        title="Tap to remove your ${emoji} reaction"
                      >${emoji} ${count}</button>`
                    }

                    return `<span class="reaction-badge">${emoji} ${count}</span>`
                  })
                  .join("")
              : '<span class="muted">No reactions yet</span>'
          }
        </div>
        <div class="post__actions">
          <div class="reaction-picker ${isReactionPanelOpen ? "reaction-picker--open" : ""}">
            <button
              class="icon-btn reaction-trigger ${summary.mine.length > 0 ? "reaction-trigger--active" : ""}"
              data-action="toggle-reaction-panel"
              data-post-id="${escapeHtml(post.id)}"
              aria-label="${summary.mine.length > 0 ? "Change reactions" : "Open reactions"}"
              title="${summary.mine.length > 0 ? "Manage reactions" : "React"}"
            >
              ${iconReact()}
            </button>
            <div class="reaction-panel">
              ${REACTIONS.map((emoji) => {
                const selected = summary.mine.includes(emoji)
                return `<button class="reaction-emoji ${selected ? "reaction-emoji--active" : ""}" data-action="react" data-post-id="${escapeHtml(
                  post.id,
                )}" data-emoji="${emoji}" aria-label="React with ${emoji}">${emoji}</button>`
              }).join("")}
            </div>
          </div>
          <button
            class="comment-toggle ${isCommentsOpen ? "comment-toggle--active" : ""}"
            data-action="toggle-comments"
            data-post-id="${escapeHtml(post.id)}"
            aria-expanded="${isCommentsOpen ? "true" : "false"}"
          >
            ${iconComment()}
            <span>Comments</span>
            <span class="comments-badge">${comments.length}</span>
          </button>
        </div>
      </div>
      ${renderReactorNames(summary.reactorProfileIds)}
      ${isCommentsOpen ? renderPostComments(post.id, comments) : ""}
    </article>
  `
}

function renderPostsView() {
  const filterLabel = state.feed.filter === "all" ? "All posts" : "My posts"

  return `
    <section class="panel">
      <div class="row row--between">
        <h2 class="panel__title">Posts</h2>
        <div class="row row--tight">
          <button class="chip ${state.feed.filter === "all" ? "chip--active" : ""}" data-action="feed-all">All posts</button>
          <button class="chip ${state.feed.filter === "mine" ? "chip--active" : ""}" data-action="feed-mine">My posts</button>
        </div>
      </div>
      <p class="panel__text">${escapeHtml(filterLabel)} · ${state.feed.all.length} total</p>
      <div class="stack stack--lg">
        ${
          state.feed.visible.length
            ? state.feed.visible.map((post) => renderPostCard(post)).join("")
            : '<p class="muted">No posts yet.</p>'
        }
      </div>
      ${state.feed.loadingMore ? '<p class="muted muted--center">Loading more posts...</p>' : ""}
      ${
        state.feed.hasMore
          ? `<div class="row row--center"><button data-action="load-more">Load more</button></div>`
          : state.feed.all.length > 0
            ? '<p class="muted muted--center">Reached the end.</p>'
            : ""
      }
    </section>
  `
}

function renderPostEditor() {
  const mode = state.postEditor.mode
  const title = mode === "create" ? "Create post" : "Edit post"

  return `
    <section class="panel">
      <h2 class="panel__title">${title}</h2>
      <p class="panel__text">Write something short, add a few images, and publish.</p>
      <form id="post-editor-form" class="stack">
        <label>
          Text
          <textarea name="text" maxlength="${LIMITS.postTextMax}" placeholder="What is happening?">${escapeHtml(
            state.postEditor.text,
          )}</textarea>
        </label>
        <p id="post-text-counter" class="muted counter">${state.postEditor.text.length}/${LIMITS.postTextMax}</p>
        <label>
          Add images (up to ${LIMITS.maxPostImages})
          <input id="post-images-input" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        </label>
        ${
          state.postEditor.images.length
            ? `<div class="gallery">${state.postEditor.images
                .map(
                  (image, index) => `
                    <figure>
                      <img src="${image}" alt="Selected image ${index + 1}" />
                      <button type="button" data-action="remove-editor-image" data-image-index="${index}">Remove</button>
                    </figure>
                  `,
                )
                .join("")}</div>`
            : ""
        }
        <div class="row row--end">
          <button class="primary" type="submit">${mode === "create" ? "Create" : "Save"}</button>
          <button type="button" data-action="cancel-post-editor">Cancel</button>
        </div>
      </form>
    </section>
  `
}

function renderMain() {
  if (!state.currentProfileId) {
    if (state.view !== "create-profile") {
      return renderSignIn()
    }
    return renderCreateProfile()
  }

  if (state.view === "profile") {
    return renderProfileView()
  }

  if (state.view === "post-editor") {
    return renderPostEditor()
  }

  return renderPostsView()
}

function renderFloatingActionButton() {
  if (!state.currentProfileId || state.view === "post-editor") {
    return ""
  }

  return `
    <button class="fab" data-action="goto-new-post" aria-label="Create post">
      ${iconPlus()}
    </button>
  `
}

function render() {
  app.innerHTML = `
    ${renderHeader()}
    ${renderNotice()}
    <main class="main main--${state.view}">${renderMain()}</main>
    ${renderFloatingActionButton()}
  `
}

function syncPostTextCounter() {
  const counter = document.querySelector("#post-text-counter")
  if (counter) {
    counter.textContent = `${state.postEditor.text.length}/${LIMITS.postTextMax}`
  }
}

function isQuotaError(error) {
  return (
    error?.name === "QuotaExceededError" ||
    error?.message?.toLowerCase().includes("quota") ||
    error?.message?.toLowerCase().includes("storage")
  )
}

function handleAppError(error, fallbackMessage) {
  console.error(error)
  if (isQuotaError(error)) {
    setNotice("error", "Storage is full. Remove images or old posts, then try again.")
    return
  }

  setNotice("error", fallbackMessage)
}

async function goToPosts() {
  state.view = "posts"
  state.ui.accountMenuOpen = false
  await refreshFeed({ reset: true })
  render()
}

function attachEvents() {
  app.addEventListener("input", (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.matches("textarea[name='text']") && target instanceof HTMLTextAreaElement) {
      state.postEditor.text = target.value
      syncPostTextCounter()
    }
  })

  app.addEventListener("change", async (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) {
      return
    }

    if (target.id === "create-profile-picture-input") {
      const file = target.files?.[0]
      if (!file) {
        return
      }

      try {
        state.profileCreatePicture = await processImageFile(file)
        render()
      } catch (error) {
        handleAppError(error, "Failed to process profile image.")
      }
      return
    }

    if (target.id === "edit-profile-picture-input") {
      const file = target.files?.[0]
      if (!file) {
        return
      }

      try {
        state.profileEditPicture = await processImageFile(file)
        render()
      } catch (error) {
        handleAppError(error, "Failed to process profile image.")
      }
      return
    }

    if (target.id === "post-images-input") {
      const files = [...(target.files ?? [])]
      if (!files.length) {
        return
      }

      const slots = LIMITS.maxPostImages - state.postEditor.images.length
      if (slots <= 0) {
        setNotice("error", `Only ${LIMITS.maxPostImages} images are allowed.`)
        return
      }

      try {
        const processed = await processImageFiles(files, slots)
        state.postEditor.images = [...state.postEditor.images, ...processed]
        render()
      } catch (error) {
        handleAppError(error, "One or more images could not be processed.")
      }
    }
  })

  app.addEventListener("click", async (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const button = target.closest("button[data-action]")
    if (!button) {
      if (closeOpenOverlays(target)) {
        render()
      }
      return
    }

    const action = button.dataset.action
    const profileId = button.dataset.profileId
    const postId = button.dataset.postId

    closeOpenOverlays(target, {
      ignoreAccount: action === "toggle-account-menu",
      ignoreReaction: action === "toggle-reaction-panel" || action === "react",
    })

    try {
      if (action === "toggle-account-menu") {
        state.ui.accountMenuOpen = !state.ui.accountMenuOpen
        render()
        return
      }

      if (action === "goto-create-profile") {
        state.view = "create-profile"
        state.profileCreatePicture = null
        state.ui.accountMenuOpen = false
        render()
        return
      }

      if (action === "cancel-create-profile") {
        state.view = "signin"
        state.profileCreatePicture = null
        render()
        return
      }

      if (action === "signin" && profileId) {
        signIn(profileId)
        await goToPosts()
        return
      }

      if (action === "goto-posts") {
        state.ui.accountMenuOpen = false
        await goToPosts()
        return
      }

      if (action === "goto-profile") {
        state.view = "profile"
        state.profileEditPicture = null
        state.ui.accountMenuOpen = false
        render()
        return
      }

      if (action === "signout") {
        state.ui.accountMenuOpen = false
        signOut()
        return
      }

      if (action === "delete-profile") {
        const profile = currentProfile()
        if (!profile) {
          return
        }

        if (!window.confirm("Delete your profile and all your posts? This cannot be undone.")) {
          return
        }

        await deleteProfile(profile.id)
        localStorage.removeItem(LAST_PROFILE_KEY)
        await refreshProfiles()
        state.currentProfileId = null
        state.view = "signin"
        state.ui.accountMenuOpen = false
        setNotice("info", "Profile deleted.")
        return
      }

      if (action === "remove-profile-picture") {
        state.profileEditPicture = null
        const profile = currentProfile()
        if (profile) {
          await updateProfile(profile.id, { picture: null })
          await refreshProfiles()
          setNotice("info", "Profile picture removed.")
        }
        render()
        return
      }

      if (action === "goto-new-post") {
        resetEditor()
        state.view = "post-editor"
        state.ui.accountMenuOpen = false
        render()
        return
      }

      if (action === "cancel-post-editor") {
        resetEditor()
        await goToPosts()
        return
      }

      if (action === "remove-editor-image") {
        const index = Number(button.dataset.imageIndex)
        state.postEditor.images = state.postEditor.images.filter((_, i) => i !== index)
        render()
        return
      }

      if (action === "edit-post" && postId) {
        const post = await getPost(postId)
        if (!post || post.authorId !== state.currentProfileId) {
          setNotice("error", "You can edit only your own posts.")
          return
        }

        state.postEditor = {
          mode: "edit",
          postId: post.id,
          text: post.text,
          images: [...post.images],
        }
        state.view = "post-editor"
        render()
        return
      }

      if (action === "delete-post" && postId) {
        const post = await getPost(postId)
        if (!post || post.authorId !== state.currentProfileId) {
          setNotice("error", "You can delete only your own posts.")
          return
        }

        if (!window.confirm("Delete this post?")) {
          return
        }

        await deletePost(postId)
        await refreshFeed({ reset: true })
        setNotice("info", "Post deleted.")
        render()
        return
      }

      if (action === "react" && postId && button.dataset.emoji) {
        await toggleReaction({
          postId,
          profileId: state.currentProfileId,
          emoji: button.dataset.emoji,
        })
        const summary = await getReactionSummary(postId, state.currentProfileId)
        state.feed.reactionByPostId.set(postId, summary)
        state.feed.openReactionPostId = null
        render()
        return
      }

      if (action === "toggle-reaction-panel" && postId) {
        state.feed.openReactionPostId = state.feed.openReactionPostId === postId ? null : postId
        render()
        return
      }

      if (action === "toggle-comments" && postId) {
        state.feed.openCommentsPostId = state.feed.openCommentsPostId === postId ? null : postId
        render()
        return
      }

      if (action === "feed-all") {
        state.feed.filter = "all"
        await refreshFeed({ reset: true })
        render()
        return
      }

      if (action === "feed-mine") {
        state.feed.filter = "mine"
        await refreshFeed({ reset: true })
        render()
        return
      }

      if (action === "load-more") {
        if (!state.feed.hasMore || state.feed.loadingMore) {
          return
        }

        state.feed.loadingMore = true
        render()
        await appendFeedBatch()
        state.feed.loadingMore = false
        render()
      }
    } catch (error) {
      handleAppError(error, "Action failed. Please try again.")
    }
  })

  app.addEventListener("submit", async (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) {
      return
    }

    event.preventDefault()

    try {
      if (form.id === "create-profile-form") {
        const values = new FormData(form)
        const validated = validateProfile({
          name: String(values.get("name") ?? ""),
          location: String(values.get("location") ?? ""),
          description: String(values.get("description") ?? ""),
          picture: state.profileCreatePicture,
        })

        if (!validated.valid) {
          setNotice("error", validated.errors.join(" "))
          return
        }

        const profile = await createProfile(validated.value)
        await refreshProfiles()
        state.profileCreatePicture = null
        signIn(profile.id)
        setNotice("info", "Profile created.")
        await goToPosts()
        return
      }

      if (form.id === "edit-profile-form") {
        const profile = currentProfile()
        if (!profile) {
          return
        }

        const values = new FormData(form)
        const validated = validateProfile({
          name: String(values.get("name") ?? ""),
          location: String(values.get("location") ?? ""),
          description: String(values.get("description") ?? ""),
          picture: state.profileEditPicture ?? profile.picture,
        })

        if (!validated.valid) {
          setNotice("error", validated.errors.join(" "))
          return
        }

        await updateProfile(profile.id, validated.value)
        await refreshProfiles()
        state.profileEditPicture = null
        setNotice("info", "Profile updated.")
        render()
        return
      }

      if (form.dataset.action === "create-comment" && form.dataset.postId) {
        const postId = form.dataset.postId
        const values = new FormData(form)
        const validated = validateCommentInput({
          text: String(values.get("commentText") ?? ""),
        })

        if (!validated.valid) {
          setNotice("error", validated.errors.join(" "))
          return
        }

        await createComment({
          postId,
          authorId: state.currentProfileId,
          text: validated.value.text,
        })
        const comments = await listCommentsByPostId(postId)
        state.feed.commentsByPostId.set(postId, comments)
        form.reset()
        render()
        return
      }

      if (form.id === "post-editor-form") {
        const validated = validatePostInput({
          text: state.postEditor.text,
          images: state.postEditor.images,
        })

        if (!validated.valid) {
          setNotice("error", validated.errors.join(" "))
          return
        }

        if (state.postEditor.mode === "create") {
          await createPost({
            authorId: state.currentProfileId,
            text: validated.value.text,
            images: validated.value.images,
          })
          setNotice("info", "Post created.")
        } else if (state.postEditor.postId) {
          const post = await getPost(state.postEditor.postId)
          if (!post || post.authorId !== state.currentProfileId) {
            setNotice("error", "You can edit only your own posts.")
            return
          }

          await updatePost(state.postEditor.postId, {
            text: validated.value.text,
            images: validated.value.images,
          })
          setNotice("info", "Post updated.")
        }

        resetEditor()
        await goToPosts()
      }
    } catch (error) {
      handleAppError(error, "Submit failed. Please try again.")
    }
  })

  window.addEventListener("scroll", async () => {
    if (
      state.view !== "posts" ||
      !state.currentProfileId ||
      !state.feed.hasMore ||
      state.feed.loadingMore
    ) {
      return
    }

    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - LIMITS.scrollThresholdPx

    if (!nearBottom) {
      return
    }

    state.feed.loadingMore = true
    render()
    await appendFeedBatch()
    state.feed.loadingMore = false
    render()
  })
}

async function bootstrap() {
  state.config = await loadConfig()
  document.title = `${state.config.platformIcon} ${state.config.platformName}`
  await refreshProfiles()
  const rememberedProfileId = localStorage.getItem(LAST_PROFILE_KEY)

  if (rememberedProfileId && state.profileMap.has(rememberedProfileId)) {
    state.currentProfileId = rememberedProfileId
    state.view = "posts"
    await refreshFeed({ reset: true })
  } else if (rememberedProfileId) {
    localStorage.removeItem(LAST_PROFILE_KEY)
  }

  attachEvents()
  render()
}

bootstrap().catch((error) => {
  console.error(error)
  app.innerHTML = `<main><section class="panel"><h2>Unable to start app</h2><p>${escapeHtml(
    error.message || "Unknown startup error",
  )}</p></section></main>`
})
