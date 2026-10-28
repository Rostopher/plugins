Agent Share publishes a Markdown export of the selected agent session as a **public GitHub Gist**. The export includes the most recent 200 projected timeline entries by default, including messages, reasoning, tool inputs and outputs, file content shown in the timeline, and agent metadata such as its working directory. Review the session for secrets and private material before using the share action; this version does not offer a preview or redaction step.

In the Command Center, choose **Setup GitHub Gist sharing** and authorize the GitHub app with the `gist` scope. On desktop/web the authorization code is copied to the clipboard and the GitHub activation page opens. If authorization fails, the plugin offers manual entry of a GitHub token with the same scope. The token is held in plugin process memory, so setup must be repeated after the plugin restarts.

With an agent selected, choose **Share session as Markdown**. The plugin sends the exported text to GitHub and copies the resulting public Gist URL to the clipboard on desktop/web. Anyone can read the Gist. GitHub receives the export and authentication requests; the plugin does not run session commands or read project files independently of the timeline.

Requires Paseo 0.11.0 or later and a GitHub account. The interaction uses browser alerts, confirmations and prompts; native mobile support has not been verified.
