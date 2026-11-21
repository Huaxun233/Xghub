# Xghub build compatibility

Vendored from the published rhttp 0.16.0 package (https://pub.dev/packages/rhttp/versions/0.16.0), upstream https://codeberg.org/Tienisto/rhttp. Original MIT license is retained in LICENSE.

Xghub changes only cargokit/gradle/plugin.gradle: CargoKitBuildTask injects Gradle ExecOperations and uses it instead of Project.exec, removed in Gradle 9. Dart and Rust runtime sources are unchanged.

When target-platform is explicitly specified, debug builds honor it instead of appending emulator architectures.

Android compileSdk is 36, matching the host app and satisfying current AndroidX metadata.
