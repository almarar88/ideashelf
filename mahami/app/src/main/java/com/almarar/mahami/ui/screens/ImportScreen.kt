package com.almarar.mahami.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.smart.ParsedTask
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.MahamiTheme

/**
 * استيراد دفعة مهام من نص: ملاحظة، رسالة واتساب، أو بريد مُشارَك مع التطبيق.
 * كل سطر يمر على المحلّل الذكي ثم يختار المستخدم ما يريد إضافته.
 */
@Composable
fun ImportScreen(vm: MahamiViewModel, onBack: () -> Unit, onDone: () -> Unit) {
    val colors = MahamiTheme.colors
    val candidates by vm.importCandidates.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    var raw by remember { mutableStateOf("") }
    val skipped = remember { mutableStateListOf<Int>() }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") {
                    vm.clearImport()
                    onBack()
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("استيراد مهام", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Text(
                        "الصق نصاً أو شارِك رسالة مع مهامي",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        if (candidates.isEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 26.dp) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        OutlinedTextField(
                            value = raw,
                            onValueChange = { raw = it },
                            label = { Text("ألصق النص هنا — كل سطر مهمة") },
                            modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
                            shape = RoundedCornerShape(18.dp),
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
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            TextButton(onClick = {
                                clipboard.getText()?.text?.let { raw = it }
                            }) {
                                Icon(Icons.Rounded.ContentPaste, null, tint = colors.accent, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("لصق من الحافظة", color = colors.accent)
                            }
                            Spacer(Modifier.weight(1f))
                            Button(
                                onClick = { skipped.clear(); vm.prepareImport(raw) },
                                enabled = raw.isNotBlank(),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = colors.ink,
                                    contentColor = colors.background
                                )
                            ) { Text("حلّل النص") }
                        }
                    }
                }
            }

            item {
                SoftCard(Modifier.fillMaxWidth(), color = colors.tileSand, corner = 24.dp, elevation = 0.dp) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        Text(
                            "أمثلة يفهمها المحلّل",
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.ink,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(8.dp))
                        listOf(
                            "تسليم التقرير الأربعاء القادم الساعة 10 عاجل #تقارير",
                            "اجتماع منصة التسجيل 16-09-2026 مع أ. سالم (45د)",
                            "مراجعة ملفات المدربين بعد 3 أيام @التدريب"
                        ).forEach {
                            Text(
                                "• $it",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkSoft,
                                modifier = Modifier.padding(vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        } else {
            item {
                Text(
                    "وجدنا ${Ar.countTasks(candidates.size)} — ألغِ ما لا تريده",
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.inkSoft
                )
            }
            items(candidates.size) { index ->
                val parsed = candidates[index]
                CandidateCard(
                    parsed = parsed,
                    selected = index !in skipped,
                    onToggle = { if (index in skipped) skipped.remove(index) else skipped.add(index) }
                )
            }
        }
    }

    if (candidates.isNotEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TextButton(
                    onClick = { vm.clearImport(); skipped.clear() },
                    modifier = Modifier.height(54.dp)
                ) { Text("إلغاء", color = colors.inkMuted) }
                Button(
                    onClick = {
                        val chosen = candidates.filterIndexed { i, _ -> i !in skipped }
                        vm.confirmImport(chosen) { onDone() }
                    },
                    enabled = skipped.size < candidates.size,
                    modifier = Modifier.weight(1f).height(54.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.accent,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        "أضف ${Ar.countTasks(candidates.size - skipped.size)}",
                        style = MaterialTheme.typography.titleSmall
                    )
                }
            }
        }
    }
}

@Composable
private fun CandidateCard(parsed: ParsedTask, selected: Boolean, onToggle: () -> Unit) {
    val colors = MahamiTheme.colors
    val scale by animateFloatAsState(if (selected) 1f else 0.97f, tween(180), label = "candidate")

    SoftCard(
        Modifier.fillMaxWidth().scale(scale),
        color = if (selected) colors.surface else colors.surfaceMuted,
        corner = 24.dp,
        elevation = if (selected) 8.dp else 0.dp,
        onClick = onToggle
    ) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(if (selected) colors.accent else Color.Transparent)
                    .clickable { onToggle() },
                contentAlignment = Alignment.Center
            ) {
                if (selected) Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(15.dp))
                else Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(colors.hairline)
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    parsed.title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (selected) colors.ink else colors.inkMuted,
                    fontWeight = FontWeight.Medium
                )
                if (parsed.matches.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        parsed.matches.forEach { chip ->
                            Text(
                                chip.label,
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.accent,
                                modifier = Modifier
                                    .padding(top = 4.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(colors.accent.copy(alpha = 0.10f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
