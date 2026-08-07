import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'models/auth_user.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';
import 'services/auth_storage.dart';
import 'theme/app_colors.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('uz');
  runApp(const TmsitiApp());
}

class TmsitiApp extends StatelessWidget {
  const TmsitiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TMSITI CRM',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const _AuthGate(),
    );
  }
}

/// Ilova ochilganda avval saqlangan login sessiyasini tekshiradi.
class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  AuthUser? _user;
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    ApiService.onUnauthorized = _handleUnauthorized;
    _restore();
  }

  Future<void> _restore() async {
    final user = await AuthStorage.load();
    if (user != null) ApiService.setToken(user.accessToken);
    if (!mounted) return;
    setState(() {
      _user = user;
      _checked = true;
    });
  }

  /// Token yaroqsiz/eskirgan bo'lib chiqsa (401) — sessiyani tozalab, avtomatik
  /// login sahifasiga qaytaradi.
  void _handleUnauthorized() {
    AuthStorage.clear();
    if (!mounted) return;
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) {
      return const Scaffold(
        backgroundColor: AppColors.surface,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    return _user != null ? HomeShell(user: _user!) : const LoginScreen();
  }
}
