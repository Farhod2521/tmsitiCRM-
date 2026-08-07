import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import '../models/attendance.dart';
import '../models/auth_user.dart';
import '../models/ijro_task.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'calendar_screen.dart';
import 'task_detail_screen.dart';

/// Bosh sahifa — umumiy ko'rinish: shaxsiy davomat, faol vazifalar va tezkor amallar.
class HomeScreen extends StatefulWidget {
  final AuthUser user;
  final void Function(int tabIndex) onNavigate;
  const HomeScreen({super.key, required this.user, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

Widget _buildCalendarScreen(BuildContext context) => const CalendarScreen();

class _QuickAction {
  final IconData icon;
  final Color color;
  final Color bg;
  final String title;
  final String subtitle;
  final int? tab;
  final WidgetBuilder? pageBuilder;
  const _QuickAction(
    this.icon,
    this.color,
    this.bg,
    this.title,
    this.subtitle,
    this.tab, [
    this.pageBuilder,
  ]);
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  Uint8List? _photo;
  AttendanceRecord? _today;
  List<IjroTask> _tasks = [];
  int _totalTasksCount = 0;

  static const _actions = [
    _QuickAction(
      Icons.fingerprint_rounded,
      AppColors.primary,
      Color(0xFFEAF2FF),
      'Davomat',
      'Kelib-ketishni qayd etish',
      1,
    ),
    _QuickAction(
      Icons.assignment_rounded,
      AppColors.success,
      Color(0xFFE8FBF3),
      'Topshiriqlar',
      'Vazifalar va nazorat',
      2,
    ),
    _QuickAction(
      Icons.calendar_month_rounded,
      AppColors.danger,
      Color(0xFFFFEBEC),
      'Kalendar',
      'Tadbirlar va reja',
      null,
      _buildCalendarScreen,
    ),
    _QuickAction(
      Icons.bar_chart_rounded,
      Color(0xFF17A398),
      Color(0xFFE3F7F4),
      'Hisobotlar',
      'Statistika va tahlil',
      null,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  // Har bir blok mustaqil yuklanadi — biri (masalan hali deploy qilinmagan
  // endpoint) muvaffaqiyatsiz bo'lsa ham, qolganlari ko'rsatilaveradi.
  Future<void> _load() async {
    setState(() => _loading = true);
    await Future.wait([_loadToday(), _loadTasks(), _loadPhoto()]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadToday() async {
    try {
      final t = await ApiService.today();
      if (mounted) setState(() => _today = t);
    } catch (_) {}
  }

  Future<void> _loadTasks() async {
    try {
      final raw = await ApiService.myTasks();
      final active =
          raw
              .where((t) => t.holati != 'bajarildi' && t.holati != 'rad_etildi')
              .toList()
            ..sort(
              (a, b) => _daysUntil(
                a.docIjroMuddati,
              ).compareTo(_daysUntil(b.docIjroMuddati)),
            );
      if (mounted) {
        setState(() {
          _tasks = active;
          _totalTasksCount = raw.length;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadPhoto() async {
    try {
      final b64 = await ApiService.myPhotoBase64();
      if (mounted && b64 != null && b64.contains(',')) {
        setState(() => _photo = base64Decode(b64.split(',').last));
      }
    } catch (_) {}
  }

  // Muddati o'tib ketgan, hali bajarilmagan topshiriqlar soni.
  int get _overdueCount =>
      _tasks.where((t) => _daysUntil(t.docIjroMuddati) < 0).length;

  int _daysUntil(String? dateStr) {
    if (dateStr == null) return 999999;
    try {
      return DateTime.parse(dateStr).difference(DateTime.now()).inHours ~/ 24;
    } catch (_) {
      return 999999;
    }
  }

  ({String label, Color color}) _priorityFor(String? dueDate) {
    final d = _daysUntil(dueDate);
    if (d <= 2) return (label: 'Yuqori', color: AppColors.primary);
    if (d <= 7) return (label: "O'rta", color: AppColors.lateAmber);
    return (label: 'Past', color: AppColors.success);
  }

  double _progressFor(String holati) {
    switch (holati) {
      case 'yuborildi':
        return 0.10;
      case 'qabul_qilindi':
        return 0.25;
      case 'bajarilmoqda':
        return 0.60;
      case 'tasdiq_kutilmoqda':
        return 0.85;
      case 'bajarildi':
        return 1.0;
      default:
        return 0.0;
    }
  }

  IconData _iconForManba(String? manba) {
    switch (manba) {
      case 'pq_pf':
        return Icons.description_rounded;
      case 'vm':
        return Icons.account_balance_rounded;
      case 'qv':
        return Icons.domain_rounded;
      case 'direktor':
        return Icons.business_center_rounded;
      default:
        return Icons.assignment_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : RefreshIndicator(
                onRefresh: _load,
                color: AppColors.primary,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 110),
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 18),
                    _buildWelcomeBanner(),
                    const SizedBox(height: 16),
                    _buildStatsRow(),
                    const SizedBox(height: 16),
                    _buildQuickActionsGrid(),
                    const SizedBox(height: 16),
                    _buildTodayAttendanceCard(),
                    const SizedBox(height: 16),
                    _buildTasksCard(),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildHeader() {
    final initials = widget.user.fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((s) => s.isNotEmpty)
        .map((s) => s[0])
        .take(2)
        .join()
        .toUpperCase();
    final overdueCount = _overdueCount;

    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: SvgPicture.asset('assets/icons/brand.svg'),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TMSITI CRM',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              Text(
                'Raqamli boshqaruv tizimi',
                style: TextStyle(fontSize: 10.5, color: AppColors.muted),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => widget.onNavigate(2),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.card,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: AppColors.cardShadow, blurRadius: 12),
                  ],
                ),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  color: AppColors.ink,
                  size: 21,
                ),
              ),
              if (overdueCount > 0)
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$overdueCount',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                image: _photo != null
                    ? DecorationImage(
                        image: MemoryImage(_photo!),
                        fit: BoxFit.cover,
                      )
                    : null,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.cardShadow, blurRadius: 10),
                ],
              ),
              child: _photo == null
                  ? Text(
                      initials.isEmpty ? '?' : initials,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                      ),
                    )
                  : null,
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 11,
                height: 11,
                decoration: BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildWelcomeBanner() {
    final firstName = widget.user.fullName.trim().split(RegExp(r'\s+')).first;
    final dateLabel = DateFormat('d MMMM, yyyy', 'uz').format(DateTime.now());
    final weekday = DateFormat('EEEE', 'uz').format(DateTime.now());
    final weekdayCap = weekday.isEmpty
        ? weekday
        : weekday[0].toUpperCase() + weekday.substring(1);

    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: SizedBox(
        height: 190,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(color: const Color(0xFFEAF3FF)),
            Positioned.fill(
              child: Image.asset(
                'assets/icons/background.png',
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              'Xush kelibsiz, $firstName!',
                              style: const TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                                color: AppColors.ink,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text('👋', style: TextStyle(fontSize: 19)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        "Bugun samarali kun bo'lishini tilaymiz!",
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.mutedText,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(color: AppColors.cardShadow, blurRadius: 10),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.calendar_today_rounded,
                          size: 14,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              dateLabel,
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.ink,
                              ),
                            ),
                            Text(
                              weekdayCap,
                              style: const TextStyle(
                                fontSize: 10.5,
                                color: AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 6),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 24,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: _statItem(
              Icons.assignment_rounded,
              AppColors.primary,
              '$_totalTasksCount',
              'Jami topshiriqlar',
            ),
          ),
          Container(width: 1, height: 36, color: AppColors.divider),
          Expanded(
            child: _statItem(
              Icons.assignment_turned_in_rounded,
              AppColors.success,
              '${_tasks.length}',
              'Faol topshiriqlar',
            ),
          ),
          Container(width: 1, height: 36, color: AppColors.divider),
          Expanded(
            child: _statItem(
              Icons.schedule_rounded,
              AppColors.danger,
              '$_overdueCount',
              'Kechikkanlar',
            ),
          ),
        ],
      ),
    );
  }

  Widget _statItem(IconData icon, Color color, String value, String label) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 10.5, color: AppColors.muted),
        ),
      ],
    );
  }

  Widget _buildQuickActionsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.55,
      children: _actions.map(_actionCard).toList(),
    );
  }

  Widget _actionCard(_QuickAction a) {
    return GestureDetector(
      onTap: () {
        if (a.tab != null) {
          widget.onNavigate(a.tab!);
        } else if (a.pageBuilder != null) {
          Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: a.pageBuilder!));
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Tez kunda ishga tushiriladi'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: a.bg,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(a.icon, color: a.color, size: 22),
                const Spacer(),
                Icon(Icons.chevron_right_rounded, color: a.color, size: 18),
              ],
            ),
            const Spacer(),
            Text(
              a.title,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              a.subtitle,
              style: const TextStyle(
                fontSize: 10.5,
                color: AppColors.mutedText,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTodayAttendanceCard() {
    final checkedIn = _today != null;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 24,
            offset: Offset(0, 6),
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
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              checkedIn
                  ? Icons.check_circle_rounded
                  : Icons.access_time_filled_rounded,
              color: AppColors.primary,
              size: 19,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bugungi davomat',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  checkedIn
                      ? 'Siz bugun ${_today!.checkInLocal ?? "--:--"} da keldingiz'
                      : 'Siz hali ishga kelmadingiz',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedText,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => widget.onNavigate(1),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "Davomatni ko'rish",
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTasksCard() {
    final top3 = _tasks.take(3).toList();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 24,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.assignment_rounded,
                  size: 17,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Mening vazifalarim',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => widget.onNavigate(2),
                child: const Text(
                  "Barchasini ko'rish",
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (top3.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  "Faol topshiriq yo'q",
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
              ),
            )
          else
            ...top3.map(_taskRow),
        ],
      ),
    );
  }

  Widget _taskRow(IjroTask t) {
    final pr = _priorityFor(t.docIjroMuddati);
    final progress = _progressFor(t.holati);
    String? deadlineLabel;
    if (t.docIjroMuddati != null) {
      try {
        deadlineLabel = DateFormat(
          'd MMMM, yyyy',
          'uz',
        ).format(DateTime.parse(t.docIjroMuddati!));
      } catch (_) {}
    }
    final subtitleParts = [
      if (t.docManba != null) ijroManbaLabels[t.docManba] ?? t.docManba!,
      if (deadlineLabel != null) 'Muddat: $deadlineLabel',
    ];

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TaskDetailScreen(docBolimId: t.id)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.only(top: 2),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: pr.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_iconForManba(t.docManba), size: 16, color: pr.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          t.title,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: AppColors.ink,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: pr.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          pr.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: pr.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (subtitleParts.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitleParts.join(' · '),
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: AppColors.muted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 7),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 5,
                            backgroundColor: AppColors.divider,
                            valueColor: AlwaysStoppedAnimation(pr.color),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${(progress * 100).round()}%',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
