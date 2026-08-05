/// `GET /auth/me` / `GET /employees/me` javobi.
class Employee {
  final int id;
  final String fullName;
  final String position;
  final String? departmentName;
  final String phone;
  final String role;
  final String status;
  final bool isActive;
  final String workLocation; // "vazirlik" | "labaratoriya"
  final bool hasPhoto;

  Employee({
    required this.id,
    required this.fullName,
    required this.position,
    required this.departmentName,
    required this.phone,
    required this.role,
    required this.status,
    required this.isActive,
    required this.workLocation,
    required this.hasPhoto,
  });

  factory Employee.fromJson(Map<String, dynamic> json) => Employee(
        id: json['id'] as int,
        fullName: json['full_name'] as String,
        position: json['position'] as String? ?? '',
        departmentName: (json['department'] as Map<String, dynamic>?)?['name'] as String?,
        phone: json['phone'] as String,
        role: json['role'] as String,
        status: json['status'] as String? ?? 'faol',
        isActive: json['is_active'] as bool? ?? true,
        workLocation: json['work_location'] as String? ?? 'vazirlik',
        hasPhoto: json['has_photo'] as bool? ?? false,
      );
}

const Map<String, String> statusLabels = {
  'faol': 'Faol',
  'otpuska': 'Otpuskada',
  'dekret': 'Dekretda',
  'shafyor_farrosh': 'Shofyor/Farrosh',
};

const Map<String, String> workLocationLabels = {
  'vazirlik': 'Vazirlik',
  'labaratoriya': 'Labaratoriya',
};
