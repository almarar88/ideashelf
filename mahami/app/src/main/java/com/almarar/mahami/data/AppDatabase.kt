package com.almarar.mahami.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import java.time.LocalDateTime
import java.util.UUID

@Database(
    entities = [
        Task::class,
        Project::class,
        ActivityEntry::class,
        FocusSession::class,
        CustomTemplate::class,
        Comment::class,
        Tombstone::class
    ],
    version = 2,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {

    abstract fun taskDao(): TaskDao
    abstract fun projectDao(): ProjectDao
    abstract fun activityDao(): ActivityDao
    abstract fun focusDao(): FocusDao
    abstract fun customTemplateDao(): CustomTemplateDao
    abstract fun commentDao(): CommentDao
    abstract fun tombstoneDao(): TombstoneDao

    companion object {
        private const val NAME = "mahami-tasks.db"

        /**
         * 1 ← 2: أعمدة المزامنة والأولويات، وجدولا التعليقات وشواهد الحذف.
         * تُنقل بيانات المستخدم كما هي — لا حذف ولا إعادة إنشاء.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                val now = LocalDateTime.now().toString()

                // أعمدة جديدة على المهام
                db.execSQL("ALTER TABLE tasks ADD COLUMN estimateMinutes INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE tasks ADD COLUMN dependsOn INTEGER")
                db.execSQL("ALTER TABLE tasks ADD COLUMN important INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE tasks ADD COLUMN mitDate TEXT")
                db.execSQL("ALTER TABLE tasks ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE tasks ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '$now'")

                // أعمدة جديدة على المشاريع
                db.execSQL("ALTER TABLE projects ADD COLUMN syncId TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE projects ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '$now'")

                // معرّف مزامنة فريد لكل صف قائم
                assignSyncIds(db, "tasks")
                assignSyncIds(db, "projects")

                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS comments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        taskId INTEGER NOT NULL,
                        text TEXT NOT NULL,
                        at TEXT NOT NULL
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS tombstones (
                        syncId TEXT PRIMARY KEY NOT NULL,
                        kind TEXT NOT NULL,
                        at TEXT NOT NULL
                    )
                    """.trimIndent()
                )
            }

            private fun assignSyncIds(db: SupportSQLiteDatabase, table: String) {
                db.query("SELECT id FROM $table").use { cursor ->
                    val ids = mutableListOf<Long>()
                    while (cursor.moveToNext()) ids += cursor.getLong(0)
                    ids.forEach { id ->
                        db.execSQL(
                            "UPDATE $table SET syncId = ? WHERE id = ?",
                            arrayOf<Any>(UUID.randomUUID().toString(), id)
                        )
                    }
                }
            }
        }

        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                NAME
            ).addMigrations(MIGRATION_1_2)
                .build()
                .also { INSTANCE = it }
        }
    }
}
