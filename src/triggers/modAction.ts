import {ModAction} from "@devvit/protos";
import {Devvit, TriggerContext} from "@devvit/public-api";
import {untrackComment} from "../data/trackedComment.js";
import {deleteFinishedPost, getFinishedPostWinner} from "../data/trackedPost.js";
import {evaluateNewComment} from "./commentCreate.js";
import {getStickiedComment} from "devvit-helpers";
import {getAppSettings} from "../settings.js";

/**
 * The "ModAction" trigger fires for every new entry in the subreddit's moderation log.
 * Some of the normal limitations of the modlog apply here (such as some automod actions not being logged).
 * Actions taken by the app itself will also be logged here, you may want to ignore those to avoid infinite loops.
 */

export async function onModAction (event: ModAction, context: TriggerContext) {
    if (!event.action) {
        console.error("ModAction event does not contain an action??", event);
        return;
    }
    if (event.targetComment) {
        if (event.action === "removecomment" || event.action === "spamcomment") {
            await untrackComment(context.redis, event.targetComment.postId, event.targetComment.id);
            if (await getFinishedPostWinner(context.redis, event.targetComment.postId) === event.targetComment.id) {
                await deleteFinishedPost(context.redis, event.targetComment.postId);
            }
        } else if (event.action === "approvecomment") {
            await evaluateNewComment(context.reddit, context.redis, await context.reddit.getCommentById(event.targetComment.id), await getAppSettings(context.settings));
        }
    }
    if (event.targetPost) {
        if (event.action === "removelink" || event.action === "spamlink" || event.action === "approvelink") {
            const stickyId = await getStickiedComment(context.reddit, event.targetPost.id);
            if (stickyId) {
                try {
                    const stickyComment = await context.reddit.getCommentById(stickyId.id);
                    if (event.action === "approvelink") {
                        await stickyComment.approve();
                        await stickyComment.distinguish(true);
                    } else {
                        await stickyComment.remove();
                    }
                } catch (e) {
                    console.error("Failed to delete stickied comment", e);
                }
            }
        }
    }
}

export const modActionTrigger = Devvit.addTrigger({
    event: "ModAction",
    onEvent: onModAction,
});
