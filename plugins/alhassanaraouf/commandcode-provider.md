Command Code adds the Command Code coding agent as a Paseo provider. It runs the installed CLI through ACP, streaming messages, reasoning, tool calls, usage and costs into Paseo. Questions and permission requests are shown in the conversation, and images are forwarded to the CLI.

## Setup

Use Paseo 0.8.0 or newer and a Command Code CLI that supports `commandcode acp`. Install and sign in to the CLI separately on the daemon host with `commandcode login`. The default executable is `commandcode`, or `cmdc` on Windows. Change it in the plugin settings or set `COMMANDCODE_CLI_COMMAND` on the daemon; the daemon environment takes priority. An agent-level override no longer selects the executable.

## Permissions and data

The CLI supplies its models, effort choices and permission modes, including Standard, Accept Edits, Plan, Don't Ask and Bypass Permissions. Use Standard to ask before changes; bypass modes allow the CLI to act without those prompts. Existing 0.1.x agents drop the old Build mode and full-auto setting and open with the CLI's default mode. The previous Max effort maps to Xhigh.

The CLI runs with the daemon user's filesystem and environment access in the agent's working directory. Prompts, images and tool results go to the CLI and its configured model services. The plugin reads its own saved binary setting and delegates authentication and session persistence to the CLI. Existing CLI sessions are available for import through ACP.

Native ACP commands are joined by explicit CLI management commands for status, models, MCP servers, tastes, skills and mods. `/skills-add` and `/mods-add` ask the CLI to install the source you supply; only invoke them for sources you trust. Management output appears in the conversation.

## Limits

Project-level mods are not loaded by the CLI's ACP server; user mods are used. Interactive terminal features such as login and IDE setup must be run separately. Interrupt cancels the current turn; a new prompt during a turn interrupts it and starts another.

*This plugin entry was imported from [paseo.cafe](https://paseo.cafe/plugins/commandcode-provider).*
