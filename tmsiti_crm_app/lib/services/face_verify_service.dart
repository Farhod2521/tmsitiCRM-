import 'dart:convert';
import 'dart:io';
import 'package:face_verification/face_verification.dart';
import 'package:path_provider/path_provider.dart';
import 'api_service.dart';

class FaceVerifyException implements Exception {
  final String message;
  FaceVerifyException(this.message);
  @override
  String toString() => message;
}

/// `face_verification` paketi ustidan yupqa qatlam — profil rasmini
/// on-device ro'yxatdan o'tkazadi va jonli selfini shu bilan solishtiradi.
class FaceVerifyService {
  FaceVerifyService._();

  static bool _initialized = false;

  static Future<void> _ensureInit() async {
    if (_initialized) return;
    await FaceVerification.instance.init();
    _initialized = true;
  }

  /// Profil rasmini (backenddan) yuklab, on-device model uchun ro'yxatdan
  /// o'tkazadi. `employeeId` — solishtirishda ishlatiladigan barqaror kalit.
  static Future<void> registerProfilePhoto(int employeeId) async {
    await _ensureInit();

    final photoB64 = await ApiService.myPhotoBase64();
    if (photoB64 == null || !photoB64.contains(',')) {
      throw FaceVerifyException('Profilingizda rasm yo\'q — avval profilga rasm qo\'shing.');
    }

    final bytes = base64Decode(photoB64.split(',').last);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/profile_photo_$employeeId.jpg');
    await file.writeAsBytes(bytes);

    // Bu paket (0.3.6) bir xil id+imageId uchun avval ro'yxatdan o'tgan
    // yozuv bo'lsa, `replace: true` bo'lsa ham xatolik chiqaradi — shuning
    // uchun avval eskisini o'chirib, keyin qaytadan ro'yxatdan o'tkazamiz
    // (profil rasmi o'zgargan bo'lishi ham mumkin).
    await FaceVerification.instance.deleteFaceRecord(employeeId.toString(), 'profile');

    await FaceVerification.instance.registerFromImagePath(
      id: employeeId.toString(),
      imagePath: file.path,
      imageId: 'profile',
    );
  }

  /// Berilgan selfi faylini ro'yxatdan o'tgan profil rasmi bilan solishtiradi.
  /// Mos kelsa `true`, kelmasa `false` qaytaradi.
  static Future<bool> verify(String selfiePath, int employeeId) async {
    await _ensureInit();
    final matchId = await FaceVerification.instance.verifyFromImagePath(
      imagePath: selfiePath,
      threshold: 0.70,
    );
    return matchId == employeeId.toString();
  }
}
