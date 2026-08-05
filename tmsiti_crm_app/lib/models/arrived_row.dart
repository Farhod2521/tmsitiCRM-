/// `GET /attendance/today-list` javobidagi bitta qator — bugun ishga kelgan xodim.
class ArrivedRow {
  final int employeeId;
  final String fullName;
  final String position;
  final String? department;
  final String? checkInLocal; // "HH:MM"
  final int? lateMinutes;

  ArrivedRow({
    required this.employeeId,
    required this.fullName,
    required this.position,
    required this.department,
    required this.checkInLocal,
    required this.lateMinutes,
  });

  factory ArrivedRow.fromJson(Map<String, dynamic> json) => ArrivedRow(
        employeeId: json['employee_id'] as int,
        fullName: json['full_name'] as String,
        position: json['position'] as String? ?? '',
        department: json['department'] as String?,
        checkInLocal: json['check_in_local'] as String?,
        lateMinutes: json['late_minutes'] as int?,
      );
}
