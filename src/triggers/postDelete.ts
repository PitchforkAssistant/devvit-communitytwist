import {EventSource, PostDelete} from "@devvit/protos";
import {Devvit, TriggerContext} from "@devvit/public-api";
import {isTrackedPost, untrackPost} from "../data/trackedPost.js";
import {getStickiedComment} from "devvit-helpers";
import {delPostStickyComment} from "../data/stickyComments.js";

/**
 * The "PostDelete" trigger fires after a post has been deleted or removed.
 * You will want to check the event.source and event.reason properties to determine if the post was deleted or removed and why.
 */

export async function onPostDelete (event: PostDelete, context: TriggerContext) {
    if (!event.postId) {
        console.error("PostDelete event does not contain a post ID??", event);
        return;
    }
    if (!event.source) {
        console.error("PostDelete event does not contain a source??", event);
        return;
    }
    if (event.source !== EventSource.USER) {
        return;
    }
    if (!await isTrackedPost(context.redis, event.postId)) {
        return;
    }

    await untrackPost(context.redis, event.postId);
    console.log("PostDelete event, untracked post", event.postId);

    const stickiedComment = await getStickiedComment(context.reddit, event.postId);
    if (!stickiedComment) {
        return;
    }
    const comment = await context.reddit.getCommentById(stickiedComment.id);
    await comment.delete();
    await delPostStickyComment(context.redis, event.postId);
    console.log("PostDelete event, deleted stickied comment", stickiedComment.id);
}

export const postDeleteTrigger = Devvit.addTrigger({
    event: "PostDelete",
    onEvent: onPostDelete,
});
