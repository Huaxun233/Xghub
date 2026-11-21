import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:duanju_app/ui/comics/comics_page.dart';
import 'package:flutter/material.dart';

void main() {
  testWidgets('the comics tab exposes both reading entries', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ComicsPage()));
    expect(find.text('打开本地漫画图片'), findsOneWidget);
    expect(find.text('在线漫画与书架'), findsOneWidget);
  });

  testWidgets('the embedded reader has its script and translation assets', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final runtime = await rootBundle.loadString(
        'packages/venera/assets/init.js',
      );
      final translation = await rootBundle.loadString(
        'packages/venera/assets/translation.json',
      );
      expect(runtime, contains('ComicSource'));
      expect(translation, isNotEmpty);
    });
  });
}
