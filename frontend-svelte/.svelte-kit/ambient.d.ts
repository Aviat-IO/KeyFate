
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const LSCOLORS: string;
	export const CLAUDE_BASH_MAINTAIN_WORKING_DIR: string;
	export const GHOSTTY_BIN_DIR: string;
	export const CLOUDSDK_HOME: string;
	export const COLORTERM: string;
	export const ZELLIJ_SESSION_NAME: string;
	export const LESS: string;
	export const XPC_FLAGS: string;
	export const TERM_PROGRAM_VERSION: string;
	export const OPENCLAW_NOSTR_PRIVATE_KEY: string;
	export const ENCRYPTION_KEY: string;
	export const FPATH: string;
	export const NODE: string;
	export const GOOGLE_CLOUD_PROJECT: string;
	export const JAVA_HOME: string;
	export const __CFBundleIdentifier: string;
	export const ASANA_ACCESS_TOKEN: string;
	export const SSH_AUTH_SOCK: string;
	export const DIRENV_DIR: string;
	export const ANTHROPIC_API_KEY: string;
	export const GEMINI_API_KEY: string;
	export const AGENT: string;
	export const OSLogRateLimit: string;
	export const OPENAI_API_KEY: string;
	export const npm_config_local_prefix: string;
	export const HOMEBREW_PREFIX: string;
	export const GPG_TTY: string;
	export const DIRENV_FILE: string;
	export const EDITOR: string;
	export const FZF_ALT_C_OPTS: string;
	export const PWD: string;
	export const LOGNAME: string;
	export const ZELLIJ_PANE_ID: string;
	export const MANPATH: string;
	export const GOOGLE_APPLICATION_CREDENTIALS: string;
	export const PNPM_HOME: string;
	export const LaunchInstanceID: string;
	export const _: string;
	export const ZSH_TMUX_CONFIG: string;
	export const COMMAND_MODE: string;
	export const FIRECRAWL_API_KEY: string;
	export const GHOSTTY_SHELL_FEATURES: string;
	export const HOME: string;
	export const OPENCODE: string;
	export const LANG: string;
	export const LS_COLORS: string;
	export const npm_package_version: string;
	export const _ZSH_TMUX_FIXED_CONFIG: string;
	export const SECURITYSESSIONID: string;
	export const STARSHIP_SHELL: string;
	export const __MISE_DIFF: string;
	export const BRAVE_API_KEY: string;
	export const TMPDIR: string;
	export const DIRENV_DIFF: string;
	export const STARSHIP_SESSION_KEY: string;
	export const __MISE_ORIG_PATH: string;
	export const INFOPATH: string;
	export const npm_lifecycle_script: string;
	export const CONTEXT7_API_KEY: string;
	export const GHOSTTY_RESOURCES_DIR: string;
	export const TERMINFO: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const ZSH: string;
	export const __MISE_ZSH_PRECMD_RUN: string;
	export const CEREBRAS_API_KEY: string;
	export const GOOGLE_GENERATIVE_AI_API_KEY: string;
	export const USER: string;
	export const OPENCLAW_GATEWAY_TOKEN: string;
	export const HOMEBREW_CELLAR: string;
	export const FZF_CTRL_T_OPTS: string;
	export const __MISE_SESSION: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const PAGER: string;
	export const ANDROID_SDK_ROOT: string;
	export const HOMEBREW_REPOSITORY: string;
	export const AVANTE_OPENAI_API_KEY: string;
	export const GROQ_API_KEY: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_config_user_agent: string;
	export const npm_execpath: string;
	export const CLOUDSDK_ACTIVE_CONFIG_NAME: string;
	export const ZSH_TMUX_TERM: string;
	export const npm_package_json: string;
	export const CLAUDE_CODE_OAUTH_TOKEN: string;
	export const MISE_SHELL: string;
	export const XDG_DATA_DIRS: string;
	export const PATH: string;
	export const ZELLIJ: string;
	export const DIRENV_WATCHES: string;
	export const npm_node_execpath: string;
	export const CLOUDFLARED_TUNNEL_KEY: string;
	export const OLDPWD: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const TERM_PROGRAM: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		LSCOLORS: string;
		CLAUDE_BASH_MAINTAIN_WORKING_DIR: string;
		GHOSTTY_BIN_DIR: string;
		CLOUDSDK_HOME: string;
		COLORTERM: string;
		ZELLIJ_SESSION_NAME: string;
		LESS: string;
		XPC_FLAGS: string;
		TERM_PROGRAM_VERSION: string;
		OPENCLAW_NOSTR_PRIVATE_KEY: string;
		ENCRYPTION_KEY: string;
		FPATH: string;
		NODE: string;
		GOOGLE_CLOUD_PROJECT: string;
		JAVA_HOME: string;
		__CFBundleIdentifier: string;
		ASANA_ACCESS_TOKEN: string;
		SSH_AUTH_SOCK: string;
		DIRENV_DIR: string;
		ANTHROPIC_API_KEY: string;
		GEMINI_API_KEY: string;
		AGENT: string;
		OSLogRateLimit: string;
		OPENAI_API_KEY: string;
		npm_config_local_prefix: string;
		HOMEBREW_PREFIX: string;
		GPG_TTY: string;
		DIRENV_FILE: string;
		EDITOR: string;
		FZF_ALT_C_OPTS: string;
		PWD: string;
		LOGNAME: string;
		ZELLIJ_PANE_ID: string;
		MANPATH: string;
		GOOGLE_APPLICATION_CREDENTIALS: string;
		PNPM_HOME: string;
		LaunchInstanceID: string;
		_: string;
		ZSH_TMUX_CONFIG: string;
		COMMAND_MODE: string;
		FIRECRAWL_API_KEY: string;
		GHOSTTY_SHELL_FEATURES: string;
		HOME: string;
		OPENCODE: string;
		LANG: string;
		LS_COLORS: string;
		npm_package_version: string;
		_ZSH_TMUX_FIXED_CONFIG: string;
		SECURITYSESSIONID: string;
		STARSHIP_SHELL: string;
		__MISE_DIFF: string;
		BRAVE_API_KEY: string;
		TMPDIR: string;
		DIRENV_DIFF: string;
		STARSHIP_SESSION_KEY: string;
		__MISE_ORIG_PATH: string;
		INFOPATH: string;
		npm_lifecycle_script: string;
		CONTEXT7_API_KEY: string;
		GHOSTTY_RESOURCES_DIR: string;
		TERMINFO: string;
		TERM: string;
		npm_package_name: string;
		ZSH: string;
		__MISE_ZSH_PRECMD_RUN: string;
		CEREBRAS_API_KEY: string;
		GOOGLE_GENERATIVE_AI_API_KEY: string;
		USER: string;
		OPENCLAW_GATEWAY_TOKEN: string;
		HOMEBREW_CELLAR: string;
		FZF_CTRL_T_OPTS: string;
		__MISE_SESSION: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		PAGER: string;
		ANDROID_SDK_ROOT: string;
		HOMEBREW_REPOSITORY: string;
		AVANTE_OPENAI_API_KEY: string;
		GROQ_API_KEY: string;
		XPC_SERVICE_NAME: string;
		npm_config_user_agent: string;
		npm_execpath: string;
		CLOUDSDK_ACTIVE_CONFIG_NAME: string;
		ZSH_TMUX_TERM: string;
		npm_package_json: string;
		CLAUDE_CODE_OAUTH_TOKEN: string;
		MISE_SHELL: string;
		XDG_DATA_DIRS: string;
		PATH: string;
		ZELLIJ: string;
		DIRENV_WATCHES: string;
		npm_node_execpath: string;
		CLOUDFLARED_TUNNEL_KEY: string;
		OLDPWD: string;
		__CF_USER_TEXT_ENCODING: string;
		TERM_PROGRAM: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
