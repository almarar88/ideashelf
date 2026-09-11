# Keep kotlinx.serialization generated serializers for the contract model.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class ai.pacto.app.domain.model.** {
    *** Companion;
}
-keepclasseswithmembers class ai.pacto.app.domain.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
