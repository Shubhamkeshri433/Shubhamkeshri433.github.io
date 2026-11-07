# Dashboard setup brief

The dashboard lives at `/dashboard/` (https://shubhamkeshri433.github.io/dashboard/). It edits the files in `data/` by committing to this repository through the GitHub API. The site is static, so **GitHub permissions are the lock**: only a token that belongs to `Shubhamkeshri433` and can write to this repo works.

## One-time setup
1. Put the site on GitHub (push or upload this folder to `Shubhamkeshri433/Shubhamkeshri433.github.io`, branch `main`). If your branch is not `main`, change `branch` in `js/config.js`.
2. Turn on two-factor authentication: GitHub → Settings → Password and authentication.
3. Create the token: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Resource owner: you. Expiration: 30–90 days.
   - Repository access: **Only select repositories** → `Shubhamkeshri433.github.io`.
   - Permissions → Repository → **Contents: Read and write**. Nothing else.
4. Open `/dashboard/`, paste the token, sign in. Tick "Remember on this device" only on a computer you trust; you then choose a passphrase (10+ characters) that encrypts the token in your browser.

## Writing blog posts
- The Blog tab has a toolbar: Bold, Italic, Underline, Strike, Highlight, font styles (Comic, Code font, Big, Small), headings, lists, quote, centre, link, code, divider.
- **Photo** opens an editor in the page: drag to crop (free or fixed shape), rotate, flip, brightness, contrast, maximum width and quality. It shows the final size. **Upload & insert** saves the photo to `assets/blog/` in your repo (a commit) and adds it to the post.
- **Library** lists photos you uploaded; Insert puts one in the post, Delete removes it from the repo.
- **Video** embeds a YouTube link (privacy-enhanced mode). Large video files are not stored in the repo.
- Press **Save to GitHub** to publish the post text itself. Photos are uploaded straight away, the post only when you save.
- Photos are compressed to WebP in your browser (usually 50–300 KB). Keep an eye on repo size if you add very many.

## Everyday use
- **Page text** tab: every heading and paragraph of the home story and the other pages. **Raw JSON** tab: edit any data file directly (advanced).
- **Profile / Skills / Projects / Blog** tabs for the main content.
- Pick a tab, edit, press **Save to GitHub**. Each save is one commit; the live site updates in about a minute.
- Blog: write Markdown, toggle **Draft** to hide a post. Slugs are lowercase-with-dashes.
- If a save says the file changed on GitHub, press **Reload from GitHub** and redo the edit.
- When the token expires, make a new one and use "Use a different token".

## Security model (honest version)
- The page at `/dashboard/` is public, like any static page. Nobody can change anything without your token.
- Sign-in checks the token's account is exactly the owner and that it can push to this repo; anything else is rejected.
- The token is held in memory only, unless you choose to remember it (AES-GCM, key from your passphrase via PBKDF2 with 310,000 rounds). The dashboard locks after 15 idle minutes and clears everything from memory.
- A strict Content-Security-Policy allows scripts only from this site and network calls only to `api.github.com`. Content is rendered without `innerHTML`, so post text cannot inject scripts.
- The failed-attempt delay in the page is a courtesy, not a defence. Real protection is GitHub's token + 2FA. If a token leaks, revoke it in GitHub settings immediately.
- `robots.txt` hides `/dashboard/` from search engines. That is not security either.

## Features


- Dark and light theme (toggle in the top bar), Ctrl+K search, Ctrl+S review and save.
- **Review changes** shows exactly what will be committed; **Save to GitHub** commits it.
- Visual blog editor: bold, italic, headings, lists, links, photos (crop, rotate, brightness, resize), YouTube. Posts are still stored as Markdown.
- Projects: **Import from GitHub** lists all your repositories; tick the ones you want, then edit or delete them.
- Drafts are autosaved in this browser and offered back after a crash. History, site health, media library and backup are under Tools.
- It only edits `data/*.json` and `assets/blog/`; the public site's look is untouched.

## Blog editor

- Select text to get a small toolbar (bold, italic, underline, strike, heading, link, highlight).
- Press `+` on an empty line, or type `/`, to add an image, photo from your library, video, heading, list, quote, code block or divider.
- Click a picture to drag its corners, or use Small / Medium / Full. The width is saved in the post as `{w=50}` after the image.
- Image studio: move and resize the crop box, rotate, flip, adjust, pick the width, quality and format (WebP, JPEG, PNG), and see the file size before you upload.
- Drag a picture or video sideways: drop it in the left or right third to place it there, and the text wraps around it. Drop it in the middle for a centred block. The Left / Center / Right buttons do the same. Videos can be resized too. Saved as `{w=50,a=left}` after the item; phones always show them full width.
- The side panels (Posts, Add blocks) can be minimized, or hidden with Hide panels to give the editor the full width.
