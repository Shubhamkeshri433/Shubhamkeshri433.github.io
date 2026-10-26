# Dashboard setup brief

The dashboard lives at `/admin/` (https://shubhamkeshri433.github.io/admin/). It edits the files in `data/` by committing to this repository through the GitHub API. The site is static, so **GitHub permissions are the lock**: only a token that belongs to `Shubhamkeshri433` and can write to this repo works.

## One-time setup
1. Put the site on GitHub (push or upload this folder to `Shubhamkeshri433/Shubhamkeshri433.github.io`, branch `main`). If your branch is not `main`, change `branch` in `js/config.js`.
2. Turn on two-factor authentication: GitHub → Settings → Password and authentication.
3. Create the token: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Resource owner: you. Expiration: 30–90 days.
   - Repository access: **Only select repositories** → `Shubhamkeshri433.github.io`.
   - Permissions → Repository → **Contents: Read and write**. Nothing else.
4. Open `/admin/`, paste the token, sign in. Tick "Remember on this device" only on a computer you trust; you then choose a passphrase (10+ characters) that encrypts the token in your browser.

## Everyday use
- Pick a tab, edit, press **Save to GitHub**. Each save is one commit; the live site updates in about a minute.
- Blog: write Markdown, toggle **Draft** to hide a post. Slugs are lowercase-with-dashes.
- If a save says the file changed on GitHub, press **Reload from GitHub** and redo the edit.
- When the token expires, make a new one and use "Use a different token".

## Security model (honest version)
- The page at `/admin/` is public, like any static page. Nobody can change anything without your token.
- Sign-in checks the token's account is exactly the owner and that it can push to this repo; anything else is rejected.
- The token is held in memory only, unless you choose to remember it (AES-GCM, key from your passphrase via PBKDF2 with 310,000 rounds). The dashboard locks after 15 idle minutes and clears everything from memory.
- A strict Content-Security-Policy allows scripts only from this site and network calls only to `api.github.com`. Content is rendered without `innerHTML`, so post text cannot inject scripts.
- The failed-attempt delay in the page is a courtesy, not a defence. Real protection is GitHub's token + 2FA. If a token leaks, revoke it in GitHub settings immediately.
- `robots.txt` hides `/admin/` from search engines. That is not security either.
