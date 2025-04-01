import {CommentDelete, EventSource} from "@devvit/protos";
import {Devvit, TriggerContext} from "@devvit/public-api";
import {untrackComment} from "../data/trackedComment.js";
import {isLinkId} from "@devvit/shared-types/tid.js";
import {getResultComment} from "../data/stickyComments.js";
import {deleteFinishedPost} from "../data/trackedPost.js";

/**
 * The "CommentDelete" trigger fires after a comment has been deleted or removed.
 * You will want to check the event.source and event.reason properties to determine if the comment was deleted or removed and why.
 */

export async function onCommentDelete (event: CommentDelete, context: TriggerContext) {
    if (!event.commentId || !event.parentId) {
        console.error("CommentDelete event does not contain required IDs", event);
        return;
    }
    if (!event.source) {
        console.error("PostDelete event does not contain a source??", event);
        return;
    }
    if (event.source !== EventSource.USER) {
        return;
    }
    if (!isLinkId(event.parentId)) {
        return; // We only care about to level comments.
    }
    // Probably just cheaper to zDel than to scan and check if it exists first.
    await untrackComment(context.redis, event.parentId, event.commentId);

    const resultCommentId = await getResultComment(context.redis, event.commentId);
    if (resultCommentId && resultCommentId === event.commentId) {
        await deleteFinishedPost(context.redis, event.parentId);
    }
}

export const commentDeleteTrigger = Devvit.addTrigger({
    event: "CommentDelete",
    onEvent: onCommentDelete,
});
