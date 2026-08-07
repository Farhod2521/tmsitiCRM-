import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/ijro_task.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';

const _monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const _weekDays = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const Map<String, Color> _statusColor = {
  'yuborildi': AppColors.primary,
  'qabul_qilindi': AppColors.success,
  'rad_etildi': AppColors.danger,
  'bajarilmoqda': AppColors.warning,
  'tasdiq_kutilmoqda': AppColors.purple,
  'bajarildi': AppColors.success,
};

/// Kalendar — oy ko'rinishida, har bir kunga muddati kelgan topshiriqlar bilan.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  bool _loading = true;
  List<IjroTask> _tasks = [];
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime _selected = DateTime.now();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tasks = await ApiService.myTasks();
      if (mounted) setState(() => _tasks = tasks);
    } catch (_) {
      // jim — pastda bo'sh holat ko'rsatiladi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  DateTime? _dueDate(IjroTask t) {
    if (t.docIjroMuddati == null) return null;
    try {
      return DateTime.parse(t.docIjroMuddati!);
    } catch (_) {
      return null;
    }
  }

  Map<int, List<IjroTask>> get _tasksByDay {
    final map = <int, List<IjroTask>>{};
    for (final t in _tasks) {
      final d = _dueDate(t);
      if (d == null || d.year != _month.year || d.month != _month.month) continue;
      map.putIfAbsent(d.day, () => []).add(t);
    }
    return map;
  }

  void _prevMonth() => setState(() => _month = DateTime(_month.year, _month.month - 1));
  void _nextMonth() => setState(() => _month = DateTime(_month.year, _month.month + 1));
  void _goToday() {
    final now = DateTime.now();
    setState(() {
      _month = DateTime(now.year, now.month);
      _selected = now;
    });
  }

  bool _isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  @override
  Widget build(BuildContext context) {
    final byDay = _tasksByDay;
    final firstDow = DateTime(_month.year, _month.month, 1).weekday; // 1=Dush..7=Yaksh
    final padLeft = firstDow - 1;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final cells = <int?>[
      ...List.filled(padLeft, null),
      ...List.generate(daysInMonth, (i) => i + 1),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }

    final isSelectedInMonth = _selected.year == _month.year && _selected.month == _month.month;
    final selectedTasks = isSelectedInMonth ? (byDay[_selected.day] ?? []) : <IjroTask>[];

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: AppColors.ink), onPressed: () => Navigator.of(context).pop()),
        title: const Text('Kalendar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink)),
        centerTitle: false,
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : RefreshIndicator(
                onRefresh: _load,
                color: AppColors.primary,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                  children: [
                    Container(
                      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 24, offset: Offset(0, 6))]),
                      child: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text('${_monthNames[_month.month - 1]} ${_month.year}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink)),
                                ),
                                _navBtn(Icons.chevron_left_rounded, _prevMonth),
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: _goToday,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                                    child: const Text('Bugun', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                _navBtn(Icons.chevron_right_rounded, _nextMonth),
                              ],
                            ),
                          ),
                          Row(
                            children: _weekDays
                                .map((d) => Expanded(
                                      child: Center(
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          child: Text(d, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted)),
                                        ),
                                      ),
                                    ))
                                .toList(),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                            child: GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: cells.length,
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7),
                              itemBuilder: (context, i) {
                                final day = cells[i];
                                if (day == null) return const SizedBox();
                                final date = DateTime(_month.year, _month.month, day);
                                final dayTasks = byDay[day] ?? [];
                                final isToday = _isSameDay(date, DateTime.now());
                                final isSelected = isSelectedInMonth && day == _selected.day;
                                return GestureDetector(
                                  onTap: () => setState(() => _selected = date),
                                  child: Container(
                                    margin: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(
                                      color: isSelected ? AppColors.primary : (isToday ? AppColors.primary.withValues(alpha: 0.1) : null),
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          '$day',
                                          style: TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: isSelected ? Colors.white : (isToday ? AppColors.primary : AppColors.ink),
                                          ),
                                        ),
                                        if (dayTasks.isNotEmpty)
                                          Container(
                                            margin: const EdgeInsets.only(top: 2),
                                            width: 4,
                                            height: 4,
                                            decoration: BoxDecoration(
                                              color: isSelected ? Colors.white : (_statusColor[dayTasks.first.holati] ?? AppColors.primary),
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      DateFormat('d MMMM, EEEE', 'uz').format(_selected),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink),
                    ),
                    const SizedBox(height: 12),
                    if (selectedTasks.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16)),
                        alignment: Alignment.center,
                        child: const Column(
                          children: [
                            Icon(Icons.event_available_rounded, size: 28, color: AppColors.border),
                            SizedBox(height: 8),
                            Text("Bu kunga muddati kelgan topshiriq yo'q", style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
                          ],
                        ),
                      )
                    else
                      ...selectedTasks.map(_taskCard),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 18, color: AppColors.mutedText),
      ),
    );
  }

  Widget _taskCard(IjroTask t) {
    final color = _statusColor[t.holati] ?? AppColors.muted;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 16, offset: Offset(0, 4))]),
      child: Row(
        children: [
          Container(width: 4, height: 36, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (t.docManba != null) Text(ijroManbaLabels[t.docManba] ?? t.docManba!, style: const TextStyle(fontSize: 11.5, color: AppColors.muted)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
            child: Text(ijroStatusLabels[t.holati] ?? t.holati, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
          ),
        ],
      ),
    );
  }
}
