package com.almarar.mahami.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.SlidingTabs
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val stampFormatter = DateTimeFormatter.ofPattern("d/M/yyyy — h:mm a")

/**
 * شاشة الحساب: إنشاء حساب، تسجيل دخول، حالة المزامنة،
 * تسجيل الخروج وحذف الحساب (متطلب إلزامي في متجر جوجل).
 */
@Composable
fun AccountScreen(vm: MahamiViewModel, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val session by vm.session.collectAsStateWithLifecycle()
    val syncState by vm.syncState.collectAsStateWithLifecycle()
    val busy by vm.authBusy.collectAsStateWithLifecycle()
    val message by vm.authMessage.collectAsStateWithLifecycle()
    val configured by vm.syncConfigured.collectAsStateWithLifecycle()

    var tab by remember { mutableStateOf(0) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showAdvanced by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf("") }
    var serverKey by remember { mutableStateOf("") }

    LaunchedEffect(session.signedIn) { if (session.signedIn) password = "" }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 48.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Text("الحساب والمزامنة", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
            }
        }

        // ---------- البطاقة الداكنة: حالة الحساب ----------
        item {
            SoftCard(Modifier.fillMaxWidth(), color = colors.feature, corner = 30.dp) {
                Column(Modifier.fillMaxWidth().padding(22.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(52.dp)
                                .clip(CircleShape)
                                .background(if (session.signedIn) colors.accent else colors.featureSoft),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Rounded.Person,
                                null,
                                tint = if (session.signedIn) Color.White else colors.onFeatureMuted,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (session.signedIn) session.email.ifBlank { "حساب مهامي" } else "لم تسجّل الدخول",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.onFeature,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                if (session.signedIn) "مهامك محفوظة على جهازك وفي حسابك"
                                else "مهامك محفوظة على هذا الجهاز فقط",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.onFeatureMuted
                            )
                        }
                        SyncBadge(
                            running = syncState.running,
                            signedIn = session.signedIn,
                            error = syncState.error.isNotBlank()
                        )
                    }

                    if (session.signedIn) {
                        Spacer(Modifier.height(18.dp))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            FeatureStat(
                                Modifier.weight(1f),
                                value = if (session.lastSync > 0) relative(session.lastSync) else "—",
                                label = "آخر مزامنة"
                            )
                            FeatureStat(
                                Modifier.weight(1f),
                                value = "${syncState.pushed}",
                                label = "رُفعت"
                            )
                            FeatureStat(
                                Modifier.weight(1f),
                                value = "${syncState.pulled}",
                                label = "نُزّلت"
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { vm.syncNow() },
                            enabled = !syncState.running,
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.accent,
                                contentColor = Color.White
                            )
                        ) {
                            Text(
                                if (syncState.running) "جارٍ المزامنة…" else "زامن الآن",
                                style = MaterialTheme.typography.titleSmall
                            )
                        }
                    }
                }
            }
        }

        // ---------- رسالة الحالة ----------
        val banner = when {
            message.isNotBlank() -> message to false
            syncState.error.isNotBlank() -> syncState.error to true
            syncState.message.isNotBlank() -> syncState.message to false
            else -> null
        }
        if (banner != null) {
            item {
                val (text, isError) = banner
                SoftCard(
                    Modifier.fillMaxWidth(),
                    color = if (isError) AccentRed.copy(alpha = 0.12f) else colors.tileSage,
                    corner = 20.dp,
                    elevation = 0.dp
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text,
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (isError) AccentRed else colors.ink,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { vm.clearAuthMessage() }) {
                            Text("إخفاء", color = colors.inkMuted)
                        }
                    }
                }
            }
        }

        // ---------- نموذج الدخول ----------
        if (!session.signedIn) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 26.dp) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        SlidingTabs(
                            options = listOf("تسجيل الدخول", "حساب جديد"),
                            selectedIndex = tab,
                            onSelect = { tab = it; vm.clearAuthMessage() }
                        )
                        Spacer(Modifier.height(18.dp))

                        MahamiField(
                            value = email,
                            onValueChange = { email = it },
                            label = "البريد الإلكتروني",
                            keyboardType = KeyboardType.Email
                        )
                        Spacer(Modifier.height(12.dp))
                        MahamiField(
                            value = password,
                            onValueChange = { password = it },
                            label = "كلمة المرور",
                            keyboardType = KeyboardType.Password,
                            visual = if (showPassword) VisualTransformation.None
                            else PasswordVisualTransformation(),
                            trailing = {
                                IconButton(onClick = { showPassword = !showPassword }) {
                                    Icon(
                                        if (showPassword) Icons.Rounded.VisibilityOff
                                        else Icons.Rounded.Visibility,
                                        "إظهار كلمة المرور",
                                        tint = colors.inkMuted
                                    )
                                }
                            }
                        )

                        Spacer(Modifier.height(18.dp))
                        Button(
                            onClick = {
                                if (tab == 0) vm.signIn(email.trim(), password)
                                else vm.signUp(email.trim(), password)
                            },
                            enabled = !busy && email.isNotBlank() && password.length >= 6,
                            modifier = Modifier.fillMaxWidth().height(54.dp),
                            shape = RoundedCornerShape(18.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.ink,
                                contentColor = colors.background
                            )
                        ) {
                            if (busy) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = colors.background,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    if (tab == 0) "دخول" else "إنشاء الحساب",
                                    style = MaterialTheme.typography.titleSmall
                                )
                            }
                        }

                        if (tab == 0) {
                            TextButton(
                                onClick = { vm.resetPassword(email.trim()) },
                                enabled = !busy && email.isNotBlank(),
                                modifier = Modifier.align(Alignment.CenterHorizontally)
                            ) {
                                Text("نسيت كلمة المرور؟", color = colors.accent)
                            }
                        } else {
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "كلمة المرور ستة أحرف فأكثر. بإنشاء الحساب توافق على أن " +
                                    "تُحفظ مهامك مشفّرةً في الخادم لتتمكن من فتحها من أي جهاز.",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                    }
                }
            }

            item {
                SoftCard(Modifier.fillMaxWidth(), color = colors.tileSand, corner = 24.dp, elevation = 0.dp) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        Text(
                            "لماذا الحساب؟",
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.ink,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(10.dp))
                        listOf(
                            "مهامك تُفتح من أي هاتف بنفس البريد وكلمة المرور.",
                            "إن فقدت جهازك تبقى المهام والمشاريع محفوظة.",
                            "التطبيق يعمل دون إنترنت، والمزامنة تحدث عند توفره.",
                            "يمكنك حذف الحساب وكل بياناته من هنا في أي وقت."
                        ).forEach {
                            Row(Modifier.padding(vertical = 4.dp)) {
                                Text("•", color = colors.accent)
                                Spacer(Modifier.width(8.dp))
                                Text(it, style = MaterialTheme.typography.bodySmall, color = colors.inkSoft)
                            }
                        }
                    }
                }
            }
        }

        // ---------- إجراءات الحساب ----------
        if (session.signedIn) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 26.dp) {
                    Column(Modifier.fillMaxWidth().padding(6.dp)) {
                        AccountAction(
                            icon = Icons.Rounded.Logout,
                            title = "تسجيل الخروج",
                            subtitle = "تبقى نسخة المهام على هذا الجهاز",
                            tint = colors.ink,
                            enabled = !busy
                        ) { vm.signOut() }
                        AccountAction(
                            icon = Icons.Rounded.DeleteForever,
                            title = "حذف الحساب نهائياً",
                            subtitle = "يُحذف الحساب وكل بياناته من الخادم",
                            tint = AccentRed,
                            enabled = !busy
                        ) { confirmDelete = true }
                    }
                }
            }
        }

        // ---------- إعدادات الخادم ----------
        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, elevation = 4.dp) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                "خادم المزامنة",
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.ink,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                if (configured) "مُعدّ وجاهز" else "غير مُعدّ — التطبيق يعمل محلياً",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (configured) AccentGreen else colors.inkMuted
                            )
                        }
                        TextButton(onClick = { showAdvanced = !showAdvanced }) {
                            Text(if (showAdvanced) "إخفاء" else "إعداد", color = colors.accent)
                        }
                    }

                    AnimatedVisibility(
                        visible = showAdvanced,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column(Modifier.fillMaxWidth().padding(top = 14.dp)) {
                            MahamiField(
                                value = serverUrl,
                                onValueChange = { serverUrl = it },
                                label = "رابط الخادم (Supabase URL)",
                                keyboardType = KeyboardType.Uri
                            )
                            Spacer(Modifier.height(10.dp))
                            MahamiField(
                                value = serverKey,
                                onValueChange = { serverKey = it },
                                label = "المفتاح العام (anon key)",
                                keyboardType = KeyboardType.Text
                            )
                            Spacer(Modifier.height(12.dp))
                            Button(
                                onClick = { vm.setSyncServer(serverUrl, serverKey) },
                                enabled = serverUrl.isNotBlank() && serverKey.isNotBlank(),
                                modifier = Modifier.fillMaxWidth().height(46.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = colors.surfaceMuted,
                                    contentColor = colors.ink
                                )
                            ) { Text("حفظ", style = MaterialTheme.typography.labelLarge) }
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "خطوات إنشاء الخادم مشروحة في ملف SYNC-SETUP.md داخل المشروع. " +
                                    "النسخة المنشورة في المتجر تأتي بالخادم مضبوطاً مسبقاً.",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                    }
                }
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            containerColor = colors.surface,
            titleContentColor = colors.ink,
            textContentColor = colors.inkSoft,
            title = { Text("حذف الحساب نهائياً؟") },
            text = {
                Text(
                    "سيُحذف حسابك وكل مهامك المحفوظة في الخادم ولا يمكن التراجع. " +
                        "نسخة المهام الموجودة على هذا الجهاز تبقى كما هي."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    vm.deleteAccount()
                }) { Text("احذف", color = AccentRed) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) {
                    Text("إلغاء", color = colors.inkMuted)
                }
            }
        )
    }
}

