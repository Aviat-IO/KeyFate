/**
 * @name Sensitive recovery material persisted in browser storage
 * @description Finds browser storage writes in KeyFate modules that handle private keys or recovery shares. These become directly exfiltrable if script execution is compromised.
 * @kind problem
 * @id keyfate/sensitive-browser-storage
 * @problem.severity warning
 * @security-severity 6.5
 * @precision medium
 * @tags security
 *       external/cwe/cwe-922
 */
import javascript

from DataFlow::CallNode call, string path
where
  call.getCalleeName() = "setItem" and
  path = call.getLocation().getFile().getRelativePath() and
  (
    path.matches("%client-wallet.ts") or
    path.matches("%NewSecretForm.svelte")
  )
select call, "Sensitive KeyFate material is persisted in browser storage in " + path + "."
