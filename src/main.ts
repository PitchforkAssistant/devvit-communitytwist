import {Devvit} from "@devvit/public-api";

// Enable any Devvit features you might need. For example purposes, we'll enable all non-privileged plugins.
Devvit.configure({
    redditAPI: true,
    redis: true,
    media: true,
    http: true,
    kvStore: true,
    realtime: true,
});

// These are exports of Devvit.add... functions contained in other files, which helps with organization.
// It's effectively the same as if you had written the code here.

// Settings
export {appSettings} from "./settings.js";

// Scheduler jobs
export {postsUpdaterJob} from "./scheduler/postsUpdaterJob.js";

// Triggers
export {appChangedTrigger} from "./triggers/appChanged.js";
export {commentCreateTrigger} from "./triggers/commentCreate.js";
export {commentDeleteTrigger} from "./triggers/commentDelete.js";
export {modActionTrigger} from "./triggers/modAction.js";
export {postCreateTrigger} from "./triggers/postCreate.js";
export {postDeleteTrigger} from "./triggers/postDelete.js";

export default Devvit;
