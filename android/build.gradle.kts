allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Flutter plugins share AndroidX dependencies; compile all Android modules
// against the app's installed SDK without changing their minSdk or targetSdk.
subprojects {
    afterEvaluate {
        extensions.findByName("android")?.let { android ->
            android.javaClass.getMethod("compileSdkVersion", Int::class.javaPrimitiveType)
                .invoke(android, 36)
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

