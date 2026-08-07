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
  final double? objectLatitude;  // "obyektda" uchun joriy joylashuv (ixtiyoriy)
  final double? objectLongitude;
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
    required this.objectLatitude,
    required this.objectLongitude,
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
        objectLatitude: (json['object_latitude'] as num?)?.toDouble(),
        objectLongitude: (json['object_longitude'] as num?)?.toDouble(),
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}
