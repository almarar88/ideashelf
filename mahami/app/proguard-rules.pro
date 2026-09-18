# قواعد التصغير لإصدار المتجر

# الاحتفاظ بأسماء ملفات السطور لتتبّع الأعطال في Play Console
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Room يعتمد على الانعكاس في توليد التنفيذات
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep @androidx.room.Entity class * { *; }
-dontwarn androidx.room.paging.**

# Glance يحمّل مزوّدي الويدجت بالاسم
-keep class androidx.glance.appwidget.** { *; }
-keep class com.almarar.mahami.widget.** { *; }

# مستقبلات البث والعمال تُنشأ عبر النظام
-keep class com.almarar.mahami.notify.** { *; }

# كوتلن
-dontwarn kotlinx.coroutines.**
-keepclassmembers class kotlin.Metadata { *; }
