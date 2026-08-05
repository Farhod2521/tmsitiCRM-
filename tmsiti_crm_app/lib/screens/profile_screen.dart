import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../models/auth_user.dart';
import '../models/employee.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../theme/app_colors.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  final AuthUser user;
  const ProfileScreen({super.key, required this.user});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _loading = true;
  Employee? _emp;
  Uint8List? _photo;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final emp = await ApiService.me();
      String? photoB64;
      if (emp.hasPhoto) {
        photoB64 = await ApiService.myPhotoBase64();
      }
      if (!mounted) return;
      setState(() {
        _emp = emp;
        if (photoB64 != null && photoB64.contains(',')) {
          _photo = base64Decode(photoB64.split(',').last);
        }
      });
    } catch (_) {
      // jim — statik login ma'lumotlari baribir ko'rsatiladi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Chiqish'),
        content: const Text('Hisobingizdan chiqishni tasdiqlaysizmi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor qilish')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Chiqish', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    ApiService.setToken(null);
    await AuthStorage.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final fullName = _emp?.fullName ?? widget.user.fullName;
    final role = _emp?.role ?? widget.user.role;
    final position = _emp?.position;
    final department = _emp?.departmentName;
    final phone = _emp?.phone ?? widget.user.phone;
    final status = _emp?.status;
    final workLocation = _emp?.workLocation;

    final initials = fullName.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).map((s) => s[0]).take(2).join().toUpperCase();

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : RefreshIndicator(
                onRefresh: _load,
                color: AppColors.primary,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  children: [
                    const Text('Profil', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.ink)),
                    const SizedBox(height: 20),

                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 30, offset: Offset(0, 6))],
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 92,
                            height: 92,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              image: _photo != null ? DecorationImage(image: MemoryImage(_photo!), fit: BoxFit.cover) : null,
                            ),
                            child: _photo == null
                                ? Text(initials.isEmpty ? '?' : initials, style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800))
                                : null,
                          ),
                          const SizedBox(height: 16),
                          Text(fullName, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.ink), textAlign: TextAlign.center),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                            child: Text(roleLabel(role), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12)),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 24, offset: Offset(0, 4))],
                      ),
                      child: Column(
                        children: [
                          if (position != null) _infoRow(Icons.badge_outlined, 'Lavozim', position),
                          if (department != null) _infoRow(Icons.apartment_outlined, "Bo'lim", department),
                          _infoRow(Icons.phone_outlined, 'Telefon', phone, isLast: workLocation == null && status == null),
                          if (workLocation != null) _infoRow(Icons.location_on_outlined, 'Ish joyi', workLocationLabels[workLocation] ?? workLocation),
                          if (status != null) _infoRow(Icons.verified_outlined, 'Holat', statusLabels[status] ?? status, isLast: true),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),
                    OutlinedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout, color: AppColors.danger, size: 19),
                      label: const Text('Chiqish', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w800)),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        backgroundColor: AppColors.card,
                        side: BorderSide(color: AppColors.danger.withValues(alpha: 0.3)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value, {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        border: isLast ? null : const Border(bottom: BorderSide(color: AppColors.divider)),
      ),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 17, color: AppColors.muted),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.muted))),
          Flexible(
            child: Text(value, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.ink), textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}

