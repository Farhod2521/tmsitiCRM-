import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/ijro_task.dart';
import '../models/ijro_task_detail.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';

class _Cfg {
  final String label;
  final Color color;
  const _Cfg(this.label, this.color);
}

const Map<String, _Cfg> _docStatusCfg = {
  'jarayonda': _Cfg('Jarayonda', AppColors.primary),
  'bajarildi': _Cfg('Bajarildi', AppColors.success),
  'muddati_yaqin': _Cfg('Muddati yaqin', AppColors.warning),
  'kechikmoqda': _Cfg('Kechikmoqda', AppColors.danger),
  'bolimga_yonaltirildi': _Cfg("Bo'limga yo'naltirildi", AppColors.purple),
};

const Map<String, _Cfg> _bolimStatusCfg = {
  'yuborildi': _Cfg('Yuborildi', AppColors.primary),
  'qabul_qilindi': _Cfg('Qabul qilindi', AppColors.success),
  'rad_etildi': _Cfg('Rad etildi', AppColors.danger),
  'bajarilmoqda': _Cfg('Bajarilmoqda', AppColors.warning),
  'tasdiq_kutilmoqda': _Cfg('Tasdiqlanishi kutilmoqda', AppColors.purple),
  'bajarildi': _Cfg('Bajarildi', AppColors.success),
};

String _davriyligiLabel(String v) {
  switch (v) {
    case 'bir_martalik':
      return 'Bir martalik';
    case 'har_chorakda':
      return 'Har chorakda';
    case 'har_yili':
      return 'Har yili';
    default:
      return v;
  }
}

String _fmtDt(String iso) {
  try {
    return DateFormat('d MMMM, yyyy', 'uz').format(DateTime.parse(iso));
  } catch (_) {
    return iso;
  }
}

/// Topshiriq (bo'lim-hujjat biriktirmasi) haqida to'liq ma'lumot — hujjat
/// mazmuni, muddati, biriktirilgan fayl va barcha bo'limlar bo'yicha holat.
class TaskDetailScreen extends StatefulWidget {
  final int docBolimId;
  const TaskDetailScreen({super.key, required this.docBolimId});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  bool _loading = true;
  IjroTaskDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await ApiService.taskDetail(widget.docBolimId);
      if (mounted) setState(() => _detail = d);
    } catch (e) {
      if (mounted)
        setState(
          () => _error = e.toString().replaceFirst('ApiException: ', ''),
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.ink),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Topshiriq tafsilotlari',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : _error != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: AppColors.danger,
                        size: 32,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextButton(
                        onPressed: _load,
                        child: const Text('Qayta urinish'),
                      ),
                    ],
                  ),
                ),
              )
            : RefreshIndicator(
                onRefresh: _load,
                color: AppColors.primary,
                child: _buildBody(_detail!),
              ),
      ),
    );
  }

  Widget _buildBody(IjroTaskDetail d) {
    final doc = d.doc;
    final statusCfg =
        _docStatusCfg[doc.holati] ?? _Cfg(doc.holati, AppColors.muted);
    final tashkilotlar = (doc.kelishuvchiTashkilotlar ?? '')
        .split(', ')
        .where((s) => s.isNotEmpty)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        Container(
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      '№ ${doc.hujjatRaqami ?? "DOC-${doc.id}"}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  _chip(statusCfg),
                ],
              ),
              if (doc.hujjatSanasi != null) ...[
                const SizedBox(height: 3),
                Text(
                  doc.hujjatSanasi!,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                ijroManbaLabels[doc.manba] ?? doc.manba,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.mutedText,
                ),
              ),
              if (doc.sarlavha != null && doc.sarlavha!.isNotEmpty) ...[
                const SizedBox(height: 16),
                _sectionLabel('Hujjat bandi'),
                const SizedBox(height: 3),
                Text(
                  doc.sarlavha!,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ],
              if (doc.mazmun != null && doc.mazmun!.isNotEmpty) ...[
                const SizedBox(height: 16),
                _sectionLabel('Topshiriq mazmuni'),
                const SizedBox(height: 3),
                Text(
                  doc.mazmun!,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.ink,
                    height: 1.5,
                  ),
                ),
              ],
              if (doc.qoshimchaMalumot != null &&
                  doc.qoshimchaMalumot!.isNotEmpty) ...[
                const SizedBox(height: 16),
                _sectionLabel("Qo'shimcha ma'lumot"),
                const SizedBox(height: 3),
                Text(
                  doc.qoshimchaMalumot!,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.mutedText,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (doc.ijroMuddati != null)
                    _infoChip(
                      Icons.event_rounded,
                      'Muddat',
                      _fmtDt(doc.ijroMuddati!),
                    ),
                  _infoChip(
                    Icons.repeat_rounded,
                    'Davriyligi',
                    _davriyligiLabel(doc.davriyligi),
                  ),
                ],
              ),
              if (tashkilotlar.isNotEmpty) ...[
                const SizedBox(height: 16),
                _sectionLabel('Kelishuvchi tashkilotlar'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: tashkilotlar
                      .map(
                        (t) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            t,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.mutedText,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ],
              if (doc.faylName != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.attach_file_rounded,
                        size: 17,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          doc.faylName!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text(
          "Bo'limlar bo'yicha holat (${d.bolimlar.length})",
          style: const TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 12),
        if (d.bolimlar.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 30),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: const Text(
              "Hali hech qaysi bo'limga biriktirilmagan",
              style: TextStyle(color: AppColors.muted, fontSize: 12.5),
            ),
          )
        else
          ...d.bolimlar.map(_bolimCard),
      ],
    );
  }

  Widget _sectionLabel(String text) => Text(
    text,
    style: const TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w800,
      color: AppColors.muted,
      letterSpacing: 0.3,
    ),
  );

  Widget _chip(_Cfg cfg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: cfg.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        cfg.label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: cfg.color,
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.mutedText),
          const SizedBox(width: 7),
          Text(
            '$label: ',
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bolimCard(IjroBolimDetail b) {
    final cfg = _bolimStatusCfg[b.holati] ?? _Cfg(b.holati, AppColors.muted);
    final isRejected = b.holati == 'rad_etildi';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isRejected
            ? AppColors.danger.withValues(alpha: 0.04)
            : AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isRejected
              ? AppColors.danger.withValues(alpha: 0.15)
              : AppColors.divider,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  b.bolimNomi ?? "Bo'lim #${b.bolimId}",
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _chip(cfg),
            ],
          ),
          if (isRejected && b.izoh != null && b.izoh!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Rad etish sababi:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.danger,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    b.izoh!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (b.xodimNomi != null) ...[
            const SizedBox(height: 10),
            Text.rich(
              TextSpan(
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedText,
                ),
                children: [
                  const TextSpan(text: 'Ijrochi xodim: '),
                  TextSpan(
                    text: b.xodimNomi,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (b.yakunlashIzohi != null && b.yakunlashIzohi!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Yakunlash hisoboti:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.success,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    b.yakunlashIzohi!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              if (b.assignedAt != null)
                Text(
                  'Yuborildi: ${_fmtDt(b.assignedAt!)}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppColors.muted,
                  ),
                ),
              if (b.qarorAt != null)
                Text(
                  'Qaror: ${_fmtDt(b.qarorAt!)}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppColors.muted,
                  ),
                ),
              if (b.qarorByNomi != null)
                Text(
                  'Kim: ${b.qarorByNomi}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppColors.muted,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
