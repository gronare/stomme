# Contributing

Issues and pull requests are welcome. For a security problem, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

## License and sign-off

Contributions are accepted under the project's license, [AGPL-3.0-only](LICENSE).

Every commit in a pull request must be signed off under the [Developer Certificate of Origin](https://developercertificate.org): a `Signed-off-by:` line with the commit author's name and email, certifying that you wrote the change or have the right to submit it under the project's license. Add it with `-s`:

```sh
git commit -s -m "Add a caption field to the gallery block"
```

A check on the pull request fails when a commit lacks the line. To sign off commits you already made:

```sh
git rebase --signoff main
git push --force-with-lease
```

## Before you open a pull request

```sh
pnpm install
pnpm --filter @gronare/stomme typecheck
pnpm --filter @gronare/stomme run test:units
```

Dependencies must be under a license compatible with AGPL-3.0-only; CI checks this with `node .github/scripts/check-licenses.mjs`.
