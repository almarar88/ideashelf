package com.almarar.mahami.core

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import java.io.File
import java.time.LocalDate

/** تصدير المهام والتقارير بصيغ جاهزة للمشاركة */
object Export {

    // ---------- CSV ----------

    /** ملف CSV يفتح في Excel و Google Sheets — بعلامة BOM ليظهر العربي سليماً */
    fun toCsv(tasks: List<Task>, projects: List<Project>, today: LocalDate = LocalDate.now()): String {
        val names = projects.associate { it.id to it.name }
        val header = listOf(
            "العنوان", "المشروع", "الحالة", "الأولوية", "تاريخ التسليم",
            "الوقت", "جهة المتابعة", "الخطوات المنجزة", "إجمالي الخطوات",
            "دقائق التركيز", "الوسوم", "متأخرة"
        )
        val rows = tasks.sortedBy { it.dueDate }.map { task ->
            listOf(
                task.title,
                task.projectId?.let { names[it] }.orEmpty(),
                task.status.label,
                task.priority.label,
                task.dueDate.toString(),
                task.dueTime.toString(),
                task.owner,
                task.subTasks.count { it.done }.toString(),
                task.subTasks.size.toString(),
                task.focusMinutes.toString(),
                task.tags.joinToString(" | "),
                if (task.status != TaskStatus.DONE && task.dueDate.isBefore(today)) "نعم" else "لا"
            )
        }
        return buildString {
            append('﻿')
            appendLine(header.joinToString(",") { escapeCsv(it) })
            rows.forEach { appendLine(it.joinToString(",") { cell -> escapeCsv(cell) }) }
        }
    }

    private fun escapeCsv(value: String): String {
        val clean = value.replace("\n", " ").replace("\r", " ")
        return if (clean.contains(',') || clean.contains('"')) {
            "\"" + clean.replace("\"", "\"\"") + "\""
        } else clean
    }

    // ---------- PDF ----------

    /**
     * تقرير PDF بصفحة A4 واحدة أو أكثر، بنص عربي من اليمين إلى اليسار.
     * يعيد null إن تعذّر التوليد على الجهاز.
     */
    fun writeReportPdf(
        context: Context,
        tasks: List<Task>,
        projects: List<Project>,
        stats: TaskStats,
        today: LocalDate = LocalDate.now()
    ): Uri? = runCatching {
        val pageWidth = 595
        val pageHeight = 842
        val margin = 40f
        val contentWidth = (pageWidth - margin * 2).toInt()

        val document = PdfDocument()
        var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        var canvas: Canvas = page.canvas
        var y = margin

        val titlePaint = textPaint(20f, bold = true, color = Color.parseColor("#14161A"))
        val headingPaint = textPaint(13f, bold = true, color = Color.parseColor("#14161A"))
        val bodyPaint = textPaint(11f, color = Color.parseColor("#3C424D"))
        val mutedPaint = textPaint(9.5f, color = Color.parseColor("#7A828F"))
        val linePaint = Paint().apply { color = Color.parseColor("#E3E7EC"); strokeWidth = 1f }

        fun newPageIfNeeded(needed: Float) {
            if (y + needed <= pageHeight - margin) return
            document.finishPage(page)
            pageNumber++
            page = document.startPage(
                PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            )
            canvas = page.canvas
            y = margin
        }

        fun draw(text: String, paint: TextPaint, gap: Float = 6f) {
            val layout = rtlLayout(text, paint, contentWidth)
            newPageIfNeeded(layout.height.toFloat())
            canvas.save()
            canvas.translate(margin, y)
            layout.draw(canvas)
            canvas.restore()
            y += layout.height + gap
        }

        fun rule() {
            newPageIfNeeded(12f)
            canvas.drawLine(margin, y + 4f, pageWidth - margin, y + 4f, linePaint)
            y += 14f
        }

        draw("تقرير المهام", titlePaint, gap = 2f)
        draw(Ar.fullDate(today), mutedPaint, gap = 10f)
        rule()

        draw("ملخص", headingPaint)
        draw("إجمالي المهام: ${stats.total}", bodyPaint, gap = 2f)
        draw("المنجز: ${stats.done}   •   المتأخر: ${stats.late}   •   قيد التنفيذ: ${stats.inProgress}", bodyPaint, gap = 2f)
        draw("نسبة الإنجاز: ${(stats.completionRate * 100).toInt()}%", bodyPaint, gap = 2f)
        draw("الالتزام بالمواعيد: ${if (stats.done == 0) "—" else "${(stats.onTimeRate * 100).toInt()}%"}", bodyPaint, gap = 10f)
        rule()

        val byProject = Stats.byProject(tasks, projects).filter { it.total > 0 }
        if (byProject.isNotEmpty()) {
            draw("حسب المشروع", headingPaint)
            byProject.sortedByDescending { it.total }.forEach { stat ->
                draw(
                    "${stat.project?.name ?: "بدون مشروع"}: ${stat.done} من ${stat.total}" +
                        if (stat.late > 0) "   (متأخر: ${stat.late})" else "",
                    bodyPaint,
                    gap = 2f
                )
            }
            y += 8f
            rule()
        }

        draw("تفاصيل المهام", headingPaint)
        tasks.sortedWith(compareBy({ it.status == TaskStatus.DONE }, { it.dueDate })).forEach { task ->
            val mark = when {
                task.status == TaskStatus.DONE -> "[مكتملة]"
                task.dueDate.isBefore(today) -> "[متأخرة]"
                else -> "[${Ar.relative(task.dueDate, today)}]"
            }
            draw("$mark ${task.title}", bodyPaint, gap = 1f)
            val meta = buildList {
                add(Ar.fullDate(task.dueDate))
                if (task.owner.isNotBlank()) add("متابعة: ${task.owner}")
                if (task.subTasks.isNotEmpty()) {
                    add("الخطوات: ${task.subTasks.count { it.done }}/${task.subTasks.size}")
                }
                if (task.focusMinutes > 0) add("تركيز: ${task.focusMinutes} د")
            }.joinToString("   •   ")
            draw(meta, mutedPaint, gap = 8f)
        }

        document.finishPage(page)

        val dir = File(context.cacheDir, "shared").apply { mkdirs() }
        val file = File(dir, "mahami-report.pdf")
        file.outputStream().use { document.writeTo(it) }
        document.close()

        androidx.core.content.FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }.getOrNull()

    private fun textPaint(sizeSp: Float, bold: Boolean = false, color: Int = Color.BLACK): TextPaint =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = sizeSp * 1.6f
            this.color = color
            isFakeBoldText = bold
        }

    private fun rtlLayout(text: String, paint: TextPaint, width: Int): StaticLayout =
        StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setTextDirection(TextDirectionHeuristics.RTL)
            .setLineSpacing(2f, 1.1f)
            .setIncludePad(true)
            .build()
}
