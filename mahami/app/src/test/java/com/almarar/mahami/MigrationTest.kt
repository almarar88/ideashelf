package com.almarar.mahami

import android.app.Application
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.almarar.mahami.data.AppDatabase
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * ترقية قاعدة بيانات نسخة 1.1.0 إلى مخطط 1.2.0.
 * فشل هذا الاختبار يعني انهيار التطبيق عند أول فتح لمن حدّث من نسخة سابقة.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MigrationTest {

    private val name = "migration-test.db"
    private lateinit var app: Application

    @Before
    fun setUp() {
        app = ApplicationProvider.getApplicationContext()
        app.deleteDatabase(name)
    }

    @After
    fun tearDown() {
        app.deleteDatabase(name)
    }

    /** يبني قاعدة بيانات بمخطط الإصدار 1 كما كان في 1.1.0 */
    private fun createVersion1(): String {
        val path = app.getDatabasePath(name).apply { parentFile?.mkdirs() }.absolutePath
        val db = SQLiteDatabase.openOrCreateDatabase(path, null)
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `tasks` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`title` TEXT NOT NULL, `details` TEXT NOT NULL, `notes` TEXT NOT NULL, " +
                "`projectId` INTEGER, `tags` TEXT NOT NULL, `owner` TEXT NOT NULL, " +
                "`dueDate` TEXT NOT NULL, `dueTime` TEXT NOT NULL, `flexibleDeadline` INTEGER NOT NULL, " +
                "`priority` TEXT NOT NULL, `status` TEXT NOT NULL, `subTasks` TEXT NOT NULL, " +
                "`links` TEXT NOT NULL, `remindersEnabled` INTEGER NOT NULL, " +
                "`reminderOffsetsDays` TEXT NOT NULL, `repeat` TEXT NOT NULL, " +
                "`repeatInterval` INTEGER NOT NULL, `repeatDays` TEXT NOT NULL, " +
                "`focusMinutes` INTEGER NOT NULL, `pinned` INTEGER NOT NULL, " +
                "`createdAt` TEXT NOT NULL, `completedAt` TEXT, `alert` TEXT NOT NULL)"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `projects` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`name` TEXT NOT NULL, `colorArgb` INTEGER NOT NULL, `createdAt` TEXT NOT NULL)"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `activity` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`taskId` INTEGER NOT NULL, `type` TEXT NOT NULL, `text` TEXT NOT NULL, `at` TEXT NOT NULL)"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `focus_sessions` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`taskId` INTEGER NOT NULL, `minutes` INTEGER NOT NULL, `at` TEXT NOT NULL)"
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `custom_templates` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`name` TEXT NOT NULL, `emoji` TEXT NOT NULL, `hint` TEXT NOT NULL, " +
                "`offsetDays` INTEGER NOT NULL, `priority` TEXT NOT NULL, `steps` TEXT NOT NULL, " +
                "`createdAt` TEXT NOT NULL)"
        )
        db.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY, identity_hash TEXT)")
        db.execSQL("INSERT OR REPLACE INTO room_master_table (id, identity_hash) VALUES (42, 'v1hash')")

        // مشروع ومهمتان من بيانات المستخدم القديمة
        db.execSQL(
            "INSERT INTO projects (name, colorArgb, createdAt) VALUES " +
                "('العمل', 3049238256, '2026-09-01T08:00')"
        )
        db.execSQL(
            "INSERT INTO tasks (title, details, notes, projectId, tags, owner, dueDate, dueTime, " +
                "flexibleDeadline, priority, status, subTasks, links, remindersEnabled, " +
                "reminderOffsetsDays, repeat, repeatInterval, repeatDays, focusMinutes, pinned, " +
                "createdAt, completedAt, alert) VALUES " +
                "('إعداد التقرير الشهري', 'تفاصيل', '', 1, 'تقرير', 'إدارة الجودة', " +
                "'2026-09-20', '09:00', 0, 'HIGH', 'PENDING', " +
                "'true␞تجميع البيانات␟false␞صياغة التقرير', '', 1, '1,0', " +
                "'NONE', 2, '', 25, 1, '2026-09-01T08:00', NULL, '')"
        )
        db.execSQL(
            "INSERT INTO tasks (title, details, notes, projectId, tags, owner, dueDate, dueTime, " +
                "flexibleDeadline, priority, status, subTasks, links, remindersEnabled, " +
                "reminderOffsetsDays, repeat, repeatInterval, repeatDays, focusMinutes, pinned, " +
                "createdAt, completedAt, alert) VALUES " +
                "('مهمة منجزة', '', '', NULL, '', '', '2026-09-10', '09:00', 0, 'LOW', 'DONE', " +
                "'', '', 1, '0', 'NONE', 2, '', 0, 0, '2026-09-01T08:00', '2026-09-10T11:30', '')"
        )
        db.version = 1
        db.close()
        return path
    }

    @Test
    fun `migration from 1 to 2 keeps user data and opens cleanly`() {
        createVersion1()

        val db = Room.databaseBuilder(app, AppDatabase::class.java, name)
            .addMigrations(AppDatabase.MIGRATION_1_2)
            .allowMainThreadQueries()
            .build()

        runBlocking {
            val projects = db.projectDao().getAll()
            val tasks = db.taskDao().getAll()

            // البيانات القديمة باقية كما هي
            assertEquals(1, projects.size)
            assertEquals("العمل", projects.first().name)
            assertEquals(2, tasks.size)

            val report = tasks.first { it.title == "إعداد التقرير الشهري" }
            assertEquals("إدارة الجودة", report.owner)
            assertEquals(listOf("تقرير"), report.tags)
            assertEquals(25, report.focusMinutes)
            assertTrue(report.pinned)
            assertEquals(2, report.subTasks.size)
            assertEquals("تجميع البيانات", report.subTasks[0].title)
            assertTrue(report.subTasks[0].done)

            // الحقول الجديدة أخذت قيماً صالحة
            assertEquals(0, report.estimateMinutes)
            assertEquals(null, report.dependsOn)
            assertEquals(false, report.important)
            assertEquals(null, report.mitDate)
            assertNotNull(report.updatedAt)

            // معرّف مزامنة فريد لكل صف — وإلا داست السجلات بعضها على الخادم
            val syncIds = tasks.map { it.syncId } + projects.map { it.syncId }
            assertTrue("معرّف مزامنة فارغ", syncIds.none { it.isBlank() })
            assertEquals("معرّفات المزامنة ليست فريدة", syncIds.size, syncIds.toSet().size)

            // الجدولان الجديدان يعملان
            db.commentDao().insert(
                com.almarar.mahami.data.Comment(taskId = report.id, text = "ملاحظة بعد الترقية")
            )
            assertEquals(
                "ملاحظة بعد الترقية",
                db.commentDao().observeForTask(report.id).first().first().text
            )
            assertEquals(0, db.tombstoneDao().getAll().size)
        }
        db.close()
    }

    @Test
    fun `opening the migrated database twice is stable`() {
        createVersion1()
        repeat(2) {
            val db = Room.databaseBuilder(app, AppDatabase::class.java, name)
                .addMigrations(AppDatabase.MIGRATION_1_2)
                .allowMainThreadQueries()
                .build()
            runBlocking { assertEquals(2, db.taskDao().getAll().size) }
            db.close()
        }
    }
}
