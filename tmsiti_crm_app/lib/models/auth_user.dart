/// `POST /auth/login` javobi.
class AuthUser {
  final String accessToken;
  final int id;
  final String fullName;
  final String role;
  final int? departmentId;
  final String phone;

  AuthUser({
    required this.accessToken,
    required this.id,
    required this.fullName,
    required this.role,
    required this.departmentId,
    required this.phone,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        accessToken: json['access_token'] as String,
        id: json['id'] as int,
        fullName: json['full_name'] as String,
        role: json['role'] as String,
        departmentId: json['department_id'] as int?,
        phone: json['phone'] as String,
      );

  Map<String, dynamic> toJson() => {
        'access_token': accessToken,
        'id': id,
        'full_name': fullName,
        'role': role,
        'department_id': departmentId,
        'phone': phone,
      };
}

const Map<String, String> roleLabels = {
  'superadmin': 'Administrator',
  'direktor': 'Direktor',
  'zamdirektor': "Direktor o'rinbosari",
  'bolim_boshligi': "Bo'lim boshlig'i",
  'boshqarma_boshligi': "Boshqarma boshlig'i",
  'kadr': 'Kadr vakili',
  'ijro': 'Ijro vakili',
  'xodim': 'Xodim',
};

String roleLabel(String role) => roleLabels[role] ?? role;
