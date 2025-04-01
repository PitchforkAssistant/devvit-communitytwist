import {PostCreate} from "@devvit/protos";
import {Devvit, Post, RedditAPIClient, RedisClient, TriggerContext} from "@devvit/public-api";
import {isTrackablePost, trackPost} from "../data/trackedPost.js";
import {AppSettings, getAppSettings} from "../settings.js";
import {addOrUpdateStickiedComment} from "../scheduler/postsUpdaterJob.js";

export async function evaluateNewPost (reddit: RedditAPIClient, redis:RedisClient, post: Post, appSettings: AppSettings) {
    if (!isTrackablePost(post, appSettings)) {
        return;
    }

    await trackPost(redis, post.id, post.createdAt);
    console.log("PostCreate event, tracked post, adding sticky", post.id);

    await addOrUpdateStickiedComment(reddit, redis, post.id, appSettings.newPostSticky.replace(/{{author}}/g, post.authorName));
}

/**
 * The "PostCreate" trigger fires after a post has been successfully created and passed the various sitewide safety checks.
 * This trigger usually fires several seconds later than the "PostSubmit" trigger.
 */

export async function onPostCreate (event: PostCreate, context: TriggerContext) {
    if (!event.post || !event.post.id) {
        console.error("PostCreate event does not contain a post ID??", event);
        return;
    }
    const post = await context.reddit.getPostById(event.post?.id);
    if (!post) {
        console.error("PostCreate event post not found!", event);
        return;
    }
    console.log("PostCreate event, start", event);

    const appSettings = await getAppSettings(context.settings);
    await evaluateNewPost(context.reddit, context.redis, post, appSettings);
}

export const postCreateTrigger = Devvit.addTrigger({
    event: "PostCreate",
    onEvent: onPostCreate,
});
