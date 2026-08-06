import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../services/face_verify_service.dart';
import '../theme/app_colors.dart';

enum _Stage { initializing, ready, capturing, verifying, success, failed, error }

/// Ishga kelishni tasdiqlashdan oldin: kamera orqali selfi olib, uni profil
/// rasmi bilan solishtiradi (web'dagi FaceVerifyModal bilan bir xil g'oya,
/// lekin qurilmaning o'zida — internetsiz ishlaydigan model orqali).
class FaceVerifyScreen extends StatefulWidget {
  final int employeeId;
  const FaceVerifyScreen({super.key, required this.employeeId});

  @override
  State<FaceVerifyScreen> createState() => _FaceVerifyScreenState();
}

class _FaceVerifyScreenState extends State<FaceVerifyScreen> {
  CameraController? _controller;
  _Stage _stage = _Stage.initializing;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  Future<void> _setup() async {
    try {
      // Profil rasmini ro'yxatdan o'tkazish va kamerani tayyorlash parallel boradi.
      final registerFuture = FaceVerifyService.registerProfilePhoto(widget.employeeId);

      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw FaceVerifyException('Qurilmangizda kamera topilmadi.');
      }
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();

      await registerFuture;

      if (!mounted) return;
      setState(() {
        _controller = controller;
        _stage = _Stage.ready;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = e.toString().replaceFirst('FaceVerifyException: ', '').replaceFirst('CameraException(', '');
        _stage = _Stage.error;
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    setState(() => _stage = _Stage.capturing);
    try {
      final file = await controller.takePicture();
      setState(() => _stage = _Stage.verifying);
      final matched = await FaceVerifyService.verify(file.path, widget.employeeId);
      if (!mounted) return;
      if (matched) {
        setState(() => _stage = _Stage.success);
        await Future.delayed(const Duration(milliseconds: 700));
        if (mounted) Navigator.of(context).pop(true);
      } else {
        setState(() => _stage = _Stage.failed);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = e.toString();
        _stage = _Stage.error;
      });
    }
  }

  void _retry() {
    setState(() {
      _stage = _Stage.ready;
      _errorText = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_controller != null && _controller!.value.isInitialized)
              Positioned.fill(child: CameraPreview(_controller!))
            else
              Container(color: const Color(0xFF0A1629)),

            // Yuzni joylashtirish uchun aylana yo'riqnoma
            if (_stage == _Stage.ready || _stage == _Stage.capturing || _stage == _Stage.verifying)
              Center(
                child: Container(
                  width: 260, height: 260,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _stage == _Stage.verifying ? AppColors.success : Colors.white.withValues(alpha: 0.85),
                      width: 3,
                    ),
                  ),
                ),
              ),

            // Yuqori panel
            Positioned(
              top: 0, left: 0, right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.black.withValues(alpha: 0.65), Colors.transparent],
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close, color: Colors.white),
                    ),
                    const Expanded(
                      child: Text('Yuzni tasdiqlash', textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
            ),

            // Pastki panel — holat va tugma
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.black.withValues(alpha: 0.75), Colors.transparent],
                    begin: Alignment.bottomCenter, end: Alignment.topCenter,
                  ),
                ),
                child: _buildBottomContent(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomContent() {
    switch (_stage) {
      case _Stage.initializing:
        return const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 14),
            Text('Tayyorlanmoqda...', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ],
        );

      case _Stage.ready:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Yuzingizni doira ichiga joylashtiring va tugmani bosing',
              textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(height: 18),
            GestureDetector(
              onTap: _capture,
              child: Container(
                width: 74, height: 74,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 5),
                ),
                child: const Icon(Icons.camera_alt, color: AppColors.primary, size: 30),
              ),
            ),
          ],
        );

      case _Stage.capturing:
      case _Stage.verifying:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: Colors.white),
            const SizedBox(height: 14),
            Text(_stage == _Stage.capturing ? 'Rasmga olinmoqda...' : 'Tekshirilmoqda...',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ],
        );

      case _Stage.success:
        return const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, color: AppColors.success, size: 48),
            SizedBox(height: 10),
            Text('Tasdiqlandi!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
          ],
        );

      case _Stage.failed:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
            const SizedBox(height: 8),
            const Text('Yuz mos kelmadi. Qaytadan urinib ko\'ring.',
              textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _retry,
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, minimumSize: const Size(180, 48)),
              child: const Text('Qayta urinish'),
            ),
          ],
        );

      case _Stage.error:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
            const SizedBox(height: 8),
            Text(_errorText ?? 'Xatolik yuz berdi',
              textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () { setState(() => _stage = _Stage.initializing); _setup(); },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, minimumSize: const Size(180, 48)),
              child: const Text('Qayta urinish'),
            ),
          ],
        );
    }
  }
}
