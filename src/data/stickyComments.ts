import {RedisClient} from "@devvit/public-api";
import {isCommentId} from "@devvit/shared-types/tid.js";

export const resultStickyMap = "resultStickyMap";
export const stickyPostMap = "stickyPostMap";

export async function setResultComment (redis: RedisClient, commentId: string, stickyId: string): Promise<void> {
    await redis.hSet(resultStickyMap, {[commentId]: stickyId});
}

export async function getResultComment (redis: RedisClient, commentId: string): Promise<string | undefined> {
    const result = await redis.hGet(resultStickyMap, commentId);
    if (!!result && !isCommentId(result)) {
        console.warn(`Invalid result comment parent: ${commentId} with value ${result}`);
    }
    return result;
}

export async function setPostStickyComment (redis: RedisClient, postId: string, stickyId: string): Promise<void> {
    await redis.hSet(stickyPostMap, {[postId]: stickyId});
}

export async function getPostStickyComment (redis: RedisClient, postId: string): Promise<string | undefined> {
    const result = await redis.hGet(stickyPostMap, postId);
    if (!!result && !isCommentId(result)) {
        console.warn(`Invalid sticky comment parent: ${postId} with value ${result}`);
    }
    return result;
}

export async function delPostStickyComment (redis: RedisClient, postId: string): Promise<void> {
    await redis.hDel(stickyPostMap, [postId]);
}
