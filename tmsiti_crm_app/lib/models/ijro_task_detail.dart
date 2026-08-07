/// `GET /ijro-docs/bolim-inbox/{id}/detail` javobidagi hujjat qismi.
class IjroDocDetail {
  final int id;
  final String? hujjatRaqami;
  final String? hujjatSanasi;
  final String? sarlavha;
  final String? mazmun;
  final String? qoshimchaMalumot;
  final String manba;
  final String? ijroMuddati;
  final String davriyligi;
  final String? kelishuvchiTashkilotlar;
  final String? faylName;
  final String holati;

  IjroDocDetail({
    required this.id,
    required this.hujjatRaqami,
    required this.hujjatSanasi,
    required this.sarlavha,
    required this.mazmun,
    required this.qoshimchaMalumot,
    required this.manba,
    required this.ijroMuddati,
    required this.davriyligi,
    required this.kelishuvchiTashkilotlar,
    required this.faylName,
    required this.holati,
  });

  factory IjroDocDetail.fromJson(Map<String, dynamic> json) => IjroDocDetail(
    id: json['id'] as int,
    hujjatRaqami: json['hujjat_raqami'] as String?,
    hujjatSanasi: json['hujjat_sanasi'] as String?,
    sarlavha: json['sarlavha'] as String?,
    mazmun: json['mazmun'] as String?,
    qoshimchaMalumot: json['qoshimcha_malumot'] as String?,
    manba: json['manba'] as String,
    ijroMuddati: json['ijro_muddati'] as String?,
    davriyligi: json['davriyligi'] as String,
    kelishuvchiTashkilotlar: json['kelishuvchi_tashkilotlar'] as String?,
    faylName: json['fayl_name'] as String?,
    holati: json['holati'] as String,
  );
}

class TaskYakunlashFayl {
  final String name;
  final String b64;
  TaskYakunlashFayl({required this.name, required this.b64});
  factory TaskYakunlashFayl.fromJson(Map<String, dynamic> json) =>
      TaskYakunlashFayl(
        name: json['name'] as String,
        b64: json['b64'] as String,
      );
}

/// Bitta bo'limga biriktirilgan topshiriqning to'liq holati.
class IjroBolimDetail {
  final int id;
  final int bolimId;
  final String? bolimNomi;
  final String holati;
  final String? izoh;
  final String? assignedAt;
  final String? qarorAt;
  final String? qarorByNomi;
  final int? xodimId;
  final String? xodimNomi;
  final String? xodimAssignedAt;
  final String? yakunlashIzohi;
  final List<TaskYakunlashFayl> yakunlashFayllar;
  final String? yakunlanganAt;
  final String? yakunlaganByNomi;

  IjroBolimDetail({
    required this.id,
    required this.bolimId,
    required this.bolimNomi,
    required this.holati,
    required this.izoh,
    required this.assignedAt,
    required this.qarorAt,
    required this.qarorByNomi,
    required this.xodimId,
    required this.xodimNomi,
    required this.xodimAssignedAt,
    required this.yakunlashIzohi,
    required this.yakunlashFayllar,
    required this.yakunlanganAt,
    required this.yakunlaganByNomi,
  });

  factory IjroBolimDetail.fromJson(Map<String, dynamic> json) =>
      IjroBolimDetail(
        id: json['id'] as int,
        bolimId: json['bolim_id'] as int,
        bolimNomi: json['bolim_nomi'] as String?,
        holati: json['holati'] as String,
        izoh: json['izoh'] as String?,
        assignedAt: json['assigned_at'] as String?,
        qarorAt: json['qaror_at'] as String?,
        qarorByNomi: json['qaror_by_nomi'] as String?,
        xodimId: json['xodim_id'] as int?,
        xodimNomi: json['xodim_nomi'] as String?,
        xodimAssignedAt: json['xodim_assigned_at'] as String?,
        yakunlashIzohi: json['yakunlash_izohi'] as String?,
        yakunlashFayllar: (json['yakunlash_fayllar'] as List? ?? [])
            .map((f) => TaskYakunlashFayl.fromJson(f as Map<String, dynamic>))
            .toList(),
        yakunlanganAt: json['yakunlangan_at'] as String?,
        yakunlaganByNomi: json['yakunlagan_by_nomi'] as String?,
      );
}

class IjroTaskDetail {
  final IjroDocDetail doc;
  final List<IjroBolimDetail> bolimlar;
  IjroTaskDetail({required this.doc, required this.bolimlar});

  factory IjroTaskDetail.fromJson(Map<String, dynamic> json) => IjroTaskDetail(
    doc: IjroDocDetail.fromJson(json['doc'] as Map<String, dynamic>),
    bolimlar: (json['bolimlar'] as List)
        .map((b) => IjroBolimDetail.fromJson(b as Map<String, dynamic>))
        .toList(),
  );
}
