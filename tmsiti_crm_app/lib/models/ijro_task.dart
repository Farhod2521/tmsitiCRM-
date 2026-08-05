/// `GET /ijro-docs/my-tasks` javobidagi bitta topshiriq (bo'lim-hujjat biriktirmasi).
class IjroTask {
  final int id;
  final String holati; // yuborildi | qabul_qilindi | rad_etildi | bajarilmoqda | tasdiq_kutilmoqda | bajarildi
  final String? izoh;
  final String? qarorByNomi;
  final String? assignedAt;
  final String? docSarlavha;
  final String? docHujjatRaqami;
  final String? docManba;
  final String? docIjroMuddati;

  IjroTask({
    required this.id,
    required this.holati,
    required this.izoh,
    required this.qarorByNomi,
    required this.assignedAt,
    required this.docSarlavha,
    required this.docHujjatRaqami,
    required this.docManba,
    required this.docIjroMuddati,
  });

  factory IjroTask.fromJson(Map<String, dynamic> json) => IjroTask(
        id: json['id'] as int,
        holati: json['holati'] as String,
        izoh: json['izoh'] as String?,
        qarorByNomi: json['qaror_by_nomi'] as String?,
        assignedAt: json['xodim_assigned_at'] as String? ?? json['assigned_at'] as String?,
        docSarlavha: json['doc_sarlavha'] as String?,
        docHujjatRaqami: json['doc_hujjat_raqami'] as String?,
        docManba: json['doc_manba'] as String?,
        docIjroMuddati: json['doc_ijro_muddati'] as String?,
      );

  String get title => docSarlavha?.isNotEmpty == true ? docSarlavha! : (docHujjatRaqami != null ? '№ $docHujjatRaqami' : 'Topshiriq #$id');
}

const Map<String, String> ijroManbaLabels = {
  'pq_pf': 'Prezident Hujjatlari (PQ/PF)',
  'vm': 'Vazirlar Mahkamasi (VM)',
  'qv': 'Vazirlik (QV)',
  'direktor': 'Institut direktori',
};

const Map<String, String> ijroStatusLabels = {
  'yuborildi': 'Yuborildi',
  'qabul_qilindi': 'Qabul qilindi',
  'rad_etildi': 'Rad etildi',
  'bajarilmoqda': 'Bajarilmoqda',
  'tasdiq_kutilmoqda': 'Tasdiqlanishi kutilmoqda',
  'bajarildi': 'Bajarildi',
};

String ijroDecisionVerb(String holati) {
  switch (holati) {
    case 'rad_etildi':
      return 'rad etildi';
    case 'bajarildi':
      return 'tasdiqlandi';
    default:
      return 'qabul qilindi';
  }
}
