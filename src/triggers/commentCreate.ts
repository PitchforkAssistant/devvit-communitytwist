import {CommentCreate} from "@devvit/protos";
import {Comment, Devvit, RedditAPIClient, RedisClient, TriggerContext} from "@devvit/public-api";
import {AppSettings, getAppSettings} from "../settings.js";
import {isTrackableComment, trackComment} from "../data/trackedComment.js";
import {deleteFinishedPost, getFinishedPostWinner} from "../data/trackedPost.js";
import {setVote} from "devvit-helpers";

export async function evaluateNewComment (reddit: RedditAPIClient, redis: RedisClient, comment: Comment, appSettings: AppSettings) {
    // This is a placeholder function to evaluate the new comment.
    // You can implement your logic here to process the comment.
    const appAccount = await reddit.getAppUser();
    if (appAccount.id === comment.authorId) {
        return;
    }

    if (isTrackableComment(comment, appSettings)) {
        console.log("Tracking comment ", comment.id);
        await trackComment(redis, comment.parentId, comment.id, comment.score);
        const winnerId = await getFinishedPostWinner(redis, comment.parentId);
        if (winnerId && winnerId !== comment.id) {
            const winnerComment = await reddit.getCommentById(winnerId);
            if (winnerComment.score < comment.score) {
                await deleteFinishedPost(redis, comment.parentId);
            }
        }
    }
}

export async function onCommentCreate (event: CommentCreate, context: TriggerContext) {
    if (!event.comment || !event.comment.id) {
        console.error("CommentCreate event does not contain a comment or comment ID", event);
        return;
    }

    await evaluateNewComment(context.reddit, context.redis, await context.reddit.getCommentById(event.comment.id), await getAppSettings(context.settings));
    await setVote(event.comment.id, 1, context.debug.metadata);
}

export const commentCreateTrigger = Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: onCommentCreate,
});
