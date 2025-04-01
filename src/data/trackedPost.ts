import {Post, RedisClient} from "@devvit/public-api";
import {AppSettings} from "../settings.js";
import {isCommentId} from "@devvit/shared-types/tid.js";

const postsKey = "trackedPosts";
const finishedPostsKey = "finishedPosts";

export function isTrackablePost (post: Post, appSettings: AppSettings): boolean {
    if (!appSettings.enabled || !appSettings.trackNewPosts) {
        return false;
    }
    if (post.title.startsWith(appSettings.postPrefix)) {
        return true;
    }
    return false;
}

export async function trackPost (redis: RedisClient, postId: string, created: Date) {
    await redis.zAdd(postsKey, {member: postId, score: created.getTime()});
}

export async function untrackPost (redis: RedisClient, postId: string) {
    await redis.zRem(postsKey, [postId]);
}

export async function getTrackedPosts (redis: RedisClient, minScore: number, maxScore: number): Promise<Record<string, number>> {
    const zRangeResult = await redis.zRange(postsKey, minScore, maxScore, {by: "score"});
    const trackedPosts: Record<string, number> = {};
    for (const post of zRangeResult) {
        const postId = post.member;
        const postTimestamp = post.score;
        trackedPosts[postId] = postTimestamp;
    }
    return trackedPosts;
}

export async function isTrackedPost (redis: RedisClient, postId: string): Promise<boolean> {
    const post = await redis.zScore(postsKey, postId);
    return !!post;
}

export async function setCutoffTime (redis: RedisClient, cutoffTime: Date): Promise<void> {
    await redis.set("cutoffTime", cutoffTime.getTime().toString());
}

export async function getCutoffTime (redis: RedisClient): Promise<Date> {
    const cutoffTime = await redis.get("cutoffTime");
    if (!cutoffTime) {
        console.warn("Cutoff time not set, returning current time");
        return new Date();
    }
    return new Date(parseInt(cutoffTime));
}

export async function setFinishedPost (redis: RedisClient, postId: string, winnerId: string): Promise<void> {
    await redis.hSet(finishedPostsKey, {
        [postId]: winnerId,
    });
}

export async function getFinishedPosts (redis: RedisClient): Promise<string[]> {
    const finishedPosts = await redis.hGetAll(finishedPostsKey);
    return Object.keys(finishedPosts);
}

export async function deleteFinishedPost (redis: RedisClient, postId: string): Promise<void> {
    await redis.hDel(finishedPostsKey, [postId]);
}

export async function getFinishedPostWinner (redis: RedisClient, postId: string): Promise<string | undefined> {
    const finishedPostWinner = await redis.hGet(finishedPostsKey, postId);
    if (!!finishedPostWinner && !isCommentId(finishedPostWinner)) {
        console.warn(`Invalid finished post winner: ${postId} with value ${finishedPostWinner}`);
        return;
    }
    return finishedPostWinner;
}
