# x-image-downloader

Chrome/Edge extension for saving X/Twitter post images to a local folder.

## What It Does

- Adds a save button to supported X/Twitter post images.
- Saves images to a folder you choose on your device.
- Tracks save status per image, so each image shows its own loading and result state.
- Can prefer original image quality when X/Twitter provides it.
- Lets you customize filename templates and duplicate-file behavior.
- Supports Japanese and English UI text.

## Supported Sites

- `x.com`
- `twitter.com`

## How To Use

1. Build the extension, or obtain a packaged copy.
   ```powershell
   pnpm install
   pnpm build
   ```
2. Load the extension from `dist/` in Chrome or Edge with Developer mode enabled.
3. Click the extension icon in the toolbar.
4. Choose a save folder.
5. Open an image post on X/Twitter.
6. Hover an image and click the save button.

## Settings

Open the extension popup from the toolbar icon.

- **Save folder**: choose, reselect, or clear the destination folder.
- **Language**: use automatic detection, Japanese, or English.
- **Filename template**: customize saved filenames with variables such as `{author}` and `{tweetId}`.
- **Duplicate behavior**: overwrite, skip, or rename when a filename already exists.
- **Prefer original image quality**: save the original image variant when available.

Full settings and developer diagnostics are available from the options page.

## Current Scope

- Image posts are supported.
- Videos, GIFs, bulk save UI, and store packaging are not supported yet.

## License

MIT
