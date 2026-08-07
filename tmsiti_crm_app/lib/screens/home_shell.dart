import 'package:flutter/material.dart';
import '../models/auth_user.dart';
import '../theme/app_colors.dart';
import 'davomat_screen.dart';
import 'home_screen.dart';
import 'profile_screen.dart';
import 'tasks_screen.dart';

/// Login qilingandan keyingi asosiy ekran — pastki navigatsiya
/// (Bosh sahifa / Davomat / [+ tezkor amallar] / Topshiriqlar / Profil).
class HomeShell extends StatefulWidget {
  final AuthUser user;
  const HomeShell({super.key, required this.user});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _goTo(int index) => setState(() => _index = index);

  void _openQuickActions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: const BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 18),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Tezkor amallar', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink)),
            ),
            const SizedBox(height: 16),
            _quickActionTile(
              icon: Icons.fingerprint_rounded,
              color: AppColors.primary,
              title: 'Ishga keldim',
              subtitle: "Davomat bo'limiga o'tish",
              onTap: () {
                Navigator.pop(context);
                _goTo(1);
              },
            ),
            const SizedBox(height: 10),
            _quickActionTile(
              icon: Icons.edit_note_rounded,
              color: AppColors.lateAmber,
              title: 'Ariza qoldirish',
              subtitle: "Kech qolaman / kelmayman / obyektga chiqdim",
              onTap: () {
                Navigator.pop(context);
                _goTo(1);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickActionTile({required IconData icon, required Color color, required String title, required String subtitle, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14)),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.ink)),
                  Text(subtitle, style: const TextStyle(fontSize: 11.5, color: AppColors.muted)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(user: widget.user, onNavigate: _goTo),
      DavomatScreen(user: widget.user),
      const TasksScreen(),
      ProfileScreen(user: widget.user),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      floatingActionButton: FloatingActionButton(
        onPressed: _openQuickActions,
        backgroundColor: AppColors.primary,
        elevation: 3,
        shape: const CircleBorder(),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        color: AppColors.card,
        elevation: 12,
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        padding: EdgeInsets.zero,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              _navItem(icon: Icons.home_rounded, label: 'Bosh sahifa', index: 0),
              _navItem(icon: Icons.calendar_today_rounded, label: 'Davomat', index: 1),
              const Spacer(),
              _navItem(icon: Icons.assignment_rounded, label: 'Topshiriqlar', index: 2),
              _navItem(icon: Icons.person_rounded, label: 'Profil', index: 3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem({required IconData icon, required String label, required int index}) {
    final active = _index == index;
    return Expanded(
      child: InkWell(
        onTap: () => _goTo(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: active ? AppColors.primary : AppColors.muted, size: 23),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: active ? AppColors.primary : AppColors.muted,
                fontSize: 10.5,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
