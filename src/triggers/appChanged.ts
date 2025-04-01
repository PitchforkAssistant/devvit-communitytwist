import {AppInstall, AppUpgrade, Devvit, TriggerContext, TriggerEventType} from "@devvit/public-api";
import {startSingletonJob} from "devvit-helpers";
import {postUpdaterJobName} from "../scheduler/postsUpdaterJob.js";

export async function onAppChanged (event: TriggerEventType[AppInstall] | TriggerEventType[AppUpgrade], context: TriggerContext) {
    try {
    // This function from devvit-helpers will start a job, but it terminates any other jobs with the same name first.
        await startSingletonJob(context.scheduler, postUpdaterJobName, "* * * * *", {});
    } catch (e) {
        console.error("Failed to schedule postsUpdaterJob job", e);
        throw e;
    }
}

export const appChangedTrigger = Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: onAppChanged,
});
