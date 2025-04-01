import {Comment, RedditAPIClient} from "@devvit/public-api";

export async function safeDeleteComment (reddit: RedditAPIClient, commentId: string) {
    try {
        const comment = await reddit.getCommentById(commentId);
        if (comment) {
            await comment.delete();
        }
    } catch {
        return;
    }
}

export async function safeDistinguishComment (comment: Comment, sticky: boolean) {
    try {
        await comment.distinguish(sticky);
    } catch (e) {
        console.warn("Failed to distinguish comment", e);
    }
}
