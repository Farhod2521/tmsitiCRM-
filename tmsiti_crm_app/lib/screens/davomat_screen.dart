import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/arrived_row.dart';
import '../models/attendance.dart';
import '../models/attendance_note.dart';
import '../models/auth_user.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../theme/app_colors.dart';
import 'face_verify_screen.dart';

/// Ariza oynasini ochadi (Davomat bo'limi va "+" tezkor amallar uchun umumiy).
Future<AttendanceNote?> showAttendanceNoteSheet(BuildContext context) {
  return showModalBottomSheet<AttendanceNote>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _NoteSheet(),
  );
}

class DavomatScreen extends StatefulWidget {
  final AuthUser user;
  const DavomatScreen({super.key, required this.user});

  @override
  State<DavomatScreen> createState() => DavomatScreenState();
}

class DavomatScreenState extends State<DavomatScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  final _myTabKey = GlobalKey<_MyAttendanceTabState>();

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  /// "+" -> "Ishga keldim": "Mening davomatim" yorlig'iga o'tib, darhol
  /// yuz/joylashuv tekshiruvini boshlaydi (bugun belgilangan bo'lmasa).
  Future<void> startCheckIn() async {
    _tabs.animateTo(1);
    // TabBarView yorliqni o'tish animatsiyasidan keyin quradi
    await Future.delayed(const Duration(milliseconds: 400));
    await _myTabKey.currentState?.checkInIfNeeded();
  }

  /// "+" -> "Ariza qoldirish": ariza yuborilgach "Mening davomatim"ni yangilaydi.
  void onNoteCreated(AttendanceNote note) {
    _myTabKey.currentState?.setNote(note);
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return Scaffold(
        backgroundColor: AppColors.surface,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Davomat',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                margin: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: TabBar(
                  controller: _tabs,
                  indicator: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.all(Radius.circular(10)),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicatorPadding: EdgeInsets.zero,
                  dividerColor: Colors.transparent,
                  labelColor: Colors.white,
                  unselectedLabelColor: AppColors.muted,
                  labelStyle: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
                  ),
                  unselectedLabelStyle: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                  splashBorderRadius: BorderRadius.all(Radius.circular(10)),
                  tabs: const [
                    Tab(height: 42, text: 'Kelganlar'),
                    Tab(height: 42, text: 'Mening davomatim'),
                  ],
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    const _ArrivedTodayTab(),
                    _MyAttendanceTab(key: _myTabKey, user: user),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }
}

// ─── Tab 1: Bugun kelganlar ─────────────────────────────────────────────────

class _ArrivedTodayTab extends StatefulWidget {
  const _ArrivedTodayTab();

  @override
  State<_ArrivedTodayTab> createState() => _ArrivedTodayTabState();
}

