import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/ijro_task.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';

class _StatusCfg {
  final String label;
  final Color color;
  final IconData icon;
  const _StatusCfg(this.label, this.color, this.icon);
}

const Map<String, _StatusCfg> _statusCfg = {
  'yuborildi':         _StatusCfg('Yuborildi', AppColors.primary, Icons.send_outlined),
  'qabul_qilindi':     _StatusCfg('Qabul qilindi', AppColors.success, Icons.check_circle_outline),
  'rad_etildi':        _StatusCfg('Rad etildi', AppColors.danger, Icons.cancel_outlined),
  'bajarilmoqda':      _StatusCfg('Bajarilmoqda', AppColors.warning, Icons.autorenew),
  'tasdiq_kutilmoqda': _StatusCfg('Tasdiqlanishi kutilmoqda', AppColors.purple, Icons.hourglass_empty),
  'bajarildi':         _StatusCfg('Bajarildi', AppColors.success, Icons.check_circle),
};

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  bool _loading = true;
  List<IjroTask> _tasks = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tasks = await ApiService.myTasks();
      tasks.sort((a, b) => (b.assignedAt ?? '').compareTo(a.assignedAt ?? ''));
      if (!mounted) return;
      setState(() => _tasks = tasks);
    } catch (_) {
      // jim — pastda bo'sh holat ko'rsatiladi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  ({String text, Color color})? _daysLeft(String? dateStr) {
    if (dateStr == null) return null;
    DateTime due;
    try {
      due = DateTime.parse(dateStr);
    } catch (_) {
      return null;
    }
    final diff = due.difference(DateTime.now()).inHours / 24;
    final days = diff.ceil();
    if (days < 0) return (text: '${days.abs()} kun o\'tgan', color: AppColors.danger);
    if (days == 0) return (text: 'Bugun', color: AppColors.danger);
    if (days <= 5) return (text: '$days kun qoldi', color: AppColors.lateAmber);
    return (text: '$days kun qoldi', color: AppColors.success);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  children: [
                    const Text('Topshiriqlar', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.ink)),
                    const SizedBox(height: 2),
                    const Text('Sizga shaxsan biriktirilgan topshiriqlar', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                    const SizedBox(height: 20),

                    if (_tasks.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 50),
                        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18)),
                        alignment: Alignment.center,
                        child: Column(
                          children: const [
                            Icon(Icons.assignment_outlined, size: 32, color: AppColors.border),
                            SizedBox(height: 10),
                            Text('Sizga biriktirilgan topshiriq yo\'q', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                          ],
                        ),
                      )
                    else
                      ..._tasks.map(_buildTaskCard),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildTaskCard(IjroTask t) {
    final cfg = _statusCfg[t.holati] ?? const _StatusCfg('Noma\'lum', AppColors.muted, Icons.help_outline);
    final dl = _daysLeft(t.docIjroMuddati);
    String? dateLabel;
    if (t.assignedAt != null) {
      try {
        dateLabel = DateFormat('yyyy-MM-dd').format(DateTime.parse(t.assignedAt!));
      } catch (_) {}
    }
    final showDecision = t.qarorByNomi != null && (t.holati == 'qabul_qilindi' || t.holati == 'rad_etildi' || t.holati == 'bajarildi');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 20, offset: Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: cfg.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(cfg.icon, size: 13, color: cfg.color),
                    const SizedBox(width: 5),
                    Text(cfg.label, style: TextStyle(color: cfg.color, fontWeight: FontWeight.w800, fontSize: 11.5)),
                  ],
                ),
              ),
              const Spacer(),
              if (dateLabel != null) Text(dateLabel, style: const TextStyle(color: AppColors.muted, fontSize: 11.5)),
            ],
          ),
          const SizedBox(height: 10),
          Text(t.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink)),
          if (t.docManba != null) ...[
            const SizedBox(height: 3),
            Text(ijroManbaLabels[t.docManba] ?? t.docManba!, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
          ],
          if (dl != null) ...[
            const SizedBox(height: 6),
            Text(dl.text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: dl.color)),
          ],
          if (showDecision) ...[
            const SizedBox(height: 6),
            Text('${t.qarorByNomi} tomonidan ${ijroDecisionVerb(t.holati)}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.success)),
          ],
        ],
      ),
    );
  }
}
