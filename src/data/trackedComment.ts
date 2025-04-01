import {Comment, RedisClient} from "@devvit/public-api";
import {isCommentId, isLinkId} from "@devvit/shared-types/tid.js";
import {zScanAll} from "devvit-helpers";
import {AppSettings} from "../settings.js";

const commentsKey = "trackedComments";

export type TrackedComments = {
    [commentId: string]: [score: number];
}

export function isTrackableComment (comment: Comment, appSettings: AppSettings): boolean {
    if (!appSettings.enabled) {
        return false;
    }
    if (comment.body.startsWith(appSettings.commentPrefix)) {
        return true;
    }
    if (comment.parentId) {
        return false; // We only care about top level comments.
    }
    if (!isLinkId(comment.postId)) {
        return false;
    }
    return false;
}

export async function trackComment (redis: RedisClient, postId: string, commentId: string, commentScore: number): Promise<void> {
    await redis.zAdd(commentsKey, {
        member: `${postId}:${commentId}`,
        score: commentScore,
    });
}

export async function untrackComment (redis: RedisClient, postId: string, commentId: string): Promise<void> {
    await redis.zRem(commentsKey, [`${postId}:${commentId}`]);
}

export async function trackComments (redis: RedisClient, postId: string, comments: TrackedComments): Promise<void> {
    const entries = Object.entries(comments).map(([commentId, [score]]) => ({
        member: `${postId}:${commentId}`,
        score,
    }));
    await redis.zAdd(commentsKey, ...entries);
}

export async function getTrackedComments (redis: RedisClient, postId: string): Promise<TrackedComments> {
    const trackedComments = await zScanAll(redis, commentsKey, `${postId}:*`);
    const comments: TrackedComments = {};
    for (const entry of trackedComments) {
        const [postId, commentId] = entry.member.split(":");
        if (!isLinkId(postId) || !isCommentId(commentId)) {
            console.warn(`Invalid tracked comment: ${entry.member} with score ${entry.score}`);
            continue;
        }
        comments[commentId] = [entry.score];
    }
    return comments;
}
