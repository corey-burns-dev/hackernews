"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "https://hacker-news.firebaseio.com/v0";
const MAX_FRONT_PAGE_STORIES = 30;
const FETCH_CHUNK_SIZE = 15;
const MAX_COMMENT_DEPTH = 5;
const MAX_CHILDREN_PER_LEVEL = 10;

type Section =
  | "top"
  | "new"
  | "past"
  | "comments"
  | "ask"
  | "show"
  | "jobs"
  | "submit";

type HNItem = {
  id: number;
  type?: "story" | "comment" | "job" | "poll" | "pollopt";
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number;
  parent?: number;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
};

type HNCommentNode = HNItem & {
  children: HNCommentNode[];
};

type LoadState = "idle" | "loading" | "ready" | "error";

const TAB_LINKS: Array<{ id: Exclude<Section, "top">; label: string }> = [
  { id: "new", label: "new" },
  { id: "past", label: "past" },
  { id: "comments", label: "comments" },
  { id: "ask", label: "ask" },
  { id: "show", label: "show" },
  { id: "jobs", label: "jobs" },
  { id: "submit", label: "submit" },
];

function sectionPath(section: Section): string {
  return section === "top" ? "/" : `/?section=${section}`;
}

function normalizeSection(value: string | null | undefined): Section {
  if (
    value === "new" ||
    value === "past" ||
    value === "comments" ||
    value === "ask" ||
    value === "show" ||
    value === "jobs" ||
    value === "submit"
  ) {
    return value;
  }
  return "top";
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function fetchItemById(
  id: number,
  signal: AbortSignal,
): Promise<HNItem | null> {
  const item = await fetchJson<HNItem | null>(
    `${API_BASE}/item/${id}.json`,
    signal,
  );
  if (!item || typeof item.id !== "number") return null;
  return item;
}

function formatRelativeAge(unixTimeSeconds?: number): string {
  if (!unixTimeSeconds) return "unknown";
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, nowSeconds - unixTimeSeconds);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDomain(url?: string): string {
  if (!url) return "news.ycombinator.com";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}

function toPlainText(value?: string): string {
  if (!value) return "";

  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(value, "text/html");
    const text =
      (doc.body as HTMLElement).innerText || doc.body.textContent || "";
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchItemsByIds(
  ids: number[],
  signal: AbortSignal,
): Promise<HNItem[]> {
  const items: HNItem[] = [];
  for (
    let startIndex = 0;
    startIndex < ids.length && items.length < MAX_FRONT_PAGE_STORIES;
    startIndex += FETCH_CHUNK_SIZE
  ) {
    const chunk = ids.slice(startIndex, startIndex + FETCH_CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((id) => fetchItemById(id, signal).catch(() => null)),
    );
    for (const item of results) {
      if (!item || item.deleted || item.dead) continue;
      items.push(item);
      if (items.length === MAX_FRONT_PAGE_STORIES) break;
    }
  }
  return items;
}

async function fetchStoryIds(
  section: Section,
  signal: AbortSignal,
): Promise<number[]> {
  if (section === "submit") return [];

  if (section === "comments") {
    const updates = await fetchJson<{ items?: number[] }>(
      `${API_BASE}/updates.json`,
      signal,
    );
    return (updates.items ?? []).filter(
      (id): id is number => typeof id === "number",
    );
  }

  const endpoint =
    section === "new"
      ? "newstories"
      : section === "ask"
        ? "askstories"
        : section === "show"
          ? "showstories"
          : section === "jobs"
            ? "jobstories"
            : "topstories";

  const storyIds = await fetchJson<number[]>(
    `${API_BASE}/${endpoint}.json`,
    signal,
  );
  return storyIds.filter((id): id is number => typeof id === "number");
}

async function buildCommentTree(
  ids: number[],
  signal: AbortSignal,
  depth = 0,
): Promise<HNCommentNode[]> {
  if (depth >= MAX_COMMENT_DEPTH || ids.length === 0) return [];
  const limitedIds = ids.slice(0, MAX_CHILDREN_PER_LEVEL);
  const results = await Promise.all(
    limitedIds.map((id) => fetchItemById(id, signal).catch(() => null)),
  );

  const nodes: HNCommentNode[] = [];
  for (const item of results) {
    if (!item || item.type !== "comment" || item.dead || item.deleted) continue;
    const children = await buildCommentTree(item.kids ?? [], signal, depth + 1);
    nodes.push({ ...item, children });
  }
  return nodes;
}

function FeedNav({ activeSection }: { activeSection: Section }) {
  return (
    <div className="flex flex-wrap gap-2 p-3 border rounded-3xl border-white/15 bg-slate-950/45 backdrop-blur">
      <Link
        href="/"
        className="rounded-full border border-cyan-100/30 bg-cyan-300/8 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/20"
      >
        home
      </Link>
      {TAB_LINKS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <Link
            key={item.id}
            href={sectionPath(item.id)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
              isActive
                ? "border-cyan-100/60 bg-cyan-300/25 text-cyan-50"
                : "border-cyan-100/30 bg-cyan-300/8 text-cyan-100 hover:bg-cyan-300/20"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function FeedView({ section }: { section: Section }) {
  const router = useRouter();
  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<HNItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [nextFetchIndex, setNextFetchIndex] = useState(MAX_FRONT_PAGE_STORIES);
  const requestRef = useRef<AbortController | null>(null);

  // Constants
  const PAGE_SIZE = 30;

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let isActive = true;

    const run = async () => {
      if (isActive) {
        setLoadState("loading");
        setErrorMessage("");
        setItems([]);
        setIds([]);
      }

      if (section === "submit") {
        if (!isActive) return;
        setLoadState("ready");
        return;
      }

      try {
        const allIds = await fetchStoryIds(section, controller.signal);
        if (!isActive || controller.signal.aborted) return;
        setIds(allIds);

        const startIndex = section === "past" ? MAX_FRONT_PAGE_STORIES : 0;
        const initialChunk = allIds.slice(startIndex, startIndex + PAGE_SIZE);

        // Update next index for pagination
        setNextFetchIndex(startIndex + PAGE_SIZE);

        const initialItems = await fetchItemsByIds(
          initialChunk,
          controller.signal,
        );
        if (!isActive || controller.signal.aborted) return;

        const filteredItems = initialItems.filter((item) => {
          if (!item || item.dead || item.deleted) return false;
          if (section === "jobs") return item.type === "job";
          if (section === "comments")
            return item.type === "comment" && !!item.text;
          return item.type === "story" || item.type === "poll";
        });

        setItems(filteredItems);
        setLoadState("ready");
      } catch (error: unknown) {
        if (!isActive || controller.signal.aborted) return;
        setItems([]);
        setLoadState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load Hacker News feed.",
        );
      }
    };

    void run();

    return () => {
      isActive = false;
      controller.abort();
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [section]);

  const handleRefresh = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadState("loading");
    setErrorMessage("");

    if (section === "submit") {
      setLoadState("ready");
      return;
    }

    try {
      const allIds = await fetchStoryIds(section, controller.signal);
      if (controller.signal.aborted) return;
      setIds(allIds);

      const startIndex = section === "past" ? MAX_FRONT_PAGE_STORIES : 0;
      const initialChunk = allIds.slice(startIndex, startIndex + PAGE_SIZE);
      setNextFetchIndex(startIndex + PAGE_SIZE);

      const nextItems = await fetchItemsByIds(initialChunk, controller.signal);
      if (controller.signal.aborted) return;

      const filteredItems = nextItems.filter((item) => {
        if (!item || item.dead || item.deleted) return false;
        if (section === "jobs") return item.type === "job";
        if (section === "comments")
          return item.type === "comment" && !!item.text;
        return item.type === "story" || item.type === "poll";
      });

      setItems(filteredItems);
      setLoadState("ready");
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setLoadState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to refresh Hacker News feed.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  };

  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (loadingMore || ids.length === 0 || nextFetchIndex >= ids.length) return;
    setLoadingMore(true);

    try {
      const chunk = ids.slice(nextFetchIndex, nextFetchIndex + PAGE_SIZE);
      if (chunk.length === 0) {
        setLoadingMore(false);
        return;
      }

      const tempController = new AbortController();
      const newItems = await fetchItemsByIds(chunk, tempController.signal);

      const filteredNewItems = newItems.filter((item) => {
        if (!item || item.dead || item.deleted) return false;
        if (section === "jobs") return item.type === "job";
        if (section === "comments")
          return item.type === "comment" && !!item.text;
        return item.type === "story" || item.type === "poll";
      });

      setItems((prev) => [...prev, ...filteredNewItems]);
      setNextFetchIndex((prev) => prev + PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more items", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const statusCopy = useMemo(() => {
    if (section === "submit") return "Submit mode";
    if (loadState === "loading") return "Syncing feed...";
    if (loadState === "error") return "Signal lost";
    return `${items.length} stories loaded`;
  }, [items.length, loadState, section]);

  const hasMore = ids.length > 0 && nextFetchIndex < ids.length;

  return (
    <section className="grid gap-6">
      <FeedNav activeSection={section} />

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border rounded-3xl border-cyan-100/20 bg-slate-950/55 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
            Realtime Feed
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-cyan-50">
            {section === "top" ? "Front Page" : `${section}`}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300/80">
            {statusCopy}
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loadState === "loading" || section === "submit"}
            className="rounded-full border border-cyan-100/30 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </div>

      {section === "submit" ? (
        <div className="p-5 border rounded-2xl border-white/20 bg-slate-900/55 backdrop-blur-md">
          <h4 className="text-lg font-semibold text-white">
            Submit to HN Afterglow
          </h4>
          <p className="mt-2 text-sm text-slate-300">
            This is the local submit page placeholder for your clone. We can
            wire storage next.
          </p>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="p-5 text-sm border rounded-2xl border-rose-200/30 bg-rose-900/20 text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <ol className="space-y-3 overflow-anchor-none">
        {items.map((item, index) => {
          const isComment = item.type === "comment";
          const title = isComment
            ? `Comment by ${item.by ?? "unknown"}`
            : (item.title ?? "Untitled story");
          const snippet = isComment ? toPlainText(item.text).slice(0, 180) : "";
          const detailPath = `/?post=${item.id}&from=${section}`;
          const externalUrl = item.url;
          const rank =
            section === "past" ? index + 1 + MAX_FRONT_PAGE_STORIES : index + 1;

          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: (index % 30) * 0.015 }}
              onClick={() => router.push(detailPath)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(detailPath);
                }
              }}
              role="button"
              tabIndex={0}
              className="p-4 border cursor-pointer rounded-2xl border-white/15 bg-slate-900/55 backdrop-blur-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                    #{rank} · {getDomain(item.url)}
                  </p>
                  {externalUrl ? (
                    <a
                      href={externalUrl}
                      onClick={(event) => event.stopPropagation()}
                      className="text-lg font-semibold text-white hover:text-cyan-100 hover:underline"
                    >
                      {title}
                    </a>
                  ) : (
                    <h4 className="text-lg font-semibold text-white">
                      {title}
                    </h4>
                  )}
                  {snippet ? (
                    <p className="mt-2 text-sm text-slate-300/85">{snippet}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-300/85">
                    {item.score ?? 0} points by {item.by ?? "unknown"} ·{" "}
                    {formatRelativeAge(item.time)}
                  </p>
                </div>
                <Link
                  href={detailPath}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-100 hover:bg-white/15"
                >
                  {isComment
                    ? "view thread"
                    : `${item.descendants ?? 0} comments`}
                </Link>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {loadState === "ready" && hasMore ? (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
            className="rounded-full border border-cyan-100/30 bg-cyan-300/10 px-8 py-3 text-sm uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Stories"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CommentSkeleton() {
  return (
    <div className="box-border w-full min-w-0 p-4 border animate-pulse rounded-xl border-white/10 bg-slate-900/40 backdrop-blur-md">
      <div className="h-3 w-32 rounded-full bg-white/10 mb-3" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded-full bg-white/5" />
        <div className="h-4 w-5/6 rounded-full bg-white/5" />
      </div>
    </div>
  );
}

function CommentTree({
  node,
  depth = 0,
}: {
  node: HNCommentNode;
  depth?: number;
}) {
  const commentText = toPlainText(node.text);
  const indent = Math.min(depth * 10, 28);
  return (
    <div
      className="box-border w-full min-w-0 p-4 border rounded-xl border-white/20 bg-slate-900/80 backdrop-blur-md"
      style={{ marginLeft: `${indent}px` }}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/85">
        {node.by ?? "unknown"} · {formatRelativeAge(node.time)}
      </p>
      <p className="mt-2 w-full min-w-0 text-base leading-relaxed text-slate-100/95 wrap-break-word whitespace-pre-wrap">
        {commentText}
      </p>
      {node.children.length > 0 ? (
        <div className="min-w-0 mt-3 space-y-3">
          {node.children.map((child) => (
            <CommentTree key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PostView({
  postId,
  fromSection,
}: {
  postId: number;
  fromSection: Section;
}) {
  const [item, setItem] = useState<HNItem | null>(null);
  const [comments, setComments] = useState<HNCommentNode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void fetchItemById(postId, controller.signal)
      .then(async (nextItem) => {
        if (!nextItem) throw new Error("Post not found.");
        setItem(nextItem);
        const nextComments = await buildCommentTree(
          nextItem.kids ?? [],
          controller.signal,
        );
        setComments(nextComments);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setItem(null);
        setComments([]);
        setLoadState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load post details.",
        );
      });

    return () => controller.abort();
  }, [postId]);

  const backPath = sectionPath(fromSection);
  const storyUrl = item?.url;
  const scrollToComments = () => {
    const commentsElement = document.getElementById("comments");
    commentsElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="grid gap-6">
      <FeedNav activeSection={fromSection} />

      <div className="px-6 py-5 border rounded-3xl border-cyan-100/20 bg-slate-950/55 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-cyan-50">Post</h3>
          <Link
            href={backPath}
            className="rounded-full border border-cyan-100/30 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-300/20"
          >
            Back to {fromSection}
          </Link>
        </div>
      </div>

      {loadState === "error" ? (
        <div className="p-5 text-sm border rounded-2xl border-rose-200/30 bg-rose-900/20 text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      {item ? (
        <article className="p-6 border rounded-2xl border-white/15 bg-slate-900/55 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
            {item.score ?? 0} points by {item.by ?? "unknown"} ·{" "}
            {formatRelativeAge(item.time)}
          </p>
          <button
            type="button"
            onClick={scrollToComments}
            className="mt-3 rounded-full border border-cyan-100/30 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Jump to comments
          </button>
          {storyUrl ? (
            <a
              href={storyUrl}
              className="block mt-2 text-3xl font-semibold text-white hover:text-cyan-100 hover:underline"
            >
              {item.title ?? `Thread #${item.id}`}
            </a>
          ) : (
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {item.title ?? `Thread #${item.id}`}
            </h1>
          )}
          {item.text ? (
            <p className="w-full min-w-0 mt-4 text-lg leading-relaxed whitespace-pre-wrap text-slate-200/90 wrap-break-word">
              {toPlainText(item.text)}
            </p>
          ) : null}
        </article>
      ) : loadState === "loading" ? (
        <div className="p-5 text-sm border rounded-2xl border-white/15 bg-slate-900/55 text-slate-200">
          Loading post...
        </div>
      ) : null}

      <section id="comments" className="min-w-0 space-y-3">
        <h2 className="text-xl font-semibold text-white">Comments</h2>
        {loadState === "loading" || loadState === "idle" ? (
          <div className="space-y-3">
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton />
          </div>
        ) : comments.length === 0 ? (
          <div className="p-4 text-sm border rounded-2xl border-white/15 bg-slate-900/55 text-slate-300">
            No comments yet.
          </div>
        ) : (
          comments.map((comment) => (
            <CommentTree key={comment.id} node={comment} />
          ))
        )}
      </section>
    </section>
  );
}

export default function HackerNewsFrontPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020306]" />}>
      <HackerNewsFrontPageInner />
    </Suspense>
  );
}

function HackerNewsFrontPageInner() {
  const searchParams = useSearchParams();
  const section = normalizeSection(searchParams.get("section"));
  const postId = searchParams.get("post");
  const fromSection = normalizeSection(searchParams.get("from"));

  if (postId) {
    const numericPostId = Number.parseInt(postId, 10);
    if (Number.isNaN(numericPostId)) {
      return <PostView key={0} postId={0} fromSection={fromSection} />;
    }
    return (
      <PostView
        key={numericPostId}
        postId={numericPostId}
        fromSection={fromSection}
      />
    );
  }

  return <FeedView section={section} />;
}
