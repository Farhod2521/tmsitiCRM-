import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/arrived_row.dart';
import '../models/attendance.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../theme/app_colors.dart';

class DavomatScreen extends StatelessWidget {
  const DavomatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text('Davomat', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.ink)),
                    ),
                  ],
                ),
              ),
              Container(
                margin: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14)),
                child: const TabBar(
                  indicator: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.all(Radius.circular(10))),
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicatorPadding: EdgeInsets.zero,
                  dividerColor: Colors.transparent,
                  labelColor: Colors.white,
                  unselectedLabelColor: AppColors.muted,
                  labelStyle: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                  unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                  splashBorderRadius: BorderRadius.all(Radius.circular(10)),
                  tabs: [
                    Tab(height: 42, text: 'Kelganlar'),
                    Tab(height: 42, text: 'Mening davomatim'),
                  ],
                ),
              ),
              const Expanded(
                child: TabBarView(
                  children: [
                    _ArrivedTodayTab(),
                    _MyAttendanceTab(),
                  ],
                ),
              ),
            ],
          ),
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

class _ArrivedTodayTabState extends State<_ArrivedTodayTab> with AutomaticKeepAliveClientMixin {
  bool _loading = true;
  List<ArrivedRow> _rows = [];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await ApiService.todayList();
      if (!mounted) return;
      setState(() => _rows = rows);
    } catch (_) {
      // jim — pastda bo'sh holat ko'rsatiladi
    } finally {
      if (mounted) setState(() => _loading = false);
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
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Text(today, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          const SizedBox(height: 16),

          if (_rows.isNotEmpty) _buildDayEmployeeCard(_rows.first),

          const SizedBox(height: 20),
          Text('Bugun kelganlar (${_rows.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink)),
          const SizedBox(height: 12),

          if (_rows.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 40),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
              alignment: Alignment.center,
              child: const Text('Hali hech kim ishga kelmagan', style: TextStyle(color: AppColors.muted, fontSize: 13)),
            )
          else
            ..._rows.asMap().entries.map((entry) {
              final i = entry.key;
              final r = entry.value;
              final color = _lateColor(r.lateMinutes);
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    SizedBox(
                      width: 26,
                      child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.muted)),
                    ),
                    Container(
                      width: 38, height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
                      child: Text(_initials(r.fullName), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12.5)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.ink), overflow: TextOverflow.ellipsis),
                          if (r.department != null)
                            Text(r.department!, style: const TextStyle(fontSize: 11.5, color: AppColors.muted), overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    Text(r.checkInLocal ?? '--:--', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: color)),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildDayEmployeeCard(ArrivedRow first) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.warning, Color(0xFFFFA000)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.warning.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Row(
        children: [
          Container(
            width: 54, height: 54,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.25), shape: BoxShape.circle),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("KUN XODIMI", style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.8)),
                const SizedBox(height: 3),
                Text(first.fullName, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis),
                if (first.department != null)
                  Text(first.department!, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12.5), overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Text(first.checkInLocal ?? '--:--', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    return parts.take(2).map((s) => s[0]).join().toUpperCase();
  }
}

// ─── Tab 2: Mening davomatim (shaxsiy check-in) ─────────────────────────────

class _MyAttendanceTab extends StatefulWidget {
  const _MyAttendanceTab();

  @override
  State<_MyAttendanceTab> createState() => _MyAttendanceTabState();
}

class _MyAttendanceTabState extends State<_MyAttendanceTab> with AutomaticKeepAliveClientMixin {
  bool _loading = true;
  bool _checkingIn = false;
  AttendanceRecord? _today;
  OfficeInfo? _office;
  List<AttendanceRecord> _month = [];
  String? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final now = DateTime.now();
    try {
      final results = await Future.wait([
        ApiService.today(),
        ApiService.office(),
        ApiService.myMonth(now.year, now.month),
      ]);
      if (!mounted) return;
      setState(() {
        _today = results[0] as AttendanceRecord?;
        _office = results[1] as OfficeInfo;
        _month = results[2] as List<AttendanceRecord>;
      });
    } catch (_) {
      // jim — pastda "Ishga keldim" tugmasi baribir ishlayveradi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleCheckIn() async {
    setState(() {
      _checkingIn = true;
      _error = null;
    });
    try {
      final pos = await LocationService.getCurrentPosition();
      final rec = await ApiService.checkIn(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() => _today = rec);
      await _load();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('ApiException: ', '').replaceFirst('LocationException: ', ''));
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
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Text(today, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                const SizedBox(height: 16),

                _today != null ? _buildCheckedInCard(_today!) : _buildCheckInButton(),

                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                    ),
                    child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ],

                if (_office != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 15, color: AppColors.muted),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          "Ish joyi radiusi: ${_office!.radiusM.toInt()} m · Ish boshlanishi: ${_office!.workStart}",
                          style: const TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 28),
                const Text('Bu oy', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink)),
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
          boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10))],
        ),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), shape: BoxShape.circle),
              child: _checkingIn
                  ? const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                  : const Icon(Icons.fingerprint, color: Colors.white, size: 34),
            ),
            const SizedBox(height: 14),
            Text(
              _checkingIn ? 'Joylashuv aniqlanmoqda...' : 'Ishga keldim',
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Bosish orqali joylashuvingiz tekshiriladi',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckedInCard(AttendanceRecord rec) {
    final late = rec.lateMinutes;
    final Color statusColor = late <= 0 ? AppColors.success : (late <= 15 ? AppColors.lateAmber : AppColors.danger);
    final String statusText = late <= 0 ? 'Vaqtida keldingiz' : "$late daqiqa kech qoldingiz";

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 30, offset: Offset(0, 6))],
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, color: AppColors.success, size: 34),
          ),
          const SizedBox(height: 14),
          Text('Bugun soat ${rec.checkInLocal ?? '--:--'} da keldingiz', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
            child: Text(statusText, style: TextStyle(color: statusColor, fontWeight: FontWeight.w800, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthList() {
    if (_month.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 30),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
        alignment: Alignment.center,
        child: const Text('Bu oyda hali davomat yo\'q', style: TextStyle(color: AppColors.muted, fontSize: 13)),
      );
    }

    final sorted = [..._month]..sort((a, b) => b.date.compareTo(a.date));

    return Column(
      children: sorted.map((r) {
        final late = r.lateMinutes;
        final color = late <= 0 ? AppColors.success : (late <= 15 ? AppColors.lateAmber : AppColors.danger);
        final dateLabel = DateFormat('d MMMM, EEEE', 'uz').format(DateTime.parse(r.date));
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(dateLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.ink)),
              ),
              Text(
                r.checkInLocal ?? '--:--',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: color),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
