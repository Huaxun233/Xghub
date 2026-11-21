import 'package:flutter/material.dart';
import 'package:venera/foundation/app.dart' as venera_host;
import 'package:venera/init.dart' as venera_init;
import 'package:venera/main.dart' as venera;

import '../widgets/focus_ring.dart';

class VeneraPage extends StatefulWidget {
  const VeneraPage({super.key});

  @override
  State<VeneraPage> createState() => _VeneraPageState();
}

class _VeneraPageState extends State<VeneraPage> {
  static Future<void>? _startup;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('在线漫画与书架')),
    body: FutureBuilder<void>(
      future: _startup ??= venera_init.init(embedded: true),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: FilledButton(
              onPressed: () => setState(() => _startup = null),
              child: const Text('漫画初始化失败，重试'),
            ),
          );
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        return NavigatorPopHandler<Object?>(
          onPopWithResult: (result) {
            venera_host.App.rootNavigatorKey.currentState?.maybePop(result);
          },
          child: const KeyboardControls(child: venera.MyApp(embedded: true)),
        );
      },
    ),
  );
}
