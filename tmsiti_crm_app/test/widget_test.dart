import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:tmsiti_crm_app/main.dart';

void main() {
  testWidgets('App ochilganda login ekrani ko\'rinadi', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const TmsitiApp());
    await tester.pumpAndSettle();

    expect(find.text('Tizimga kirish'), findsOneWidget);
  });
}
