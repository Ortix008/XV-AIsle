"use client";

import { useState } from "react";
import { BotControls } from "@/components/desk-shell";
import { CopyButton, EmptyNote, PageHeader, Tone } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProduct } from "@/lib/catalog";
import { useDesk } from "@/lib/desk-store";
import type { Post } from "@/lib/types";
import { cn } from "cn";

export function MarketingView() {
  const { state, select, setPostStatus, writeCampaign } = useDesk();
  const ready = state.listings.filter((listing) => listing.status === "ready");
  const selectedId =
    ready.find((listing) => listing.productId === state.selected.marketing)?.productId ??
    ready[0]?.productId;
  const campaign = state.campaigns.find((item) => item.productId === selectedId);

  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        kicker="Cast"
        title="Social posts"
        lede="Cast drafts posts you can copy. Share your shop link anywhere. Saying yes does not publish them."
        actions={<BotControls id="marketing" />}
      />
      {ready.length === 0 ? (
        <EmptyNote
          title="No ready listings."
          body="Mark a page ready first. Cast does not write for a page you have not finished."
        />
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden">
          <ul className="border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
            {ready.map((listing) => {
              const product = getProduct(listing.productId);
              const posts = state.campaigns.find((item) => item.productId === listing.productId);
              const pending = posts?.posts.filter((post) => post.status === "draft").length;
              const active = listing.productId === selectedId;
              return (
                <li key={listing.productId} className="border-b">
                  <button
                    type="button"
                    onClick={() => select("marketing", listing.productId)}
                    className={cn(
                      "flex w-full flex-col items-start px-4 py-3 text-left",
                      active ? "bg-muted/70" : "hover:bg-muted/40",
                    )}
                  >
                    <span className="text-sm font-medium">{product.titleLead}</span>
                    <span className="text-xs text-muted-foreground">
                      {posts ? (pending ? `${pending} waiting` : "Ready to post") : "Not written yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0 lg:overflow-y-auto">
            {selectedId && campaign ? (
              <CampaignPanel
                productId={selectedId}
                posts={campaign.posts}
                onStatus={(postId, status) => setPostStatus(selectedId, postId, status)}
              />
            ) : selectedId ? (
              <EmptyNote
                title="No posts yet."
                body="Ask Cast to write the posts, or write them now. The words use the page you marked ready, including how fast it ships."
                action={
                  <Button type="button" onClick={() => writeCampaign(selectedId)}>
                    Write posts
                  </Button>
                }
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignPanel({
  productId,
  posts,
  onStatus,
}: {
  productId: string;
  posts: Post[];
  onStatus: (postId: string, status: Post["status"]) => void;
}) {
  const product = getProduct(productId);
  const [channel, setChannel] = useState(posts[0]?.channel ?? "Meta");
  const current = posts.find((post) => post.channel === channel) ?? posts[0];

  return (
    <div className="px-4 py-5 sm:px-6">
      <h2 className="text-lg font-semibold tracking-tight">{product.titleLead}</h2>
      <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">{product.trend.evidence}</p>
      <Tabs value={channel} onValueChange={(value) => setChannel(value as Post["channel"])} className="mt-4">
        <TabsList variant="line">
          {posts.map((post) => (
            <TabsTrigger key={post.id} value={post.channel}>
              {post.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {current ? (
          <TabsContent value={current.channel} className="mt-4">
            <PostBlock post={current} onStatus={(status) => onStatus(current.id, status)} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function PostBlock({
  post,
  onStatus,
}: {
  post: Post;
  onStatus: (status: Post["status"]) => void;
}) {
  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{post.label}</p>
        {post.status === "approved" ? <Tone tone="ok">Approved</Tone> : <Tone tone="warn">Draft</Tone>}
      </div>
      <h3 className="mt-3 text-balance text-base font-semibold">{post.headline}</h3>
      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{post.body}</pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={`${post.headline}\n\n${post.body}`} label="Copy post" />
        {post.status === "draft" ? (
          <Button type="button" onClick={() => onStatus("approved")}>
            Approve post
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => onStatus("draft")}>
            Return to draft
          </Button>
        )}
      </div>
    </article>
  );
}
