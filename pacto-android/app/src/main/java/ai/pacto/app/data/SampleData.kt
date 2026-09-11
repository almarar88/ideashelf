package ai.pacto.app.data

import ai.pacto.app.domain.model.Addendum
import ai.pacto.app.domain.model.CaptureSource
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.DeadlineItem
import ai.pacto.app.domain.model.DeadlineKind
import ai.pacto.app.domain.model.DisputeCase
import ai.pacto.app.domain.model.EscrowAccount
import ai.pacto.app.domain.model.EvidenceItem
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.GeoPoint
import ai.pacto.app.domain.model.IdentityProof
import ai.pacto.app.domain.model.LedgerEntry
import ai.pacto.app.domain.model.LedgerEntryType
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Party
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.Priority
import ai.pacto.app.domain.model.TermKind
import ai.pacto.app.domain.model.VerificationMethod

/** First-run contract book so every screen has something real to show. */
object SampleData {

    private const val DAY = 24 * 60 * 60 * 1000L

    fun me(partyId: String, name: String) = Party(
        id = partyId,
        displayName = name,
        role = PartyRole.CLIENT,
        identity = IdentityProof(
            method = VerificationMethod.NFC_ID_WITH_BIOMETRIC,
            documentNumberMasked = "١٠٤٤••••٢٧",
            issuingCountry = "SA",
            verifiedAt = System.currentTimeMillis() - 30 * DAY,
            documentHash = "9f2c" + "0".repeat(60),
            biometricMatched = true
        ),
        trustScore = 82
    )

