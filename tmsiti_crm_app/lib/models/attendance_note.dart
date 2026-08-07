/// `GET /attendance/notes/mine` / `POST /attendance/notes` javobi — davomat arizasi
/// (kech qolaman / kelmayman / obyektga chiqdim).
class AttendanceNote {
  final int id;
  final String noteType; // "kechikish" | "kelmaslik" | "obyektda"
  final String? text;
  final String dateFrom; // "2026-08-07"
  final String dateTo;
  final String? expectedTime;    // "kechikish" uchun, "10:30"
  final String? objectTimeFrom;  // "obyektda" uchun, "09:00"
  final String? objectTimeTo;
  final DateTime createdAt;

  AttendanceNote({
    required this.id,
    required this.noteType,
    required this.text,
    required this.dateFrom,
    required this.dateTo,
    required this.expectedTime,
    required this.objectTimeFrom,
    required this.objectTimeTo,
    required this.createdAt,
  });

  factory AttendanceNote.fromJson(Map<String, dynamic> json) => AttendanceNote(
        id: json['id'] as int,
        noteType: json['note_type'] as String,
        text: json['text'] as String?,
        dateFrom: json['date_from'] as String,
        dateTo: json['date_to'] as String,
        expectedTime: json['expected_time'] as String?,
        objectTimeFrom: json['object_time_from'] as String?,
        objectTimeTo: json['object_time_to'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}
