/**
 * @name KeyFate recognized sensitive sinks
 * @description Enumerates database, command, and filesystem sinks recognized in the KeyFate server code.
 * @kind problem
 * @id keyfate/list-sensitive-sinks
 * @problem.severity recommendation
 */
import javascript

from DataFlow::Node sink, string kind
where
  exists(DatabaseAccess e |
    sink = e.getAQueryArgument() and kind = "database-access"
  )
  or
  exists(SystemCommandExecution e |
    sink = e.getACommandArgument() and kind = "command-execution"
  )
  or
  exists(FileSystemAccess e |
    sink = e.getAPathArgument() and kind = "file-access"
  )
select sink,
  kind + " | " + sink.getLocation().getFile().getRelativePath()
    + ":" + sink.getLocation().getStartLine().toString()
