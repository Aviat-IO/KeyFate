/**
 * @name Global decrypt-oracle route sink
 * @description Confirms that the authenticated SvelteKit decrypt route invokes the shared decryptMessage primitive.
 * @kind problem
 * @id keyfate/slice-global-decrypt-oracle
 * @problem.severity warning
 */
import javascript

from DataFlow::CallNode call, string path
where
  call.getCalleeName() = "decryptMessage" and
  path = call.getLocation().getFile().getRelativePath() and
  path = "src/routes/api/decrypt/+server.ts"
select call, "The authenticated generic route reaches decryptMessage in " + path + "."
