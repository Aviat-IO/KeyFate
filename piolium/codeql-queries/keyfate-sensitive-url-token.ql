/**
 * @name Credential-like values accepted from URL parameters
 * @description Finds SvelteKit request URL parameters whose names indicate bearer tokens or secrets. URL credentials can leak through logs, history, analytics, and referrers.
 * @kind problem
 * @id keyfate/sensitive-url-token
 * @problem.severity warning
 * @security-severity 6.5
 * @precision high
 * @tags security
 *       external/cwe/cwe-598
 */
import javascript

from DataFlow::CallNode call, string name
where
  call.getCalleeName() = "get" and
  name = call.getArgument(0).getStringValue() and
  name.regexpMatch("(?i).*(token|secret|private.?key|recovery.?key).*") and
  call.getLocation().getFile().getRelativePath().matches("src/routes/%")
select call, "Credential-like URL parameter '" + name + "' is accepted here."
