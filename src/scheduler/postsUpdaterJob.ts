import {Comment, Devvit, Post, RedditAPIClient, RedisClient, ScheduledJobEvent, TriggerContext} from "@devvit/public-api";
import {delPostStickyComment, getPostStickyComment, setPostStickyComment, setResultComment} from "../data/stickyComments.js";
import {getFinishedPosts, getTrackedPosts, setFinishedPost} from "../data/trackedPost.js";
import {AppSettings, getAppSettings} from "../settings.js";
import {getTrackedComments} from "../data/trackedComment.js";
import {safeDeleteComment, safeDistinguishComment, safeLockComment} from "../utils/safeRedditAPI.js";

export const postUpdaterJobName = "postsUpdaterJob";

export async function addOrUpdateStickiedComment (reddit: RedditAPIClient, redis: RedisClient, postId: string, commentBody: string): Promise<Comment> {
    const existingCommentId = await getPostStickyComment(redis, postId);
    if (existingCommentId) {
        try {
            const comment = await reddit.getCommentById(existingCommentId);
            if (comment) {
                await comment.edit({text: commentBody});
                await comment.approve();
                await safeDistinguishComment(comment, true);
                await safeLockComment(comment);
                console.log("Updated stickied comment", existingCommentId);
                return comment; // Sticky updated, no need to create a new one.
            }
        } catch (e) {
            console.error("Failed to update stickied comment", e);
            await delPostStickyComment(redis, postId);
            await safeDeleteComment(reddit, existingCommentId);
        }
    }

    const newComment = await reddit.submitComment({
        id: postId,
        text: commentBody,
    });
    await setPostStickyComment(redis, postId, newComment.id);
    await safeDistinguishComment(newComment, true);
    await safeLockComment(newComment);
    console.log("Created new stickied comment", newComment.id);
    return newComment;
}

export function getWinnerText (comment: Comment, appSettings: AppSettings): string {
    const quotedBody = `\n${comment.body}`.replace(/\n/g, "\n> ");
    const newCommentBody = appSettings.stickyTemplate.replace(/{{author}}/g, comment.authorName).replace(/{{permalink}}/g, comment.permalink).replace(/{{body}}/g, quotedBody);
    return newCommentBody;
}

export async function updatePostResult ({reddit, redis}: TriggerContext, post: Post, appSettings: AppSettings) {
    const trackedComments = await getTrackedComments(redis, post.id);
    const comments = await Promise.all(Object.keys(trackedComments).map(async commentId => {
        try {
            const comment = await reddit.getCommentById(commentId);
            if (comment) {
                return comment;
            }
        } catch (e) {
            console.error("Failed to fetch comment", e);
        }
    }));

    let highestScoreComment: Comment | null = null;
    for (const comment of comments) {
        if (!comment) {
            continue;
        }

        if (comment.isRemoved() || comment.isSpam() || comment.removed || !comment.authorId || !comment.body.startsWith(appSettings.commentPrefix)) {
            continue; // Skip removed, deleted, invalid comments
        }

        if (!appSettings.allowOp && comment.authorId === post.authorId) {
            continue; // Skip OP comments
        }

        if (!highestScoreComment) {
            highestScoreComment = comment;
            continue;
        }

        if (comment.score > highestScoreComment.score) {
            highestScoreComment = comment;
        }
    }

    if (!highestScoreComment) {
        console.log("No valid comments found for post", post.id);
        return;
    }

    // Replace every \n with \n>\s
    const resultComment = await addOrUpdateStickiedComment(reddit, redis, post.id, getWinnerText(highestScoreComment, appSettings));
    await setResultComment(redis, highestScoreComment.id, resultComment.id);
    await setFinishedPost(redis, post.id, highestScoreComment.id);
}

export async function onPostsUpdaterJob (event: ScheduledJobEvent<undefined>, context: TriggerContext) {
    const appSettings = await getAppSettings(context.settings);
    if (!appSettings.enabled) {
        return;
    }

    const minCutoff = 0;
    const maxCutoff = Date.now() - appSettings.stickyMinutes * 60 * 1000;

    const postIds = await getTrackedPosts(context.redis, minCutoff, maxCutoff);
    if (!Object.keys(postIds).length) {
        console.log("No tracked posts in fetched range found");
        return;
    }

    const finishedPosts = await getFinishedPosts(context.redis);

    for (const postId of Object.keys(postIds)) {
        try {
            if (finishedPosts.includes(postId)) {
                continue; // Skip already finished posts
            }
            await updatePostResult(context, await context.reddit.getPostById(postId), appSettings);
        } catch (e) {
            console.error("Failed to update post", e);
            continue;
        }
    }
}

export const postsUpdaterJob = Devvit.addSchedulerJob({
    name: postUpdaterJobName,
    onRun: onPostsUpdaterJob,
});

