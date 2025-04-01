import {Devvit, SettingsClient} from "@devvit/public-api";

export type AppSettings = {
    enabled: boolean;
    trackNewPosts: boolean;
    stickyMinutes: number;
    postPrefix: string;
    commentPrefix: string;
    stickyTemplate: string;
    newPostSticky: string;
    allowOp: boolean;
}

export const defaultAppSettings: AppSettings = {
    enabled: false,
    trackNewPosts: false,
    stickyMinutes: 720,
    postPrefix: "TI ",
    commentPrefix: "FU ",
    stickyTemplate: "This is how you fucked up, as was written by u/{{author}} in [this comment]({{permalink}}):\n\n{{body}}",
    newPostSticky: "Thank you for submitting what you did. You will find out how you fucked up in 12 hours.",
    allowOp: true,
};

export async function getAppSettings (settings: SettingsClient): Promise<AppSettings> {
    const allSettings = await settings.getAll<AppSettings>();

    return {
        enabled: typeof allSettings.enabled === "boolean" ? allSettings.enabled : defaultAppSettings.enabled,
        trackNewPosts: typeof allSettings.trackNewPosts === "boolean" ? allSettings.trackNewPosts : defaultAppSettings.trackNewPosts,
        stickyMinutes: typeof allSettings.stickyMinutes === "number" ? allSettings.stickyMinutes : defaultAppSettings.stickyMinutes,
        postPrefix: typeof allSettings.postPrefix === "string" ? allSettings.postPrefix : defaultAppSettings.postPrefix,
        commentPrefix: typeof allSettings.commentPrefix === "string" ? allSettings.commentPrefix : defaultAppSettings.commentPrefix,
        stickyTemplate: typeof allSettings.stickyTemplate === "string" ? allSettings.stickyTemplate : defaultAppSettings.stickyTemplate,
        newPostSticky: typeof allSettings.newPostSticky === "string" ? allSettings.newPostSticky : defaultAppSettings.newPostSticky,
        allowOp: typeof allSettings.allowOp === "boolean" ? allSettings.allowOp : defaultAppSettings.allowOp,
    };
}

export const appSettings = Devvit.addSettings([
    {
        type: "boolean",
        name: "enabled",
        label: "Enabled",
        helpText: "This setting turns on or off the entire app. If it's disabled, the app will not run at all.",
        defaultValue: defaultAppSettings.enabled,
    },
    {
        type: "boolean",
        name: "trackNewPosts",
        label: "Track New Posts",
        helpText: "This setting allows you to turn off the tracking of new posts. This is useful for ending an event, where you don't want to track new posts anymore, but you still want to finish up posts that are already there.",
        defaultValue: defaultAppSettings.enabled,
    },
    {
        type: "number",
        name: "stickyMinutes",
        label: "Time to sticky the most upvoted reply.",
        helpText: "Time in minutes to sticky the most upvoted reply that starts with the comment prefix on a post that starts with the post prefix.",
        defaultValue: defaultAppSettings.stickyMinutes,
    },
    {
        type: "string",
        name: "postPrefix",
        label: "Post Prefix",
        helpText: "This is the prefix of posts that will be tracked by the app. These posts will be eligible for the sticky comment with the most upvoted reply.",
        defaultValue: defaultAppSettings.postPrefix,
    },
    {
        type: "string",
        name: "commentPrefix",
        label: "Comment Prefix",
        helpText: "This is the prefix of comments that will be tracked by the app. These comments will be eligible for the sticky comment spot when the time runs out on an eligible post.",
        defaultValue: defaultAppSettings.commentPrefix,
    },
    {
        type: "paragraph",
        name: "stickyTemplate",
        label: "Sticky Template",
        helpText: "This is the template for the sticky comment. You can use {{author}} to get the author of the winning comment, {{permalink}} to link to the comment itself, and {{body}} to get the comment body in a quote block.",
        defaultValue: defaultAppSettings.stickyTemplate,
    },
    {
        type: "paragraph",
        name: "newPostSticky",
        label: "New Post Sticky",
        helpText: "This is the template for the sticky comment before the results are tracked.",
        defaultValue: defaultAppSettings.newPostSticky,
    },
    {
        type: "boolean",
        name: "allowOp",
        label: "Allow OP's comment to be considered",
        helpText: "This setting allows you to turn off the OP's comment from being considered for the sticky comment.",
        defaultValue: defaultAppSettings.allowOp,
    },
]);
