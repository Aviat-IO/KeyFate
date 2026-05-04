# KeyFate offline recovery guide for recipients

Use this when the KeyFate owner has missed check-ins and you have both:

1. your recipient share, and
2. the disclosed KeyFate server share.

## Safety first

- Use a device you trust.
- Open `/offline-recovery`, then disconnect from the internet before pasting shares.
- Do not paste shares into email, chat, search, or AI tools.
- After recovery, close the browser tab and clear your clipboard.

## Recover the secret

1. Open the KeyFate offline recovery tool: `/offline-recovery`.
2. Disconnect from the internet. The tool runs in your browser after the page loads.
3. Paste your recipient share into **Recipient share**.
4. Paste the disclosed server share into **Disclosed server share**.
5. Click **Recover Secret Locally**.
6. Copy the recovered secret only to the secure place where you need it.

The tool accepts raw hexadecimal shares. It also accepts JSON recovery kits with `share`, `recipientShare`, `serverShare`, or `disclosedShare` fields.

## If recovery fails

- Check that both shares were copied completely.
- Make sure you are using one recipient share and one disclosed server share from the same KeyFate secret.
- Keep the original messages. Do not edit or reformat the shares beyond copying them.
- Ask for help in the GitHub issue or PR for this recovery flow without posting any real shares.
