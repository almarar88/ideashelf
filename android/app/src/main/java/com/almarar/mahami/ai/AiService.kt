package com.almarar.mahami.ai

import android.content.Context
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.util.Ar
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime

/**
 * طبقة المميزات الذكية: تستخدم Claude عند توفر مفتاح،
 * وإلا تعمل بالمحرك المحلي دون إنترنت.
 */
class AiService(
    private val keyStore: SecureKeyStore,
    private val modelProvider: () -> AiModel
) {
    private val client = AiClient(apiKeyProvider = { keyStore.apiKey })

    fun isCloudReady(): Boolean = client.hasKey()

    // ---------- سياق المهام ----------

    private fun tasksContext(tasks: List<Task>, today: LocalDate): String = buildString {
        appendLine("تاريخ اليوم: ${Ar.fullDate(today)}")
        appendLine("قائمة المهام الحالية:")
        if (tasks.isEmpty()) appendLine("(لا توجد مهام)")
        tasks.sortedBy { it.dueDate }.forEach { t ->
            append("- [${t.id}] ${t.title} | الموعد: ${t.dueDate} (${Ar.dayName(t.dueDate)})")
            append(" | الحالة: ${t.status.label} | الأولوية: ${t.priority.label}")
            if (t.owner.isNotBlank()) append(" | المتابعة: ${t.owner}")
            if (t.flexibleDeadline) append(" | الموعد مرن")
            val open = t.subTasks.filter { !it.done }
            if (open.isNotEmpty()) append(" | خطوات متبقية: ${open.joinToString("؛ ") { it.title }}")
            appendLine()
        }
    }

    private val baseSystem = """
        أنت مساعد تنفيذي عربي داخل تطبيق «مهامي» لإدارة المهام في بيئة عمل حكومية/أكاديمية.
        اكتب بالعربية الفصحى المهنية، باختصار ودقة، وابدأ بالخلاصة أو التوصية.
        لا تختلق مواعيد أو أسماء أو حقائق غير موجودة في المعطيات.
        إن كان التاريخ غير واضح فقل ذلك صراحة بدل التخمين.
    """.trimIndent()

    // ---------- استخراج المهام من نص ----------

    suspend fun extractTasks(text: String, today: LocalDate = LocalDate.now()): AiResult<List<ExtractedTask>> {
        val local = Heuristics.extractTasks(text, today)
        if (!isCloudReady()) {
            return AiResult(local, AiSource.LOCAL, "استُخرجت محلياً — أضف مفتاح Claude لاستخراج أدق.")
        }
        return try {
            val system = """
                $baseSystem
                مهمتك: تحويل نص (رسالة، محضر اجتماع، قائمة توجيهات) إلى مهام منظمة.
                أعد JSON فقط دون أي شرح، بهذا الشكل:
                {"tasks":[{"title":"","details":"","due_date":"YYYY-MM-DD","due_time":"HH:mm",
                "priority":"HIGH|MEDIUM|LOW","owner":"","category":"","steps":["",""],
                "date_explicit":true,"confidence":0.0}]}
                قواعد:
                - due_date إلزامي. إن لم يُذكر تاريخ صريح فاستنتج أقرب موعد منطقي واجعل date_explicit=false.
                - إن ذكر النص يوم أسبوع مع تاريخ متعارضين، اعتمد التاريخ واذكر التعارض في details.
                - steps: خطوات تنفيذية قصيرة من واقع النص فقط.
                - العناوين قصيرة (أقل من 90 حرفاً) وبصيغة المطلوب إنجازه.
            """.trimIndent()

            val user = "تاريخ اليوم: ${today}\nاليوم: ${Ar.dayName(today)}\n\nالنص:\n$text"
            val raw = client.complete(modelProvider(), system, user, maxTokens = 3000, temperature = 0.2)
            val json = JSONObject(AiClient.extractJson(raw))
            val array = json.optJSONArray("tasks") ?: JSONArray()
            val parsed = (0 until array.length()).mapNotNull { i ->
                array.optJSONObject(i)?.let { toExtracted(it, today) }
            }
            if (parsed.isEmpty()) AiResult(local, AiSource.LOCAL, "لم يتعرّف النموذج على مهام، فاستُخدم المحرك المحلي.")
            else AiResult(parsed, AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message ?: "تعذّر الاتصال — استُخدم المحرك المحلي.")
        }
    }

    private fun toExtracted(obj: JSONObject, today: LocalDate): ExtractedTask? {
        val title = obj.optString("title").trim()
        if (title.isBlank()) return null
        val date = runCatching { LocalDate.parse(obj.optString("due_date")) }
            .getOrElse { Heuristics.parseDate(title + " " + obj.optString("details"), today) ?: today.plusDays(1) }
        val time = runCatching { LocalTime.parse(obj.optString("due_time")) }.getOrElse { LocalTime.of(9, 0) }
        val steps = obj.optJSONArray("steps")?.let { arr ->
            (0 until arr.length()).mapNotNull { arr.optString(it).takeIf { s -> s.isNotBlank() } }
        }.orEmpty()
        return ExtractedTask(
            title = title.take(90),
            details = obj.optString("details").trim(),
            dueDate = date,
            dueTime = time,
            priority = runCatching { Priority.valueOf(obj.optString("priority", "MEDIUM")) }
                .getOrDefault(Priority.MEDIUM),
            owner = obj.optString("owner").trim(),
            category = obj.optString("category").ifBlank { "عام" },
            steps = steps.take(8),
            dateWasExplicit = obj.optBoolean("date_explicit", true),
            confidence = obj.optDouble("confidence", 0.75).toFloat()
        )
    }

    // ---------- خطة اليوم ----------

    suspend fun dailyPlan(tasks: List<Task>, today: LocalDate = LocalDate.now()): AiResult<List<PlanItem>> {
        val local = Heuristics.dailyPlan(tasks, today)
        if (!isCloudReady() || tasks.isEmpty()) return AiResult(local, AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                مهمتك: بناء خطة عمل ليوم واحد من قائمة المهام.
                أعد JSON فقط: {"plan":[{"task_id":0,"title":"","slot":"","reason":""}]}
                القواعد: رتّب حسب ضغط الموعد لا حسب السهولة؛ قدّم ما يعتمد على رد الآخرين؛
                slot من: "الفترة الصباحية الأولى"، "قبل الظهر"، "بعد الظهر"، "نهاية اليوم".
                حد أقصى 6 بنود، وreason جملة واحدة عملية.
            """.trimIndent()
            val raw = client.complete(
                modelProvider(), system, tasksContext(tasks, today), maxTokens = 1500, temperature = 0.3
            )
            val arr = JSONObject(AiClient.extractJson(raw)).optJSONArray("plan") ?: JSONArray()
            val items = (0 until arr.length()).mapNotNull { i ->
                arr.optJSONObject(i)?.let { o ->
                    val title = o.optString("title").trim()
                    if (title.isBlank()) null else PlanItem(
                        taskId = o.optLong("task_id").takeIf { it > 0 },
                        title = title,
                        slot = o.optString("slot").ifBlank { "اليوم" },
                        reason = o.optString("reason").trim()
                    )
                }
            }
            if (items.isEmpty()) AiResult(local, AiSource.LOCAL) else AiResult(items, AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message.orEmpty())
        }
    }

    // ---------- المخاطر والتعارضات ----------

    suspend fun risks(tasks: List<Task>, today: LocalDate = LocalDate.now()): AiResult<List<RiskNote>> {
        val local = Heuristics.risks(tasks, today)
        if (!isCloudReady() || tasks.isEmpty()) return AiResult(local, AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                مهمتك: مراجعة قائمة المهام وكشف المخاطر والتعارضات الحقيقية فقط.
                ابحث عن: ازدحام يوم واحد بتسليمات، تأخّر، مواعيد غير محددة، اعتماد على رد الآخرين،
                تعارض بين يوم الأسبوع والتاريخ، ومهام لم تبدأ رغم قرب موعدها.
                أعد JSON فقط: {"risks":[{"title":"","body":"","level":"HIGH|MEDIUM|LOW","task_ids":[0]}]}
                لا تخترع مخاطر شكلية، وإن لم توجد مخاطر فأعد قائمة فارغة.
            """.trimIndent()
            val raw = client.complete(
                modelProvider(), system, tasksContext(tasks, today), maxTokens = 1800, temperature = 0.2
            )
            val arr = JSONObject(AiClient.extractJson(raw)).optJSONArray("risks") ?: JSONArray()
            val items = (0 until arr.length()).mapNotNull { i ->
                arr.optJSONObject(i)?.let { o ->
                    val title = o.optString("title").trim()
                    if (title.isBlank()) null else RiskNote(
                        title = title,
                        body = o.optString("body").trim(),
                        level = runCatching { RiskLevel.valueOf(o.optString("level", "MEDIUM")) }
                            .getOrDefault(RiskLevel.MEDIUM),
                        taskIds = o.optJSONArray("task_ids")?.let { ids ->
                            (0 until ids.length()).map { ids.optLong(it) }
                        }.orEmpty()
                    )
                }
            }
            AiResult(items.ifEmpty { local }, if (items.isEmpty()) AiSource.LOCAL else AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message.orEmpty())
        }
    }

    // ---------- خطوات مقترحة ----------

    suspend fun suggestSteps(task: Task): AiResult<List<String>> {
        val local = Heuristics.suggestSteps(task.title, task.details)
        if (!isCloudReady()) return AiResult(local, AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                مهمتك: تقسيم مهمة إلى خطوات تنفيذية مرتبة (من 3 إلى 7 خطوات).
                كل خطوة فعل واضح قابل للإنجاز في جلسة واحدة، ولا تتجاوز 90 حرفاً.
                أعد JSON فقط: {"steps":["",""]}
            """.trimIndent()
            val user = buildString {
                appendLine("المهمة: ${task.title}")
                if (task.details.isNotBlank()) appendLine("التفاصيل: ${task.details}")
                if (task.owner.isNotBlank()) appendLine("جهة المتابعة: ${task.owner}")
                appendLine("الموعد النهائي: ${Ar.fullDate(task.dueDate)}")
            }
            val raw = client.complete(modelProvider(), system, user, maxTokens = 900, temperature = 0.4)
            val arr = JSONObject(AiClient.extractJson(raw)).optJSONArray("steps") ?: JSONArray()
            val steps = (0 until arr.length()).mapNotNull { arr.optString(it).trim().takeIf { s -> s.isNotBlank() } }
            if (steps.isEmpty()) AiResult(local, AiSource.LOCAL) else AiResult(steps.take(8), AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message.orEmpty())
        }
    }

    // ---------- صياغة رسالة ----------

    suspend fun draftMessage(task: Task, formal: Boolean): AiResult<String> {
        val local = Heuristics.draftMessage(task, formal)
        if (!isCloudReady()) return AiResult(local, AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                مهمتك: صياغة رسالة متابعة جاهزة للإرسال.
                ${if (formal) "الأسلوب: مراسلة رسمية إدارية مع تحية وخاتمة." else "الأسلوب: رسالة واتساب قصيرة ومهذبة."}
                اذكر المطلوب والموعد بوضوح. لا تضف معلومات غير واردة. أعد نص الرسالة فقط.
            """.trimIndent()
            val user = buildString {
                appendLine("الموضوع: ${task.title}")
                if (task.details.isNotBlank()) appendLine("التفاصيل: ${task.details}")
                if (task.owner.isNotBlank()) appendLine("المرسل إليه: ${task.owner}")
                appendLine("الموعد النهائي: ${Ar.fullDate(task.dueDate)}")
                val open = task.subTasks.filter { !it.done }
                if (open.isNotEmpty()) appendLine("المطلوب: ${open.joinToString("؛ ") { it.title }}")
            }
            val text = client.complete(modelProvider(), system, user, maxTokens = 900, temperature = 0.5)
            AiResult(text, AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message.orEmpty())
        }
    }

    // ---------- ملخص أسبوعي ----------

    suspend fun weeklySummary(tasks: List<Task>, today: LocalDate = LocalDate.now()): AiResult<String> {
        val local = Heuristics.weeklySummary(tasks, today)
        if (!isCloudReady() || tasks.isEmpty()) return AiResult(local, AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                مهمتك: كتابة تقرير أسبوعي موجز يصلح للإرسال لرئيس القسم.
                ابدأ بجملة خلاصة، ثم: المنجز، المستحق هذا الأسبوع، المتأخر، ثم توصية واحدة عملية.
                لا تتجاوز 180 كلمة. أعد النص فقط دون عناوين ماركداون.
            """.trimIndent()
            val text = client.complete(
                modelProvider(), system, tasksContext(tasks, today), maxTokens = 900, temperature = 0.4
            )
            AiResult(text, AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(local, AiSource.LOCAL, e.message.orEmpty())
        }
    }

    // ---------- محادثة ----------

    suspend fun chat(
        question: String,
        history: List<ChatMessage>,
        tasks: List<Task>,
        today: LocalDate = LocalDate.now()
    ): AiResult<String> {
        if (!isCloudReady()) return AiResult(localAnswer(question, tasks, today), AiSource.LOCAL)
        return try {
            val system = """
                $baseSystem
                أنت تجيب عن أسئلة المستخدم حول مهامه بالاعتماد على القائمة المرفقة فقط.
                إن سُئلت عن شيء خارج القائمة فقل إنه غير موجود في المهام.
                أجب بإيجاز (3 إلى 6 أسطر) وبتوصية عملية عند الحاجة.
                
                ${tasksContext(tasks, today)}
            """.trimIndent()
            val text = client.complete(
                modelProvider(), system, question, history = history, maxTokens = 1200, temperature = 0.4
            )
            AiResult(text, AiSource.CLAUDE)
        } catch (e: Exception) {
            AiResult(localAnswer(question, tasks, today), AiSource.LOCAL, e.message.orEmpty())
        }
    }

    /** إجابات محلية لأسئلة شائعة دون إنترنت */
    private fun localAnswer(question: String, tasks: List<Task>, today: LocalDate): String {
        val open = tasks.filter { it.status != TaskStatus.DONE }
        return when {
            question.contains("اليوم") || question.contains("أبدأ") || question.contains("ابدأ") -> {
                val plan = Heuristics.dailyPlan(tasks, today)
                if (plan.isEmpty()) "لا توجد مهام مفتوحة اليوم."
                else "ابدأ بهذا الترتيب:\n" + plan.joinToString("\n") { "• ${it.title} — ${it.reason}" }
            }
            question.contains("متأخر") -> {
                val late = open.filter { it.isOverdue() }
                if (late.isEmpty()) "لا توجد مهام متأخرة."
                else "المتأخر:\n" + late.joinToString("\n") { "• ${it.title} (${Ar.fullDate(it.dueDate)})" }
            }
            question.contains("خطر") || question.contains("تعارض") -> {
                val r = Heuristics.risks(tasks, today)
                if (r.isEmpty()) "لا توجد مخاطر واضحة."
                else r.joinToString("\n\n") { "• ${it.title}\n${it.body}" }
            }
            question.contains("ملخص") || question.contains("تقرير") ->
                Heuristics.weeklySummary(tasks, today)
            else -> buildString {
                appendLine("المحرك المحلي يجيب عن: خطة اليوم، المتأخر، المخاطر، والملخص الأسبوعي.")
                appendLine("أضف مفتاح Claude من الإعدادات للإجابة عن أي سؤال.")
                appendLine()
                appendLine("لديك ${open.size} مهمة مفتوحة، أقربها: ${open.minByOrNull { it.dueDate }?.title ?: "—"}")
            }
        }
    }

    // ---------- اختبار الاتصال ----------

    suspend fun testConnection(): String {
        if (!isCloudReady()) throw AiException("أدخل مفتاح Claude أولاً.")
        val reply = client.complete(
            modelProvider(),
            "أجب بكلمة واحدة فقط.",
            "قل: جاهز",
            maxTokens = 20,
            temperature = 0.0
        )
        return reply.take(40)
    }

    companion object {
        @Volatile private var INSTANCE: AiService? = null
        fun get(context: Context, modelProvider: () -> AiModel): AiService =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: AiService(SecureKeyStore.get(context), modelProvider).also { INSTANCE = it }
            }
    }
}
