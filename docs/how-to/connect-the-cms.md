# Connect the CMS

Point the CMS at the site's repository, so editors can work on the files locally or sign in on the deployed site.

1. Name the backend and the repository in `src/site.config.ts`.

   ```ts
   export const site: SiteConfig = {
     cms: { backend: 'github', repo: 'your-name/my-site', branch: 'main' },
   };
   ```

   `gitlab`, `gitea` and `forgejo` work the same way.

2. Regenerate the CMS config, or restart `pnpm dev`.

   ```bash
   pnpm stomme cms
   ```

3. Open `/admin/`. The sign-in screen offers **Work with Local Repository** on `localhost`, plus **Log in** and **Sign In Using Access Token**. With `cms.baseUrl` set, it offers **Log in** and no access-token sign-in.

Without `cms`, the config names the `github` backend and a placeholder repository, `local/<package name>`, so **Work with Local Repository** works before the site has a repository on GitHub. Signing in on the deployed site needs the real `repo`.

## Work on the files locally

On `localhost` in Chrome or Edge, choose **Work with Local Repository** and pick the site's folder. The CMS reads and writes the files on disk, and you commit them with git.

The folder you pick must be the repository's root. When the site lives in a subfolder of a larger repository, set `cms.repoPath` to that subfolder, for example `repoPath: 'sites/my-site'`, and pick the repository's root.

## Sign in on the deployed site

Saves are commits to `branch`, and a host that builds on every commit publishes them. Sign in one of two ways:

- **With an access token.** Leave `cms.baseUrl` unset, choose **Sign In Using Access Token** and paste a GitHub token that can write to the repository.
- **With OAuth.** Run an OAuth server for Sveltia, set its address as `cms.baseUrl`, and editors choose **Log in**. `stomme cms` then writes `auth_methods: [oauth]` into the backend, so the CMS hides the access-token sign-in. With `cms.baseUrl` set and no `contact.endpoint`, the contact form posts to `<baseUrl>/contact`.

[Site config](../reference/site-config.md#cms) lists every `cms` key.