class _ArrivedTodayTabState extends State<_ArrivedTodayTab>
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {
  bool _loading = true;
  List<ArrivedRow> _rows = [];
  Uint8List? _dayPhoto;
  late final AnimationController _borderCtrl;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _borderCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
    _load();
  }

  @override
  void dispose() {
    _borderCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await ApiService.todayList();
      if (!mounted) return;
      setState(() => _rows = rows);
      if (rows.isNotEmpty) {
        _loadDayPhoto();
      } else {
        setState(() => _dayPhoto = null);
      }
    } catch (_) {
      // jim — pastda bo'sh holat ko'rsatiladi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadDayPhoto() async {
    try {
      final b64 = await ApiService.dayEmployeePhoto();
      if (!mounted) return;
      // Rasm bo'lmasa eski (boshqa xodimning) rasmini tozalaymiz
      setState(() => _dayPhoto = (b64 == null || !b64.contains(','))
          ? null
          : base64Decode(b64.split(',').last));
    } catch (_) {
      // jim — trofey belgisi fallback sifatida ko'rsatiladi
    }
  }

  Color _lateColor(int? late) {
    if (late == null) return AppColors.muted;
    if (late <= 0) return AppColors.success;
    if (late <= 15) return AppColors.lateAmber;
    return AppColors.danger;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final today = DateFormat('d MMMM, EEEE', 'uz').format(DateTime.now());

    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Text(
            today,
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
          const SizedBox(height: 16),

          if (_rows.isNotEmpty) _buildDayEmployeeCard(_rows.first),

          const SizedBox(height: 20),
          Text(
            'Bugun kelganlar (${_rows.length})',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 12),

          if (_rows.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 40),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Text(
                'Hali hech kim ishga kelmagan',
                style: TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            )
          else
            ..._rows.asMap().entries.map((entry) {
              final i = entry.key;
              final r = entry.value;
              final color = _lateColor(r.lateMinutes);
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 26,
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                    Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        _initials(r.fullName),
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            r.fullName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5,
                              color: AppColors.ink,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (r.department != null)
                            Text(
                              r.department!,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.muted,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                    Text(
                      r.checkInLocal ?? '--:--',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        color: color,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  static const _gold = [
    Color(0xFFFFD700),
    Color(0xFFFFF6D6),
    Color(0xFFB8860B),
    Color(0xFFFFE87A),
    Color(0xFFFFD700),
  ];

  Widget _buildDayEmployeeCard(ArrivedRow first) {
    final content = Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFE9F3FF), // ochiq havorang
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3C4),
              shape: BoxShape.circle,
              image: _dayPhoto != null
                  ? DecorationImage(
                      image: MemoryImage(_dayPhoto!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: _dayPhoto == null
                ? const Icon(
                    Icons.emoji_events_rounded,
                    color: Color(0xFFB8860B),
                    size: 28,
                  )
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "KUN XODIMI",
                  style: TextStyle(
                    color: Color(0xFFB8860B),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  first.fullName,
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (first.department != null)
                  Text(
                    first.department!,
                    style: const TextStyle(
                      color: AppColors.mutedText,
                      fontSize: 12.5,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Text(
            first.checkInLocal ?? '--:--',
            style: const TextStyle(
              color: AppColors.primary,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );

    return AnimatedBuilder(
      animation: _borderCtrl,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: SweepGradient(
              transform: GradientRotation(_borderCtrl.value * 2 * math.pi),
              colors: _gold,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33FFD700),
                blurRadius: 18,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: child,
        );
      },
      child: content,
    );
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((s) => s.isNotEmpty)
        .toList();
    return parts.take(2).map((s) => s[0]).join().toUpperCase();
  }
}

// ─── Tab 2: Mening davomatim (shaxsiy check-in) ─────────────────────────────

class _MyAttendanceTab extends StatefulWidget {
  final AuthUser user;
  const _MyAttendanceTab({super.key, required this.user});

  @override
  State<_MyAttendanceTab> createState() => _MyAttendanceTabState();
}

class _MyAttendanceTabState extends State<_MyAttendanceTab>
    with AutomaticKeepAliveClientMixin {
  bool _loading = true;
  bool _checkingIn = false;
  AttendanceRecord? _today;
  OfficeInfo? _office;
  List<AttendanceRecord> _month = [];
  Map<int, String> _holidays = {};
  AttendanceNote? _myNote;
  String? _error;

  @override
  bool get wantKeepAlive => true;

  Future<void>? _loadFuture;

  @override
  void initState() {
    super.initState();
    _loadFuture = _load();
  }

  /// "+" tezkor amalidan: ma'lumot yuklanishini kutib, bugun hali
  /// belgilanmagan bo'lsa "Ishga keldim" jarayonini boshlaydi.
  Future<void> checkInIfNeeded() async {
    await _loadFuture;
    if (!mounted || _checkingIn || _today != null) return;
    await _handleCheckIn();
  }

  void setNote(AttendanceNote note) {
    if (mounted) setState(() => _myNote = note);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final now = DateTime.now();
    try {
      final results = await Future.wait([
        ApiService.today(),
        ApiService.office(),
        ApiService.myMonth(now.year, now.month),
        ApiService.myNote(),
      ]);
      if (!mounted) return;
      setState(() {
        _today = results[0] as AttendanceRecord?;
        _office = results[1] as OfficeInfo;
        _month = results[2] as List<AttendanceRecord>;
        _myNote = results[3] as AttendanceNote?;
      });
      // Bayramlar alohida — server hali yangilanmagan bo'lsa ham ekran ishlasin
      final hs = await ApiService.holidays(now.year, now.month);
      if (mounted) setState(() => _holidays = hs);
    } catch (_) {
      // jim — pastda "Ishga keldim" tugmasi baribir ishlayveradi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openNoteSheet() async {
    final result = await showAttendanceNoteSheet(context);
    if (result != null && mounted) setState(() => _myNote = result);
  }

  Future<void> _handleCheckIn() async {
    setState(() => _error = null);

    // 1) Avval kamera orqali yuzni profil rasmi bilan solishtirib tasdiqlaymiz
    // (web'dagi kabi) — faqat shundan keyin joylashuv tekshiriladi.
    final verified = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => FaceVerifyScreen(employeeId: widget.user.id),
        fullscreenDialog: true,
      ),
    );
    if (verified != true) return;

    setState(() => _checkingIn = true);
    try {
      final pos = await LocationService.getCurrentPosition();
      final rec = await ApiService.checkIn(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() => _today = rec);
      await _load();
    } catch (e) {
      setState(
        () => _error = e
            .toString()
            .replaceFirst('ApiException: ', '')
            .replaceFirst('LocationException: ', ''),
      );
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final today = DateFormat('d MMMM, EEEE', 'uz').format(DateTime.now());

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Text(
                  today,
                  style: const TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 16),

                if (_today == null) ...[
                  _buildCheckInButton(),
                  const SizedBox(height: 14),
                ],
                _TimeAnalysisCard(month: _month, today: _today, holidays: _holidays),

                const SizedBox(height: 14),
                _buildNoteSection(),

                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],

                if (_office != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 15,
                        color: AppColors.muted,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          "Ish joyi radiusi: ${_office!.radiusM.toInt()} m · Ish boshlanishi: ${_office!.workStart}",
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 28),
                const Text(
                  'Bu oy',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 12),
                _buildMonthList(),
              ],
            ),
    );
  }

  Widget _buildCheckInButton() {
    return GestureDetector(
      onTap: _checkingIn ? null : _handleCheckIn,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.35),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: _checkingIn
                  ? const SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Icon(
                      Icons.fingerprint,
                      color: Colors.white,
                      size: 34,
                    ),
            ),
            const SizedBox(height: 14),
            Text(
              _checkingIn ? 'Joylashuv aniqlanmoqda...' : 'Ishga keldim',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Yuzingiz va joylashuvingiz tekshiriladi',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMonthList() {
    if (_month.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 30),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: const Text(
          'Bu oyda hali davomat yo\'q',
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      );
    }

    final sorted = [..._month]..sort((a, b) => b.date.compareTo(a.date));

    return Column(
      children: sorted.map((r) {
        // Ariza tasdiqlangan bo'lsa kechikish hisobga olinmaydi
        final late = r.lateExcused ? 0 : r.lateMinutes;
        final color = late <= 0
            ? AppColors.success
            : (late <= 15 ? AppColors.lateAmber : AppColors.danger);
        final dateLabel = DateFormat(
          'd MMMM, EEEE',
          'uz',
        ).format(DateTime.parse(r.date));
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  dateLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                    color: AppColors.ink,
                  ),
                ),
              ),
              Text(
                r.checkInLocal ?? '--:--',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                  color: color,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  static const _noteTypeLabel = {
    'obyektda': 'Obyektda',
    'kechikish': 'Kechikaman',
    'kelmaslik': 'Kelmayman',
    'ruxsat': "Ruxsat so'ragan",
  };
  static const _noteTypeColor = {
    'obyektda': AppColors.primary,
    'kechikish': AppColors.lateAmber,
    'kelmaslik': AppColors.danger,
    'ruxsat': AppColors.purple,
  };

  String _fmtDateUzStr(String iso) {
    final p = iso.split('-');
    return '${p[2]}.${p[1]}.${p[0]}';
  }

  Widget _buildNoteSection() {
    if (_myNote == null) {
      return GestureDetector(
        onTap: _openNoteSheet,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.divider),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.edit_note_rounded,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Ariza qoldirish',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.ink,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      );
    }

    final color = _noteTypeColor[_myNote!.noteType] ?? AppColors.primary;
    final label = _noteTypeLabel[_myNote!.noteType] ?? _myNote!.noteType;
    final dateLabel = _myNote!.dateFrom == _myNote!.dateTo
        ? _fmtDateUzStr(_myNote!.dateFrom)
        : '${_fmtDateUzStr(_myNote!.dateFrom)} — ${_fmtDateUzStr(_myNote!.dateTo)}';

    return GestureDetector(
      onTap: _openNoteSheet,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.3),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.report_gmailerrorred_rounded,
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    dateLabel,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

// ─── Davomat arizasi — bottom sheet ─────────────────────────────────────────

class _NoteSheet extends StatefulWidget {
  const _NoteSheet();

  @override
  State<_NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends State<_NoteSheet> {
  String _type = 'obyektda';
  DateTime _dateFrom = DateTime.now();
  DateTime _dateTo = DateTime.now();
  TimeOfDay? _expectedTime;
  TimeOfDay? _objFrom;
  TimeOfDay? _objTo;
  double? _objLat;
  double? _objLng;
  bool _locating = false;
  final _textCtrl = TextEditingController();
  bool _saving = false;
  String? _error;

  static const _typeLabel = {
    'obyektda': 'Obyektga chiqdim',
    'ruxsat': 'Ruxsat so\'rash',
    'kechikish': 'Kech kelaman',
    'kelmaslik': 'Kelmayman',
  };
  static const _typeColor = {
    'obyektda': AppColors.primary,
    'ruxsat': AppColors.purple,
    'kechikish': AppColors.lateAmber,
    'kelmaslik': AppColors.danger,
  };

  // "obyektda" va "ruxsat" — ikkalasi ham vaqt oralig'i (soatdan-soatgacha) so'raydi.
  bool get _needsTimeRange => _type == 'obyektda' || _type == 'ruxsat';

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  String _fmtDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
  String _fmtDateUz(DateTime d) => DateFormat('dd.MM.yyyy').format(d);
  String _fmtTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Future<void> _pickDate({required bool isFrom}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? _dateFrom : _dateTo,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _dateFrom = picked;
        if (_dateTo.isBefore(_dateFrom)) _dateTo = _dateFrom;
      } else {
        _dateTo = picked;
      }
    });
  }

  Future<void> _pickTime(String field) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked == null) return;
    setState(() {
      if (field == 'expected') _expectedTime = picked;
      if (field == 'objFrom') _objFrom = picked;
      if (field == 'objTo') _objTo = picked;
    });
  }

  Future<void> _getLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final pos = await LocationService.getCurrentPosition();
      setState(() {
        _objLat = pos.latitude;
        _objLng = pos.longitude;
      });
    } catch (e) {
      setState(
        () => _error = e.toString().replaceFirst('LocationException: ', ''),
      );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_dateTo.isBefore(_dateFrom)) {
      setState(
        () => _error =
            "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final note = await ApiService.submitNote(
        noteType: _type,
        dateFrom: _fmtDate(_dateFrom),
        dateTo: _fmtDate(_dateTo),
        expectedTime: _type == 'kechikish' && _expectedTime != null
            ? _fmtTime(_expectedTime!)
            : null,
        objectTimeFrom: _needsTimeRange && _objFrom != null
            ? _fmtTime(_objFrom!)
            : null,
        objectTimeTo: _needsTimeRange && _objTo != null
            ? _fmtTime(_objTo!)
            : null,
        objectLatitude: _type == 'obyektda' ? _objLat : null,
        objectLongitude: _type == 'obyektda' ? _objLng : null,
        text: _textCtrl.text.trim().isEmpty ? null : _textCtrl.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(note);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('ApiException: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateBox(String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.divider),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: AppColors.ink,
              ),
            ),
            const Icon(
              Icons.calendar_today_outlined,
              size: 15,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }

  Widget _timeBox(TimeOfDay? t, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.divider),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              t != null ? _fmtTime(t) : '--:--',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: AppColors.ink,
              ),
            ),
            const Icon(
              Icons.access_time_rounded,
              size: 15,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.72,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Davomat arizasi',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'Holatingizni tanlang',
                  style: TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 16),

                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2.6,
                  children: ['obyektda', 'ruxsat', 'kechikish', 'kelmaslik']
                      .map((t) {
                        final active = _type == t;
                        final color = _typeColor[t]!;
                        return GestureDetector(
                          onTap: () => setState(() => _type = t),
                          child: Container(
                            decoration: BoxDecoration(
                              color: active ? color : AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: active ? color : AppColors.divider,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              _typeLabel[t]!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: active
                                    ? Colors.white
                                    : AppColors.mutedText,
                              ),
                            ),
                          ),
                        );
                      })
                      .toList(),
                ),

                const SizedBox(height: 20),
                const Text(
                  'Qaysi sana(lar) uchun?',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.muted,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _dateBox(
                        _fmtDateUz(_dateFrom),
                        () => _pickDate(isFrom: true),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        '—',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Expanded(
                      child: _dateBox(
                        _fmtDateUz(_dateTo),
                        () => _pickDate(isFrom: false),
                      ),
                    ),
                  ],
                ),

                if (_type == 'kechikish') ...[
                  const SizedBox(height: 18),
                  const Text(
                    "Taxminan soat nechida yetib kelasiz? (ixtiyoriy)",
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _timeBox(_expectedTime, () => _pickTime('expected')),
                ],

                if (_type == 'obyektda') ...[
                  const SizedBox(height: 18),
                  const Text(
                    "Soat nechidan-nechigacha obyektda bo'lasiz? (ixtiyoriy)",
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _timeBox(_objFrom, () => _pickTime('objFrom')),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          '—',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      Expanded(
                        child: _timeBox(_objTo, () => _pickTime('objTo')),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: _locating ? null : _getLocation,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _objLat != null
                            ? AppColors.success.withValues(alpha: 0.1)
                            : AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _objLat != null
                              ? AppColors.success.withValues(alpha: 0.35)
                              : AppColors.divider,
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _locating
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                )
                              : Icon(
                                  _objLat != null
                                      ? Icons.check_circle_rounded
                                      : Icons.my_location_rounded,
                                  size: 15,
                                  color: _objLat != null
                                      ? AppColors.success
                                      : AppColors.primary,
                                ),
                          const SizedBox(width: 8),
                          Text(
                            _locating
                                ? 'Joylashuv aniqlanmoqda...'
                                : (_objLat != null
                                      ? 'Joylashuv olindi'
                                      : "Turgan joyimni yuborish (ixtiyoriy)"),
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                              color: _objLat != null
                                  ? AppColors.success
                                  : AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                if (_type == 'ruxsat') ...[
                  const SizedBox(height: 18),
                  const Text(
                    "Soat nechidan-nechigacha ruxsat so'raysiz? (ixtiyoriy)",
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _timeBox(_objFrom, () => _pickTime('objFrom')),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          '—',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      Expanded(
                        child: _timeBox(_objTo, () => _pickTime('objTo')),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 18),
                TextField(
                  controller: _textCtrl,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13.5, color: AppColors.ink),
                  decoration: InputDecoration(
                    hintText: 'Sababini yozing (ixtiyoriy)...',
                    hintStyle: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                    ),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                ],

                const SizedBox(height: 20),
                GestureDetector(
                  onTap: _saving ? null : _submit,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: _typeColor[_type],
                      borderRadius: BorderRadius.circular(14),
                    ),
                    alignment: Alignment.center,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Text(
                            'Yuborish',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// "Mening davomatim" tepasidagi "Ishlash vaqti tahlili" kartochkasi — veb'dagi
/// oylik hisobot (reports/monthly) bilan bir xil hisob, `my-month` ma'lumotidan:
/// jami ish soati = kelgan kunlar * 8 soat, samarali = jami - kechikishlar,
/// halqa maxraji = shu oyning barcha ish kunlari * 8 soat.
/// Kadr tasdiqlagan arizali kechikish hisobga olinmaydi (tabel bilan bir xil).
class _TimeAnalysisCard extends StatelessWidget {
  final List<AttendanceRecord> month;
  final AttendanceRecord? today;
  final Map<int, String> holidays; // bayram kunlari ish kuni hisoblanmaydi

  const _TimeAnalysisCard({
    required this.month,
    required this.today,
    this.holidays = const {},
  });

  static const int _workdayMin = 8 * 60;
  static const Color _lateOrange = Color(0xFFFF8C42);

  static String _fmtHM(int min) =>
      '${min ~/ 60}:${(min % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;

    int workdaysTotal = 0; // oydagi barcha ish kunlari (Du–Ju, bayramlarsiz)
    int workdaysSoFar = 0; // bugungacha o'tgan ish kunlari
    for (var d = 1; d <= daysInMonth; d++) {
      if (DateTime(now.year, now.month, d).weekday <= 5 &&
          !holidays.containsKey(d)) {
        workdaysTotal++;
        if (d <= now.day) workdaysSoFar++;
      }
    }

    int kechikkan = 0, lateMin = 0;
    for (final r in month) {
      final late = r.lateExcused ? 0 : r.lateMinutes;
      if (late > 0) {
        kechikkan++;
        lateMin += late;
      }
    }
    final attended = month.length;
    final kelmagan = math.max(0, workdaysSoFar - attended);
    final jamiMin = attended * _workdayMin;
    final totalMin = workdaysTotal * _workdayMin;
    final kechikishMin = math.min(lateMin, jamiMin);
    final samaraliMin = jamiMin - kechikishMin;
    double pct(int part) =>
        totalMin == 0 ? 0 : (part / totalMin * 1000).round() / 10;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 30,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'ISHLASH VAQTI TAHLILI',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.muted,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              if (today != null) _todayChip(today!),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _stat(Icons.schedule, AppColors.primary, _fmtHM(jamiMin), 'soat',
                  'Jami ish\nsoati'),
              const SizedBox(width: 8),
              _stat(Icons.check_circle_outline, AppColors.success, '$attended',
                  'kun', 'Kelgan\nkunlar'),
              const SizedBox(width: 8),
              _stat(Icons.schedule, AppColors.warning, '$kechikkan', 'kun',
                  'Kechikishlar\n'),
              const SizedBox(width: 8),
              _stat(Icons.highlight_off, AppColors.danger, '$kelmagan', 'kun',
                  'Kelmagan\nkunlar'),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: AppColors.divider),
          const SizedBox(height: 16),
          Row(
            children: [
              SizedBox(
                width: 118,
                height: 118,
                child: CustomPaint(
                  painter: _DonutPainter(
                    total: totalMin,
                    parts: [
                      (samaraliMin, AppColors.success),
                      (kechikishMin, _lateOrange),
                    ],
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _fmtHM(totalMin),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.ink,
                          ),
                        ),
                        const Text(
                          'soat',
                          style: TextStyle(fontSize: 11, color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.muted,
                          height: 1.35,
                        ),
                        children: [
                          const TextSpan(text: 'Bu oyda '),
                          TextSpan(
                            text: '$workdaysTotal',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.ink,
                            ),
                          ),
                          const TextSpan(text: ' ish kuni ('),
                          TextSpan(
                            text: _fmtHM(totalMin),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.ink,
                            ),
                          ),
                          const TextSpan(text: ' soat ishlash kerak)'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _legend(AppColors.success, 'Samarali ish vaqti',
                        _fmtHM(samaraliMin), pct(samaraliMin)),
                    const SizedBox(height: 8),
                    _legend(_lateOrange, 'Kechikishlar', _fmtHM(kechikishMin),
                        pct(kechikishMin)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _todayChip(AttendanceRecord rec) {
    final late = rec.lateExcused ? 0 : rec.lateMinutes;
    final color = late <= 0
        ? AppColors.success
        : (late <= 10 ? AppColors.lateAmber : AppColors.danger);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            'Bugun ${rec.checkInLocal ?? '--:--'}',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(
    IconData icon,
    Color color,
    String value,
    String suffix,
    String label,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFFAFCFF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFF0F3F8)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(height: 4),
            FittedBox(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
            ),
            Text(
              suffix,
              style: const TextStyle(fontSize: 10, color: AppColors.muted),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: const TextStyle(
                fontSize: 9.5,
                color: Color(0xFFA8B0BD),
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _legend(Color color, String label, String value, double pct) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF3D4557)),
          ),
        ),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: value,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              TextSpan(
                text: ' (${pct.toStringAsFixed(1)}%)',
                style: const TextStyle(color: AppColors.muted),
              ),
            ],
          ),
          style: const TextStyle(fontSize: 12),
        ),
      ],
    );
  }
}

/// Halqa diagramma: har bir qism `total`ga nisbatan chiziladi, qolgani — kulrang.
class _DonutPainter extends CustomPainter {
  final int total;
  final List<(int, Color)> parts;

  _DonutPainter({required this.total, required this.parts});

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 16.0;
    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2,
      size.width - stroke,
      size.height - stroke,
    );
    canvas.drawArc(
      rect,
      0,
      2 * math.pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = const Color(0xFFEEF2F7),
    );
    if (total <= 0) return;

    var start = -math.pi / 2;
    for (final (value, color) in parts) {
      if (value <= 0) continue;
      final sweep = 2 * math.pi * (value / total).clamp(0.0, 1.0);
      canvas.drawArc(
        rect,
        start,
        sweep,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..color = color,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.total != total || old.parts != parts;
}
