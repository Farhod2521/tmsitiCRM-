import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../theme/app_colors.dart';
import 'home_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _PhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('998')) digits = digits.substring(3);
    digits = digits.length > 9 ? digits.substring(0, 9) : digits;

    final buf = StringBuffer('+998 ');
    if (digits.isNotEmpty) buf.write(digits.substring(0, digits.length >= 2 ? 2 : digits.length));
    if (digits.length > 2) buf.write(' ${digits.substring(2, digits.length >= 5 ? 5 : digits.length)}');
    if (digits.length > 5) buf.write('-${digits.substring(5, digits.length >= 7 ? 7 : digits.length)}');
    if (digits.length > 7) buf.write('-${digits.substring(7, digits.length)}');

    final text = buf.toString();
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController(text: '+998 ');
  final _passCtrl = TextEditingController();
  bool _showPass = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final digits = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 12) {
      setState(() => _error = "Telefon raqamni to'liq kiriting");
      return;
    }
    if (_passCtrl.text.isEmpty) {
      setState(() => _error = 'Parolni kiriting');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await ApiService.login('+$digits', _passCtrl.text);
      ApiService.setToken(user.accessToken);
      await AuthStorage.save(user);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => HomeShell(user: user)));
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('ApiException: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // ── Blue header ──
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 36, 24, 40),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.only(bottomLeft: Radius.circular(36), bottomRight: Radius.circular(36)),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: -60,
                      right: -40,
                      child: _decorCircle(120),
                    ),
                    Positioned(
                      bottom: -30,
                      left: -30,
                      child: _decorCircle(90),
                    ),
                    Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: SvgPicture.asset('assets/icons/brand.svg', width: 36, height: 38),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const Text('TMSITI CRM', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text('Korporativ boshqaruv tizimi', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // ── Form card ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const [BoxShadow(color: AppColors.cardShadow, blurRadius: 40, offset: Offset(0, 8))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tizimga kirish', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.ink)),
                      const SizedBox(height: 4),
                      const Text('Faqat ruxsat etilgan foydalanuvchilar', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                      const SizedBox(height: 24),

                      const Text('Telefon raqam', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.ink)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [_PhoneFormatter()],
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                        decoration: const InputDecoration(
                          hintText: '+998 99 000-00-00',
                          prefixIcon: Icon(Icons.phone_outlined, color: AppColors.muted, size: 20),
                        ),
                        onChanged: (_) => setState(() => _error = null),
                      ),
                      const SizedBox(height: 18),

                      const Text('Parol', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.ink)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _passCtrl,
                        obscureText: !_showPass,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                        decoration: InputDecoration(
                          hintText: 'Parolni kiriting',
                          prefixIcon: const Icon(Icons.lock_outline, color: AppColors.muted, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(_showPass ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.muted, size: 20),
                            onPressed: () => setState(() => _showPass = !_showPass),
                          ),
                        ),
                        onChanged: (_) => setState(() => _error = null),
                        onSubmitted: (_) => _submit(),
                      ),

                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.danger.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                          ),
                          child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 13)),
                        ),
                      ],

                      const SizedBox(height: 22),
                      ElevatedButton(
                        onPressed: _loading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _loading ? AppColors.muted : AppColors.primary,
                        ),
                        child: _loading
                            ? const SizedBox(
                                width: 22, height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('Kirish'),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward, size: 18),
                                ],
                              ),
                      ),
                      const SizedBox(height: 18),
                      const Center(
                        child: Text('Muammo bo\'lsa IT bo\'limi bilan bog\'laning', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text('© 2026 TMSITI CRM. Barcha huquqlar himoyalangan.', style: TextStyle(fontSize: 11, color: AppColors.muted)),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _decorCircle(double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.1)),
      );
}
