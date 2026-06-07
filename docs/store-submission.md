# Store Submission Checklist

## Package

Create the extension ZIP file:

```powershell
pnpm package
```

The output is written to `release/x-image-downloader-v<version>.zip`.

## Chrome Web Store Listing

Suggested short description:

```text
Save X/Twitter post images to a local folder from a hover button.
```

Suggested detailed description:

```text
x-image-downloader adds a save button to supported X/Twitter post images and saves the selected image to a local folder chosen by the user.

Features:
- Save post images from x.com and twitter.com
- Prefer original image quality when available
- Customize filename templates
- Choose overwrite, skip, or rename behavior for duplicate files
- Use Japanese or English UI text

The extension stores settings and the selected folder handle locally or through Chrome extension storage. It does not collect or transmit user data.
```

## Permission Justification

- `storage`: stores extension settings, the selected save folder handle, duplicate-file records, and local diagnostic logs.
- `offscreen`: fetches and writes image blobs from an offscreen document so privileged file-system work stays out of the content script.
- `https://x.com/*` and `https://twitter.com/*`: detects supported image posts.
- `https://pbs.twimg.com/*`: fetches X/Twitter image files selected by the user.

## Manual Publisher Tasks

- Register or confirm the Chrome Web Store developer account.
- Upload the ZIP from `release/`.
- Fill listing metadata, category, language, support contact, and distribution settings.
- Add at least one screenshot and the required promotional image.
- Review and publish a hosted privacy policy based on `docs/privacy-policy.md`.
- Complete the Privacy tab so it matches the extension behavior and privacy policy.
- Submit for review.

## References

- Chrome Web Store publish flow: https://developer.chrome.com/docs/webstore/publish
- Chrome Web Store listing requirements: https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- Extension icon requirements: https://developer.chrome.com/docs/extensions/reference/manifest/icons
- Chrome Web Store image requirements: https://developer.chrome.com/webstore/images
