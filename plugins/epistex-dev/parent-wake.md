Parent Wake notifies an agent that spawned child agents each time a child asks for permission or finishes a turn, for as long as the parent is not archived. Canceled turns are not reported.

A permission notification includes the child's question so the parent can answer it. A finished-turn notification includes the child's last assistant message, shortened if it is long, or the error if the turn failed. Notifications are sent without interrupting a turn the parent is running.

Child questions, errors and assistant responses are sent into the parent agent’s context and can be processed by its configured model provider. The plugin makes no independent network requests, reads no credentials or files, and installs no software.

When using this plugin, set `notifyOnFinish: false` when creating or prompting children to avoid duplicate first notifications from Paseo’s built-in notification mechanism.

Notifications are on by default. To turn them off, set the label `subagent-notifications` to `off` on the parent, which silences all of its children, or on a single child.

If the parent has a permission request of its own pending, notifications are held and delivered once it is resolved or the parent's turn ends. Held notifications are kept in memory and are lost if the plugin restarts, and events that occur while the daemon or plugin is restarting are not replayed.

The manifest requires Paseo 0.8.0 or later.

*This plugin entry was imported from [paseo.cafe](https://paseo.cafe/plugins/parent-wake).*
