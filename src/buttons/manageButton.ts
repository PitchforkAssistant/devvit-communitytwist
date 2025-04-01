import {Context, Devvit, MenuItemOnPressEvent} from "@devvit/public-api";
import {manageForm} from "../main.js";

const onPress = async (event: MenuItemOnPressEvent, context: Context) => {
    context.ui.showForm(manageForm);
};

export const manageButton = Devvit.addMenuItem({
    location: ["subreddit"],
    forUserType: "moderator",
    label: "Manage Subreddit Twist",
    onPress,
});
