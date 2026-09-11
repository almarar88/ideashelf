# Flutter's own classes are kept by the engine's consumer rules; these entries
# cover the plugins this app ships with.

# audioplayers
-keep class xyz.luan.audioplayers.** { *; }

# Keep annotations used by the Flutter embedding.
-keepattributes *Annotation*
-keepattributes Signature

# Play Core is referenced by the Flutter deferred-components code paths, which
# this app does not use; without these rules R8 warns about missing classes.
-dontwarn com.google.android.play.core.**
