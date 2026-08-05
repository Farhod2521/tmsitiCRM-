/// `POST /attendance/check-in` / `GET /attendance/today` javobi.
class AttendanceRecord {
  final int id;
  final String date; // "2026-06-09"
  final DateTime checkIn;
  final double? distanceM;
  final int lateMinutes;
  final String? checkInLocal; // "HH:MM"

  AttendanceRecord({
    required this.id,
    required this.date,
    required this.checkIn,
    required this.distanceM,
    required this.lateMinutes,
    required this.checkInLocal,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) => AttendanceRecord(
        id: json['id'] as int,
        date: json['date'] as String,
        checkIn: DateTime.parse(json['check_in'] as String),
        distanceM: (json['distance_m'] as num?)?.toDouble(),
        lateMinutes: json['late_minutes'] as int? ?? 0,
        checkInLocal: json['check_in_local'] as String?,
      );
}

/// `GET /attendance/office` javobi — joriy xodimning ish joyiga mos koordinata/radius.
class OfficeInfo {
  final double latitude;
  final double longitude;
  final double radiusM;
  final String workStart;

  OfficeInfo({
    required this.latitude,
    required this.longitude,
    required this.radiusM,
    required this.workStart,
  });

  factory OfficeInfo.fromJson(Map<String, dynamic> json) => OfficeInfo(
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        radiusM: (json['radius_m'] as num).toDouble(),
        workStart: json['work_start'] as String? ?? '09:00',
      );
}
