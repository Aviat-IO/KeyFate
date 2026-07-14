/**
 * @name KeyFate recognized remote sources
 * @description Enumerates remote data-flow sources recognized in the KeyFate server code.
 * @kind problem
 * @id keyfate/list-remote-sources
 * @problem.severity recommendation
 */
import javascript

from RemoteFlowSource src
select src,
  src.getLocation().getFile().getRelativePath()
    + ":" + src.getLocation().getStartLine().toString()
