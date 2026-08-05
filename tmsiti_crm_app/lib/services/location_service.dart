import 'package:geolocator/geolocator.dart';

class LocationException implements Exception {
  final String message;
  LocationException(this.message);
  @override
  String toString() => message;
}

class LocationService {
  LocationService._();

  /// Joriy joylashuvni oladi — kerak bo'lsa avval ruxsat so'raydi.
  static Future<Position> getCurrentPosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationException("Qurilmangizda joylashuv (GPS) xizmati o'chirilgan. Uni yoqing.");
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw LocationException('Joylashuvga ruxsat berilmadi.');
      }
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationException('Joylashuvga ruxsat butunlay rad etilgan. Sozlamalardan yoqing.');
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }
}