    fun seed(now: Long, partyId: String, myName: String, currency: String, feeBps: Int): List<Contract> {
        val me = me(partyId, myName)

        val technician = Party(
            id = "party_tech",
            displayName = "أبو سلطان - فني تكييف",
            role = PartyRole.PROVIDER,
            phone = "+9665••••1180",
            identity = IdentityProof(
                method = VerificationMethod.NFC_ID,
                documentNumberMasked = "٢٣٠١••••٥٥",
                issuingCountry = "SA",
                verifiedAt = now - 12 * DAY,
                documentHash = "a731" + "0".repeat(60)
            ),
            trustScore = 74
        )

        val carpenter = Party(
            id = "party_kitchen",
            displayName = "ورشة النجارة الحديثة",
            role = PartyRole.PROVIDER,
            identity = IdentityProof(method = VerificationMethod.MANUAL_ATTESTED, verifiedAt = now - 40 * DAY),
            trustScore = 68
        )

        val buyer = Party(
            id = "party_buyer",
            displayName = "مشتري اللابتوب",
            role = PartyRole.CLIENT
        )

        val ac = Contract(
            id = "contract_ac",
            title = "صيانة مكيفات الشقة",
            createdAt = now - 3 * DAY,
            status = ContractStatus.ACTIVE,
            source = CaptureSource.VOICE_SESSION,
            parties = listOf(me, technician),
            terms = listOf(
                ContractTerm(TermKind.SCOPE, "يلتزم المنفذ بصيانة أربع وحدات تكييف سبليت وتنظيف الفلاتر وشحن الفريون عند الحاجة."),
                ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد 1,200 $currency شاملاً أجرة العمل."),
                ContractTerm(TermKind.MATERIALS, "تكون قطع الغيار والمواد على حساب الطرف الطالب، ولا تُشترى إلا بموافقته المسبقة موثقة داخل التطبيق."),
                ContractTerm(TermKind.PAYMENT_SCHEDULE, "يُدفع عربون بقيمة 300 $currency عند التوقيع ويُخصم من الإجمالي."),
                ContractTerm(TermKind.DEADLINE, "يلتزم المنفذ بإنجاز العمل خلال 3 أيام من تاريخ التوقيع."),
                ContractTerm(TermKind.WARRANTY, "مدة الضمان 30 يوماً من تاريخ التسليم تشمل إصلاح العيوب دون مقابل.")
            ),
            total = Money.ofMajor(1200.0, currency),
            milestones = listOf(
                Milestone(
                    id = "ms_ac_1",
                    title = "العربون عند التوقيع",
                    amount = Money.ofMajor(300.0, currency),
                    dueAt = now - 3 * DAY,
                    status = MilestoneStatus.RELEASED,
                    weight = 1,
                    deliveredAt = now - 3 * DAY,
                    releasedAt = now - 3 * DAY
                ),
                Milestone(
                    id = "ms_ac_2",
                    title = "إنهاء صيانة الوحدات الأربع",
                    amount = Money.ofMajor(900.0, currency),
                    dueAt = now + 6 * 60 * 60 * 1000L,
                    weight = 3,
                    requiresEvidence = true,
                    geoFence = GeoPoint(24.7136, 46.6753, "الشقة - حي الملقا", 120.0)
                )
            ),
            escrow = EscrowAccount(
                currency = currency,
                feeBasisPoints = feeBps,
                ledger = listOf(
                    LedgerEntry("led_ac_1", now - 3 * DAY, LedgerEntryType.DEPOSIT, Money.ofMajor(1200.0, currency), "تجميد مبلغ في الضمان"),
                    LedgerEntry("led_ac_2", now - 3 * DAY, LedgerEntryType.RELEASE, Money.ofMajor(296.25, currency), "إفراج عن دفعة: العربون عند التوقيع", "ms_ac_1"),
                    LedgerEntry("led_ac_3", now - 3 * DAY, LedgerEntryType.FEE, Money.ofMajor(3.75, currency), "عمولة المنصة", "ms_ac_1")
                )
            ),
            evidence = listOf(
                EvidenceItem(
                    id = "ev_ac_1",
                    kind = EvidenceKind.BEFORE_STATE,
                    capturedAt = now - 3 * DAY,
                    note = "حالة الوحدات قبل الصيانة - تراكم أتربة على الفلاتر",
                    contentHash = "c41d" + "0".repeat(60),
                    capturedByPartyId = partyId
                ),
                EvidenceItem(
                    id = "ev_ac_2",
                    kind = EvidenceKind.SERIAL_NUMBER,
                    capturedAt = now - 3 * DAY,
                    note = "الوحدة الرئيسية في الصالة",
                    serial = "AC-8842-XR",
                    contentHash = "77b9" + "0".repeat(60)
                )
            ),
            deadlines = listOf(
                DeadlineItem("dl_ac_1", DeadlineKind.DELIVERY, "تسليم صيانة المكيفات", now + 6 * 60 * 60 * 1000L, "ms_ac_2"),
                DeadlineItem("dl_ac_2", DeadlineKind.WARRANTY_EXPIRY, "انتهاء ضمان الصيانة", now + 33 * DAY)
            ),
            priority = Priority.URGENT,
            transcript = "الاتفاق على صيانة أربع مكيفات سبليت بمبلغ 1200 ريال، عربون 300 ريال، التسليم خلال 3 أيام، وقطع الغيار على صاحب الشقة، مع ضمان شهر.",
            sealedHash = "4b8f1d9a2c73e6",
            sealedAt = now - 3 * DAY
        )

        val kitchen = Contract(
            id = "contract_kitchen",
            title = "تركيب مطبخ تسليم مفتاح",
            createdAt = now - 12 * DAY,
            status = ContractStatus.ACTIVE,
            source = CaptureSource.CHAT_TEXT,
            parties = listOf(me, carpenter),
            terms = listOf(
                ContractTerm(TermKind.SCOPE, "التنفيذ بنظام تسليم المفتاح: يتحمل المنفذ المواد والعمالة وكل ما يلزم لتشغيل العمل دون مطالبات إضافية."),
                ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد 8,500 $currency."),
                ContractTerm(TermKind.DEADLINE, "يلتزم المنفذ بإنجاز العمل خلال 21 يوماً من تاريخ التوقيع."),
                ContractTerm(TermKind.PENALTY, "يُخصم 2% من قيمة العقد عن كل يوم تأخير بحد أقصى 20% من الإجمالي."),
                ContractTerm(TermKind.CANCELLATION, "عند الإلغاء يُحتسب المستحق بنسبة الإنجاز الموثقة، ويُرد الباقي للطرف الطالب خلال ثلاثة أيام.")
            ),
            total = Money.ofMajor(8500.0, currency),
            milestones = listOf(
                Milestone("ms_k_1", "القياسات والتصميم", Money.ofMajor(2000.0, currency), now - 10 * DAY, MilestoneStatus.RELEASED, 1, deliveredAt = now - 10 * DAY, releasedAt = now - 9 * DAY),
                Milestone("ms_k_2", "تصنيع الوحدات", Money.ofMajor(3500.0, currency), now + 2 * DAY, MilestoneStatus.DELIVERED, 2, deliveredAt = now - 1 * DAY, requiresEvidence = true, evidenceIds = listOf("ev_k_1")),
                Milestone("ms_k_3", "التركيب النهائي والتشغيل", Money.ofMajor(3000.0, currency), now + 9 * DAY, MilestoneStatus.PENDING, 2, requiresEvidence = true)
            ),
            escrow = EscrowAccount(
                currency = currency,
                feeBasisPoints = feeBps,
                ledger = listOf(
                    LedgerEntry("led_k_1", now - 12 * DAY, LedgerEntryType.DEPOSIT, Money.ofMajor(8500.0, currency), "تجميد مبلغ في الضمان"),
                    LedgerEntry("led_k_2", now - 9 * DAY, LedgerEntryType.RELEASE, Money.ofMajor(1975.0, currency), "إفراج عن دفعة: القياسات والتصميم", "ms_k_1"),
                    LedgerEntry("led_k_3", now - 9 * DAY, LedgerEntryType.FEE, Money.ofMajor(25.0, currency), "عمولة المنصة", "ms_k_1")
                )
            ),
            evidence = listOf(
                EvidenceItem("ev_k_1", EvidenceKind.AFTER_STATE, now - 1 * DAY, "الوحدات بعد التصنيع في الورشة", contentHash = "1a9e" + "0".repeat(60), milestoneId = "ms_k_2")
            ),
            addenda = listOf(
                Addendum(
                    id = "add_k_1",
                    createdAt = now - 5 * DAY,
                    transcript = "اتفقنا على إضافة رف علوي إضافي بمبلغ 350 ريال على نفس الموعد.",
                    changes = listOf(ContractTerm(TermKind.SCOPE, "يضاف رف علوي إضافي بنفس الخامة دون تمديد مدة التسليم.")),
                    amountDelta = Money.ofMajor(350.0, currency),
                    acceptedByPartyIds = listOf(partyId, "party_kitchen")
                )
            ),
            deadlines = listOf(
                DeadlineItem("dl_k_1", DeadlineKind.DELIVERY, "التركيب النهائي", now + 9 * DAY, "ms_k_3")
            ),
            priority = Priority.MEDIUM,
            transcript = "تركيب مطبخ تسليم مفتاح بمبلغ 8500 ريال على ثلاث دفعات خلال 21 يوم مع غرامة تأخير.",
            sealedHash = "77c0aa31be4592",
            sealedAt = now - 12 * DAY
        )

        val laptop = Contract(
            id = "contract_laptop",
            title = "بيع لابتوب مستعمل على الفحص",
            createdAt = now - 6 * 60 * 60 * 1000L,
            status = ContractStatus.AWAITING_SIGNATURE,
            source = CaptureSource.OVERLAY_BUBBLE,
            parties = listOf(me.copy(role = PartyRole.PROVIDER), buyer),
            terms = listOf(
                ContractTerm(TermKind.SCOPE, "بيع جهاز لابتوب مستعمل مع الشاحن الأصلي وحقيبة."),
                ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد 2,300 $currency."),
                ContractTerm(TermKind.INSPECTION, "البيع معلّق على نتيجة الفحص الفني خلال مدة محددة من التسليم، وللمشتري الحق في الاسترجاع الكامل إذا خالف الفحص الوصف المتفق عليه."),
                ContractTerm(TermKind.DEADLINE, "التسليم خلال يومين من التوقيع.")
            ),
            total = Money.ofMajor(2300.0, currency),
            milestones = listOf(
                Milestone("ms_l_1", "التسليم والفحص", Money.ofMajor(2300.0, currency), now + 2 * DAY, weight = 1, requiresEvidence = true)
            ),
            escrow = EscrowAccount(currency = currency, feeBasisPoints = feeBps),
            evidence = listOf(
                EvidenceItem("ev_l_1", EvidenceKind.SERIAL_NUMBER, now - 5 * 60 * 60 * 1000L, "الرقم التسلسلي أسفل الجهاز", serial = "5CD1289XQF", contentHash = "88fa" + "0".repeat(60)),
                EvidenceItem("ev_l_2", EvidenceKind.BEFORE_STATE, now - 5 * 60 * 60 * 1000L, "خدش خفيف على الحافة اليسرى", contentHash = "2be7" + "0".repeat(60))
            ),
            deadlines = listOf(
                DeadlineItem("dl_l_1", DeadlineKind.INSPECTION, "انتهاء مهلة الفحص", now + 4 * DAY)
            ),
            priority = Priority.NORMAL,
            transcript = "بيع اللابتوب بـ 2300 ريال على الفحص، التسليم خلال يومين."
        )

        val disputed = Contract(
            id = "contract_paint",
            title = "دهان غرفتين",
            createdAt = now - 20 * DAY,
            status = ContractStatus.IN_DISPUTE,
            source = CaptureSource.VOICE_SESSION,
            parties = listOf(
                me,
                Party("party_painter", "معلم الدهان", PartyRole.PROVIDER, trustScore = 51)
            ),
            terms = listOf(
                ContractTerm(TermKind.SCOPE, "دهان غرفتين بطبقتين مع معالجة الشقوق."),
                ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد 1,600 $currency."),
                ContractTerm(TermKind.DEADLINE, "الإنجاز خلال 4 أيام من التوقيع."),
                ContractTerm(TermKind.WARRANTY, "ضمان 60 يوماً على التقشر.")
            ),
            total = Money.ofMajor(1600.0, currency),
            milestones = listOf(
                Milestone("ms_p_1", "دهان الغرفتين", Money.ofMajor(1600.0, currency), now - 16 * DAY, MilestoneStatus.DELIVERED, 1, deliveredAt = now - 13 * DAY, requiresEvidence = true, evidenceIds = listOf("ev_p_2"))
            ),
            escrow = EscrowAccount(
                currency = currency,
                feeBasisPoints = feeBps,
                ledger = listOf(
                    LedgerEntry("led_p_1", now - 20 * DAY, LedgerEntryType.DEPOSIT, Money.ofMajor(1600.0, currency), "تجميد مبلغ في الضمان")
                )
            ),
            evidence = listOf(
                EvidenceItem("ev_p_1", EvidenceKind.BEFORE_STATE, now - 20 * DAY, "الجدران قبل الدهان", contentHash = "3312" + "0".repeat(60)),
                EvidenceItem("ev_p_2", EvidenceKind.AFTER_STATE, now - 13 * DAY, "بعد الانتهاء", contentHash = "9a01" + "0".repeat(60)),
                EvidenceItem("ev_p_3", EvidenceKind.DEFECT, now - 11 * DAY, "تفاوت لون في الزاوية وبقع على الأرضية", contentHash = "51cc" + "0".repeat(60))
            ),
            dispute = DisputeCase(
                id = "dsp_1",
                openedByPartyId = partyId,
                openedAt = now - 10 * DAY,
                claim = "العمل سُلّم متأخراً ثلاثة أيام وبه تفاوت في اللون في زاوية الغرفة الأولى."
            ),
            priority = Priority.URGENT,
            transcript = "دهان غرفتين بـ 1600 ريال خلال 4 أيام مع ضمان شهرين."
        )

        val completed = Contract(
            id = "contract_move",
            title = "نقل أثاث داخل المدينة",
            createdAt = now - 60 * DAY,
            status = ContractStatus.COMPLETED,
            source = CaptureSource.MANUAL,
            parties = listOf(me, Party("party_mover", "شركة النقل السريع", PartyRole.PROVIDER, trustScore = 88)),
            terms = listOf(
                ContractTerm(TermKind.SCOPE, "نقل أثاث شقة من حي النرجس إلى حي الياسمين مع الفك والتركيب."),
                ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد 900 $currency.")
            ),
            total = Money.ofMajor(900.0, currency),
            milestones = listOf(
                Milestone("ms_m_1", "النقل والتركيب", Money.ofMajor(900.0, currency), now - 58 * DAY, MilestoneStatus.RELEASED, 1, deliveredAt = now - 59 * DAY, releasedAt = now - 58 * DAY)
            ),
            escrow = EscrowAccount(
                currency = currency,
                feeBasisPoints = feeBps,
                ledger = listOf(
                    LedgerEntry("led_m_1", now - 60 * DAY, LedgerEntryType.DEPOSIT, Money.ofMajor(900.0, currency), "تجميد مبلغ في الضمان"),
                    LedgerEntry("led_m_2", now - 58 * DAY, LedgerEntryType.RELEASE, Money.ofMajor(888.75, currency), "إفراج عن دفعة: النقل والتركيب", "ms_m_1"),
                    LedgerEntry("led_m_3", now - 58 * DAY, LedgerEntryType.FEE, Money.ofMajor(11.25, currency), "عمولة المنصة", "ms_m_1")
                )
            ),
            priority = Priority.NORMAL,
            sealedHash = "0d22ff81aa7c40",
            sealedAt = now - 60 * DAY
        )

        return listOf(ac, kitchen, laptop, disputed, completed)
    }
}
