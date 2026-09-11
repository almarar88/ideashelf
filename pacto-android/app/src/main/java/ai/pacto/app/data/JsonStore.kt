package ai.pacto.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Small durable store for the contract book. Writes go to a temporary file and are renamed
 * into place, so a process death mid-write can never leave a half-written contract file.
 */
class JsonStore(private val file: File) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    suspend fun readText(): String? = withContext(Dispatchers.IO) {
        if (!file.exists()) null else runCatching { file.readText() }.getOrNull()
    }

    suspend fun writeText(content: String) = withContext(Dispatchers.IO) {
        file.parentFile?.mkdirs()
        val temp = File(file.parentFile, "${file.name}.tmp")
        temp.writeText(content)
        if (!temp.renameTo(file)) {
            file.writeText(content)
            temp.delete()
        }
    }

    fun encoder(): Json = json
}
