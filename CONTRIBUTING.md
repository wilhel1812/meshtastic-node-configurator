# Contributing

Issues and pull requests are welcome.

1. Discuss substantial product or UI changes in an issue first.
2. Clone recursively and use Node.js 22 or newer.
3. Keep the core editor deployment-agnostic; host recommendations belong in the public instance configuration.
4. Reuse the pinned name generator and official protobuf definitions rather than copying their logic.
5. Run `npm run check`, `npm run lint`, and `npm run build`.
6. Update tests and documentation when behavior changes.

Do not include real `.cfg` files, passwords, private keys, channel keys, names, identifiers, or exact coordinates in issues, fixtures, screenshots, or pull requests.

This project uses semantic versioning. Human changes require maintainer review. Compatible automated name-generator updates are the sole narrow auto-merge exception.
