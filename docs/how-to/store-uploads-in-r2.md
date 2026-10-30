# Store uploads in R2

Send the CMS's uploads straight from the browser to a Cloudflare R2 bucket instead of committing them to the repository.

By default the CMS commits uploads under `public/media/`, and the build optimises the images. With R2, an upload goes to the bucket and the content holds its absolute URL under `publicUrl`.

1. Create an R2 bucket with a public URL, and an access key that can write to it.
2. Set `media` in `src/site.config.ts`.

   ```ts
   export const site: SiteConfig = {
     media: {
       storage: 'r2',
       accountId: 'your-account-id',
       bucket: 'my-site-media',
       accessKeyId: 'your-access-key-id',
       publicUrl: 'https://media.example.com',
     },
   };
   ```

3. Run `pnpm stomme cms`. The CMS config gets a Cloudflare R2 media library.
4. Upload an image in the CMS. The CMS asks once for the secret access key and keeps it in your browser, never in the repository, and the image's address starts with `publicUrl`.

| Key | What it sets |
|---|---|
| `storage` | `git` (the default) or `r2` |
| `accountId`, `bucket`, `accessKeyId`, `publicUrl` | required with `r2` |
| `prefix` | a folder inside the bucket |
| `jurisdiction` | `default`, `eu` or `fedramp` |
| `maxFileSize` | the largest upload in bytes, refused in the browser; works with either storage |

A missing required key or an unknown `storage` stops `stomme cms` and the build with a message that names it.