@Composable
private fun SyncBadge(running: Boolean, signedIn: Boolean, error: Boolean) {
    val colors = MahamiTheme.colors
    val spin by animateFloatAsState(
        targetValue = if (running) 360f else 0f,
        animationSpec = tween(900),
        label = "syncSpin"
    )
    val icon = when {
        running -> Icons.Rounded.CloudSync
        !signedIn || error -> Icons.Rounded.CloudOff
        else -> Icons.Rounded.CloudDone
    }
    val tint = when {
        error -> AccentRed
        running -> colors.accent
        signedIn -> AccentGreen
        else -> colors.onFeatureMuted
    }
    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(colors.featureSoft),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp).rotate(spin))
    }
}

@Composable
private fun FeatureStat(modifier: Modifier = Modifier, value: String, label: String) {
    val colors = MahamiTheme.colors
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(colors.featureSoft)
            .padding(vertical = 12.dp, horizontal = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            value,
            style = MaterialTheme.typography.titleSmall,
            color = colors.onFeature,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(2.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = colors.onFeatureMuted)
    }
}

@Composable
private fun AccountAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    tint: Color,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(tint.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) { Icon(icon, null, tint = tint, modifier = Modifier.size(19.dp)) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge, color = tint)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
            }
        }
    }
}

@Composable
private fun MahamiField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    visual: VisualTransformation = VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null
) {
    val colors = MahamiTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        visualTransformation = visual,
        trailingIcon = trailing,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = colors.accent,
            unfocusedBorderColor = colors.hairline,
            focusedLabelColor = colors.accent,
            unfocusedLabelColor = colors.inkMuted,
            focusedTextColor = colors.ink,
            unfocusedTextColor = colors.ink,
            cursorColor = colors.accent
        )
    )
}

private fun relative(epochMillis: Long): String {
    val time = Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault())
    val minutes = (System.currentTimeMillis() - epochMillis) / 60_000
    return when {
        minutes < 1 -> "الآن"
        minutes < 60 -> "قبل $minutes د"
        minutes < 1440 -> "قبل ${minutes / 60} س"
        else -> time.format(stampFormatter)
    }
}
