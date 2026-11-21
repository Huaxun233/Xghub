# VeneraX integration

VeneraX source and bundled assets are from [Kyosee/VeneraX, revision 4faa882](https://github.com/Kyosee/VeneraX/tree/4faa882343e637e620b7bb125fcef60b4b53fa2a), under GPL-3.0. The accompanying license and upstream README files are retained.

Xghub loads VeneraX as a local Flutter package inside its Comics tab. The embedded reader uses the VeneraX source API version, its own application data and cache directories, and package-scoped assets. Xghub manages application updates, system integrations, and its own launcher icon. The embedded version uses Flutter's default image cache rather than a separate memory inspection plugin.

The online-source integration fixture is in the Xghub app's test/support directory. It is synthetic and does not bundle or contact a public comic site.
