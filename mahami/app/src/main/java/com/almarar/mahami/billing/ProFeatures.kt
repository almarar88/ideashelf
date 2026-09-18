package com.almarar.mahami.billing

/** حدود النسخة المجانية — سخية بما يكفي ليبقى التطبيق مفيداً بلا اشتراك */
object FreeLimits {
    /** عدد المشاريع في النسخة المجانية */
    const val PROJECTS = 3

    /** عدد التنبيهات لكل مهمة */
    const val REMINDERS_PER_TASK = 1

    /** عدد القوالب المخصصة */
    const val CUSTOM_TEMPLATES = 0

    /** المهام غير محدودة في النسختين */
    const val TASKS = Int.MAX_VALUE
}

/** المميزات المحجوزة للنسخة المدفوعة */
enum class ProFeature(val title: String, val description: String) {
    UNLIMITED_PROJECTS(
        "مشاريع غير محدودة",
        "النسخة المجانية تتيح ${FreeLimits.PROJECTS} مشاريع"
    ),
    MULTI_REMINDERS(
        "تنبيهات متعددة لكل مهمة",
        "ذكّرني قبل الموعد بأيام وفي يومه، بدل تنبيه واحد"
    ),
    REPEATING_TASKS(
        "المهام المتكررة",
        "يومي وأسبوعي وشهري وكل عدة أيام وأيام محددة"
    ),
    CUSTOM_TEMPLATES(
        "قوالب خاصة بك",
        "احفظ أي مهمة كقالب واستخدمها متى شئت"
    ),
    ADVANCED_REPORTS(
        "تقارير متقدمة",
        "تقرير التركيز والاتجاه الشهري وأداء المشاريع"
    ),
    EXPORT(
        "تصدير احترافي",
        "تصدير التقارير إلى PDF و CSV وملف التقويم"
    ),
    THEMES(
        "ألوان وسمات",
        "اختر لون التطبيق بما يناسبك"
    ),
    APP_LOCK(
        "قفل التطبيق",
        "حماية مهامك ببصمتك أو رمز قفل الجهاز"
    );
}

/** خطط الاشتراك المعرّفة في Google Play Console */
enum class PlanId(val productId: String, val label: String, val isSubscription: Boolean) {
    MONTHLY("pro_monthly", "شهري", true),
    YEARLY("pro_yearly", "سنوي", true),
    LIFETIME("pro_lifetime", "مدى الحياة", false);

    companion object {
        fun from(productId: String): PlanId? = entries.firstOrNull { it.productId == productId }
        val subscriptionIds: List<String> get() = entries.filter { it.isSubscription }.map { it.productId }
        val oneTimeIds: List<String> get() = entries.filter { !it.isSubscription }.map { it.productId }
    }
}
