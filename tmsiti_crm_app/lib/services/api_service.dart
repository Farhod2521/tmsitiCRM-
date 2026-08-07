import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/arrived_row.dart';
import '../models/attendance.dart';
import '../models/attendance_note.dart';
import '../models/auth_user.dart';
import '../models/employee.dart';
import '../models/ijro_task.dart';
import '../models/ijro_task_detail.dart';

/// Server javobidagi xatolik xabari — foydalanuvchiga ko'rsatish uchun.
class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// TMSITI CRM backendi bilan ishlaydigan yagona HTTP klient.
class ApiService {
  ApiService._();

  /// Production backend manzili (tmsiticrm veb-ilovasi ham shu bilan ishlaydi).
  static const String baseUrl = 'https://tmsiti.testyarat.uz';

  static String? _token;

  /// Token yaroqsiz/eskirgan bo'lib chiqqanda (401) chaqiriladi — ilova login
  /// sahifasiga avtomatik o'tkazadi (main.dart shuni ro'yxatdan o'tkazadi).
  static void Function()? onUnauthorized;

  static void setToken(String? token) => _token = token;

  static Map<String, String> _headers({bool json = true}) => {
    if (json) 'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  static Future<dynamic> _handle(http.Response res) async {
    // Faqat allaqachon token bilan kirilgan so'rov 401 qaytarsa — bu eskirgan/yaroqsiz
    // token degani. Login so'rovi (token yo'q holatda) uchun 401 shunchaki "parol xato".
    if (res.statusCode == 401 && _token != null) {
      _token = null;
      onUnauthorized?.call();
    }
    if (res.statusCode == 204 || res.body.isEmpty) return null;
    dynamic data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final detail = (data is Map && data['detail'] != null)
          ? data['detail'].toString()
          : 'Server xatosi';
      throw ApiException(detail);
    }
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  static Future<AuthUser> login(String phone, String password) async {
    final res = await http
        .post(
          Uri.parse('$baseUrl/auth/login'),
          headers: _headers(),
          body: jsonEncode({'phone': phone, 'password': password}),
        )
        .timeout(
          const Duration(seconds: 15),
          onTimeout: () => throw ApiException('Serverga ulanib bo\'lmadi'),
        );
    final data = await _handle(res);
    return AuthUser.fromJson(data as Map<String, dynamic>);
  }

  static Future<Employee> me() async {
    final res = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return Employee.fromJson(data as Map<String, dynamic>);
  }

  static Future<int> employeeCount() async {
    final res = await http.get(
      Uri.parse('$baseUrl/employees/count'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as Map<String, dynamic>)['total'] as int;
  }

  static String photoUrl() => '$baseUrl/employees/me/photo';

  static Future<String?> myPhotoBase64() async {
    final res = await http.get(
      Uri.parse('$baseUrl/employees/me/photo'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as Map<String, dynamic>?)?['photo_base64'] as String?;
  }

  // ── Attendance ───────────────────────────────────────────────────────────

  static Future<AttendanceRecord?> today() async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/today'),
      headers: _headers(),
    );
    final data = await _handle(res);
    if (data == null) return null;
    return AttendanceRecord.fromJson(data as Map<String, dynamic>);
  }

  static Future<OfficeInfo> office() async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/office'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return OfficeInfo.fromJson(data as Map<String, dynamic>);
  }

  static Future<List<AttendanceRecord>> myMonth(int year, int month) async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/my-month?year=$year&month=$month'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as List)
        .map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<List<ArrivedRow>> todayList() async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/today-list'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as List)
        .map((e) => ArrivedRow.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<String?> dayEmployeePhoto() async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/day-employee-photo'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as Map<String, dynamic>?)?['photo_base64'] as String?;
  }

  // ── Ijro nazorati ────────────────────────────────────────────────────────

  static Future<List<IjroTask>> myTasks() async {
    final res = await http.get(
      Uri.parse('$baseUrl/ijro-docs/my-tasks'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return (data as List)
        .map((e) => IjroTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<IjroTaskDetail> taskDetail(int docBolimId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/ijro-docs/bolim-inbox/$docBolimId/detail'),
      headers: _headers(),
    );
    final data = await _handle(res);
    return IjroTaskDetail.fromJson(data as Map<String, dynamic>);
  }

  static Future<AttendanceRecord> checkIn(
    double latitude,
    double longitude,
  ) async {
    final res = await http.post(
      Uri.parse('$baseUrl/attendance/check-in'),
      headers: _headers(),
      body: jsonEncode({'latitude': latitude, 'longitude': longitude}),
    );
    final data = await _handle(res);
    return AttendanceRecord.fromJson(data as Map<String, dynamic>);
  }

  // ── Davomat arizasi (kech qolaman / kelmayman / obyektga chiqdim) ──────────

  static Future<AttendanceNote?> myNote() async {
    final res = await http.get(
      Uri.parse('$baseUrl/attendance/notes/mine'),
      headers: _headers(),
    );
    final data = await _handle(res);
    if (data == null) return null;
    return AttendanceNote.fromJson(data as Map<String, dynamic>);
  }

  static Future<AttendanceNote> submitNote({
    required String noteType,
    required String dateFrom,
    required String dateTo,
    String? expectedTime,
    String? objectTimeFrom,
    String? objectTimeTo,
    double? objectLatitude,
    double? objectLongitude,
    String? text,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/attendance/notes'),
      headers: _headers(),
      body: jsonEncode({
        'note_type': noteType,
        'date_from': dateFrom,
        'date_to': dateTo,
        'expected_time': expectedTime,
        'object_time_from': objectTimeFrom,
        'object_time_to': objectTimeTo,
        'object_latitude': objectLatitude,
        'object_longitude': objectLongitude,
        'text': text,
      }),
    );
    final data = await _handle(res);
    return AttendanceNote.fromJson(data as Map<String, dynamic>);
  }
}
