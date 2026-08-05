import 'package:flutter/material.dart';
import '../models/auth_user.dart';
import '../theme/app_colors.dart';
import 'davomat_screen.dart';
import 'profile_screen.dart';

/// Login qilingandan keyingi asosiy ekran — pastki navigatsiya (Davomat / Profil).
class HomeShell extends StatefulWidget {
  final AuthUser user;
  const HomeShell({super.key, required this.user});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DavomatScreen(),
      ProfileScreen(user: widget.user),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          boxShadow: [BoxShadow(color: AppColors.cardShadow, blurRadius: 24, offset: Offset(0, -4))],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _navItem(icon: Icons.calendar_today_rounded, label: 'Davomat', index: 0),
                _navItem(icon: Icons.person_rounded, label: 'Profil', index: 1),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _navItem({required IconData icon, required String label, required int index}) {
    final active = _index == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _index = index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: active ? AppColors.primary : AppColors.muted, size: 24),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: active ? AppColors.primary : AppColors.muted,
                fontSize: 11.5,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
