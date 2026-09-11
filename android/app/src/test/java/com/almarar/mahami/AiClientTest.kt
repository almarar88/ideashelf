package com.almarar.mahami

import com.almarar.mahami.ai.AiClient
import com.almarar.mahami.ai.AiException
import com.almarar.mahami.ai.AiModel
import com.almarar.mahami.ai.ChatMessage
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.ServerSocket
import java.net.SocketException
import kotlin.concurrent.thread

/** يتحقق من بناء الطلب وقراءة الرد ومعالجة الأخطاء مقابل خادم محلي */
class AiClientTest {

    private lateinit var server: ServerSocket
    @Volatile private var lastBody: String = ""
    private val lastHeaders = mutableMapOf<String, String>()
    @Volatile private var responseCode = 200
    @Volatile private var responseBody = ""

    /** خادم HTTP مصغّر يلتقط الطلب ويعيد رداً محدداً */
    @Before
    fun start() {
        server = ServerSocket(0, 0, java.net.InetAddress.getByName("127.0.0.1"))
        thread(isDaemon = true) {
            while (!server.isClosed) {
                try {
                    server.accept().use { socket ->
                        val input = socket.getInputStream()
                        var contentLength = 0
                        while (true) {
                            val line = readLine(input) ?: break
                            if (line.isEmpty()) break
                            val name = line.substringBefore(':').trim().lowercase()
                            if (!line.contains(':')) continue
                            val value = line.substringAfter(':').trim()
                            lastHeaders[name] = value
                            if (name == "content-length") contentLength = value.toIntOrNull() ?: 0
                        }
                        if (contentLength > 0) {
                            val bytes = ByteArray(contentLength)
                            var read = 0
                            while (read < contentLength) {
                                val n = input.read(bytes, read, contentLength - read)
                                if (n <= 0) break
                                read += n
                            }
                            lastBody = String(bytes, 0, read, Charsets.UTF_8)
                        }
                        val payload = responseBody.toByteArray(Charsets.UTF_8)
                        socket.getOutputStream().apply {
                            write(
                                ("HTTP/1.1 $responseCode OK\r\n" +
                                    "Content-Type: application/json\r\n" +
                                    "Content-Length: ${payload.size}\r\n" +
                                    "Connection: close\r\n\r\n").toByteArray(Charsets.UTF_8)
                            )
                            write(payload)
                            flush()
                        }
                    }
                } catch (e: SocketException) {
                    return@thread
                } catch (e: Exception) {
                    // تجاهل أخطاء الإغلاق أثناء التنظيف
                }
            }
        }
    }

    @After
    fun stop() = server.close()

    /** يقرأ سطر ترويسة واحداً من تدفق البايتات */
    private fun readLine(input: java.io.InputStream): String? {
        val buffer = StringBuilder()
        while (true) {
            val b = input.read()
            if (b == -1) return if (buffer.isEmpty()) null else buffer.toString()
            if (b == '\n'.code) return buffer.toString().removeSuffix("\r")
            buffer.append(b.toInt().toChar())
        }
    }

    private fun endpoint() = "http://127.0.0.1:${server.localPort}/v1/messages"

    private fun client(key: String? = "sk-ant-test-key") = AiClient({ key }, endpoint())

    /** request carries key, model and history */
    @Test
    fun sendsKeyModelAndHistory() = runBlocking {
        responseCode = 200
        responseBody = """{"content":[{"type":"text","text":"جاهز"}]}"""

        val reply = client().complete(
            model = AiModel.HAIKU_45,
            system = "نظام",
            userMessage = "ما مهامي اليوم؟",
            history = listOf(ChatMessage(true, "سؤال سابق"), ChatMessage(false, "جواب سابق"))
        )

        assertEquals("جاهز", reply)
        assertEquals("sk-ant-test-key", lastHeaders["x-api-key"])
        assertEquals("2023-06-01", lastHeaders["anthropic-version"])
        assertEquals("application/json", lastHeaders["content-type"])

        val sent = JSONObject(lastBody)
        assertEquals("claude-haiku-4-5-20251001", sent.getString("model"))
        assertEquals("نظام", sent.getString("system"))
        val messages = sent.getJSONArray("messages")
        assertEquals(3, messages.length())
        assertEquals("user", messages.getJSONObject(0).getString("role"))
        assertEquals("assistant", messages.getJSONObject(1).getString("role"))
        assertEquals("ما مهامي اليوم؟", messages.getJSONObject(2).getString("content"))
    }

    /** pending placeholder messages are not sent */
    @Test
    fun skipsPendingMessages() = runBlocking {
        responseCode = 200
        responseBody = """{"content":[{"type":"text","text":"تم"}]}"""
        client().complete(
            AiModel.SONNET_5, "نظام", "سؤال",
            history = listOf(ChatMessage(false, "", pending = true))
        )
        assertEquals(1, JSONObject(lastBody).getJSONArray("messages").length())
    }

    /** invalid key maps to a clear Arabic message */
    @Test
    fun invalidKeyMessage() {
        responseCode = 401
        responseBody = """{"error":{"message":"invalid x-api-key"}}"""
        val error = runCatching {
            runBlocking { client().complete(AiModel.SONNET_5, "s", "u") }
        }.exceptionOrNull()
        assertTrue(error is AiException)
        assertTrue(error!!.message!!.contains("غير صحيح"))
    }

    /** rate limit and overload map to Arabic messages */
    @Test
    fun rateLimitAndOverloadMessages() {
        responseCode = 429
        responseBody = """{"error":{"message":"rate limit"}}"""
        var error = runCatching { runBlocking { client().complete(AiModel.SONNET_5, "s", "u") } }
            .exceptionOrNull()
        assertTrue(error!!.message!!.contains("حد الطلبات"))

        responseCode = 529
        error = runCatching { runBlocking { client().complete(AiModel.SONNET_5, "s", "u") } }
            .exceptionOrNull()
        assertTrue(error!!.message!!.contains("مشغولة"))
    }

    /** no key means no network request */
    @Test
    fun noKeyNoRequest() {
        val error = runCatching {
            runBlocking { client(key = null).complete(AiModel.SONNET_5, "s", "u") }
        }.exceptionOrNull()
        assertTrue(error is AiException)
        assertTrue(error!!.message!!.contains("مفتاح"))
        assertTrue(lastBody.isEmpty())
    }

    /** extracts JSON from fenced or prose replies */
    @Test
    fun extractsJson() {
        val fenced = """
            إليك النتيجة:
            ```json
            {"tasks":[{"title":"مهمة"}]}
            ```
            انتهى.
        """.trimIndent()
        assertEquals("""{"tasks":[{"title":"مهمة"}]}""", AiClient.extractJson(fenced).trim())

        val inline = """النتيجة: {"plan":[]} انتهى"""
        assertEquals("""{"plan":[]}""", AiClient.extractJson(inline).trim())
    }

    /** multiple text blocks are concatenated */
    @Test
    fun concatenatesTextBlocks() = runBlocking {
        responseCode = 200
        responseBody = """{"content":[{"type":"text","text":"جزء "},{"type":"text","text":"ثانٍ"}]}"""
        assertEquals("جزء ثانٍ", client().complete(AiModel.SONNET_5, "s", "u"))
    }
}
