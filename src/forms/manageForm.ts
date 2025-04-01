import {Context, Devvit, FormFunction, FormKey, FormOnSubmitEvent, FormOnSubmitEventHandler, JSONObject, RedditAPIClient, RedisClient, SettingsClient} from "@devvit/public-api";

import {getAppSettings} from "../settings.js";
import {FieldConfig_Selection_Item as FieldConfigSelectionItem} from "@devvit/protos";
import {isCommentId, isLinkId} from "@devvit/shared-types/tid.js";
import {deleteFinishedPost, getFinishedPostWinner, getTrackedPosts, isTrackedPost, setFinishedPost, trackPost, untrackPost} from "../data/trackedPost.js";
import {safeDeleteComment} from "../utils/safeRedditAPI.js";
import {getPostStickyComment, setResultComment} from "../data/stickyComments.js";
import {getTrackedComments, trackComment, untrackComment} from "../data/trackedComment.js";
import {resultForm} from "../main.js";
import {ResultFormData} from "./resultForm.js";
import {addOrUpdateStickiedComment, getWinnerText} from "../scheduler/postsUpdaterJob.js";

export type ManageAction = "track" | "untrack" | "update" | "delete" | "log" | "set";

export type ManageActionOptions = {
    label: string;
    value: ManageAction;
}[] & FieldConfigSelectionItem[];

export const manageActionOptions: ManageActionOptions = [
    {label: "Track", value: "track"},
    {label: "Untrack", value: "untrack"},
    {label: "Update", value: "update"},
    {label: "Delete", value: "delete"},
    {label: "Log", value: "log"},
    {label: "Set", value: "set"},
];

export type ManageFormData = {
    fullId?: string;
    action?: ManageAction;
}

const form: FormFunction<ManageFormData> = (data: ManageFormData) => ({
    title: "Manage Community Twist",
    description: "Allows you to manually trigger the community twist process and debug it.",
    fields: [
        {
            type: "string",
            name: "fullId",
            label: "Full ID",
            description: "The full ID of the post or comment you want to manage. This should be in the format of t3_123456 or t1_123456.",
            defaultValue: data.fullId ?? "",
        },
        {
            type: "select",
            name: "action",
            label: "Action",
            description: "The action you want to perform on the post or comment above.",
            options: manageActionOptions,
            defaultValue: [data.action ?? "log"],
            multiSelect: false,
        },
    ],
});

export type ManageFormSubmitData = {
    fullId?: string;
    action?: [ManageAction];
}

export async function getFormLogResultData (reddit: RedditAPIClient, redis: RedisClient, settings: SettingsClient, postId: string): Promise<ResultFormData> {
    const appSettings = await getAppSettings(settings);
    const trackedPosts = await getTrackedPosts(redis, 0, Number.MAX_SAFE_INTEGER);
    const trackedComments = await getTrackedComments(redis, postId);
    const stickiedComment = await getPostStickyComment(redis, postId);
    const result = await getFinishedPostWinner(redis, postId);

    return {
        title: "Post Management",
        description: "Post Management",
        fields: [
            {
                type: "string",
                name: "trackedPosts",
                label: "Tracked Posts",
                defaultValue: JSON.stringify(trackedPosts),
            },
            {
                type: "string",
                name: "trackedComments",
                label: "Tracked Comments",
                defaultValue: JSON.stringify(trackedComments),
            },
            {
                type: "string",
                name: "stickiedComment",
                label: "Stickied Comment",
                defaultValue: `Stickied comment ID for post ${postId}: ${stickiedComment}`,
            },
            {
                type: "string",
                name: "result",
                label: "Result",
                defaultValue: `Result comment ID for post ${postId}: ${result}`,
            },
            {
                type: "string",
                name: "appSettings",
                label: "App Settings",
                defaultValue: JSON.stringify(appSettings),
            },
        ],
    };
}

const formHandler: FormOnSubmitEventHandler<ManageFormSubmitData> = async (event: FormOnSubmitEvent<ManageFormSubmitData>, {settings, reddit, redis, ui}: Context) => {
    if (!event.values.fullId || !event.values.action || !event.values.action[0]) {
        ui.showToast("Please fill in all fields!");
        return;
    }

    console.log("Manage form submit event", event);

    const action = event.values.action[0];

    if (isLinkId(event.values.fullId)) {
        const post = await reddit.getPostById(event.values.fullId);
        switch (action) {
        case "track":
            await trackPost(redis, post.id, post.createdAt);
            ui.showToast("Post tracked!");
            break;
        case "untrack":
            await untrackPost(redis, post.id);
            ui.showToast("Post untracked!");
            break;
        case "update":
            await deleteFinishedPost(redis, post.id);
            ui.showToast("Post update queued!");
            break;
        case "delete":
            await untrackPost(redis, post.id);
            await safeDeleteComment(reddit, await getPostStickyComment(redis, post.id) ?? "");
            ui.showToast("Post untracked and sticky removed!");
            break;
        case "log":
            ui.showForm(resultForm, await getFormLogResultData(reddit, redis, settings, post.id) as JSONObject);
            break;
        case "set":
            ui.showToast("Set action is only available for comments!");
            break;
        default:
            return ui.showToast("Please select a valid action!");
        }
    } else if (isCommentId(event.values.fullId)) {
        const comment = await reddit.getCommentById(event.values.fullId);
        if (!isLinkId(comment.parentId)) {
            return ui.showToast("Not a top level comment!");
        }
        switch (action) {
        case "track":
            await trackComment(redis, comment.parentId, comment.id, comment.score);
            ui.showToast("Comment tracked!");
            break;
        case "untrack":
            await untrackComment(redis, comment.parentId, comment.id);
            ui.showToast("Comment untracked!");
            break;
        case "update":
            await deleteFinishedPost(redis, comment.parentId);
            ui.showToast("Queud result update for parent post!");
            break;
        case "delete":
            await untrackComment(redis, comment.parentId, comment.id);
            await safeDeleteComment(reddit, comment.id);
            ui.showToast("Comment untracked/deletion attempted!");
            break;
        case "log":
            ui.showForm(resultForm, await getFormLogResultData(reddit, redis, settings, comment.parentId) as JSONObject);
            break;
        case "set":
            if (!await isTrackedPost(redis, comment.parentId)) {
                return ui.showToast("Parent post is not tracked!");
            }
            // eslint-disable-next-line no-case-declarations
            const resultComment = await addOrUpdateStickiedComment(reddit, redis, comment.parentId, getWinnerText(comment, await getAppSettings(settings)));
            await setResultComment(redis, comment.id, resultComment.id);
            await setFinishedPost(redis, comment.parentId, resultComment.id);
            await untrackPost(redis, comment.parentId);
            return ui.showToast("Result set and post untracked to make it stick!");
        default:
            return ui.showToast("Please select a valid action!");
        }
    } else {
        return ui.showToast("Please enter a valid FULL comment or post ID! That includes the t1_ or t3_ prefix.");
    }
};

export const manageForm: FormKey = Devvit.createForm(form, formHandler);
