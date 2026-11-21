import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:venera/foundation/app.dart';
import 'package:venera/foundation/cache_manager.dart';
import 'package:venera/foundation/comic_source/comic_source.dart';
import 'package:venera/foundation/comic_type.dart';
import 'package:venera/foundation/favorites.dart';
import 'package:venera/foundation/js_engine.dart';
import 'package:venera/foundation/image_provider/reader_image.dart';
import 'package:venera/foundation/sqlite_connection.dart';
import 'package:venera/network/cookie_jar.dart';
import 'package:venera/network/source_url.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'VeneraX imports, searches, reads chapters and saves a favorite',
    () async {
      final root = await Directory.systemTemp.createTemp('xghub-venera-');
      addTearDown(() async {
        JsEngine().dispose();
        App.favorites.close();
        App.domain.close();
        SingleInstanceCookieJar.instance?.dispose();
        await CacheManager.instance?.ready;
        DatabaseGateway.instance.closeManaged('${root.path}/cache.db');
        await root.delete(recursive: true);
      });
      App.initBackgroundTask(root.path, root.path, '3.0.2');
      await App.data.init();
      await App.favorites.init();
      await JsEngine().init();
      final sources = ComicSourceManager();
      await sources.init();
      var script = await File(
        'test/support/xghub_comic_source.js',
      ).readAsString();
      var imageUrl = 'http://127.0.0.1:8319/page.png';
      const verifyHttp = bool.fromEnvironment('XGHUB_COMICS_HTTP_TEST');
      if (verifyHttp) {
        App.data.settings['proxy'] = 'direct';
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        addTearDown(() => server.close(force: true));
        final origin = 'http://127.0.0.1:${server.port}';
        script = script.replaceAll('http://127.0.0.1:8319', origin);
        imageUrl = '$origin/page.png';

        final fixture = script;
        final png = base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN45lYBAAO6AaVhYT3oAAAAAElFTkSuQmCC',
        );
        server.listen((request) async {
          if (request.uri.path == '/source.js') {
            request.response.headers.contentType = ContentType.text;
            request.response.write(fixture);
          } else if (request.uri.path == '/page.png') {
            request.response.headers.contentType = ContentType('image', 'png');
            request.response.contentLength = png.length;
            request.response.add(png);
          } else {
            request.response.statusCode = HttpStatus.notFound;
          }
          await request.response.close();
        });
        script = (await fetchSourceText('$origin/source.js')).data!;
      }
      final source = await ComicSourceParser().createAndParse(
        script,
        'demo.js',
      );
      expect(sources.add(source), isTrue);
      expect(ComicSource.find(source.key), same(source));
      final results = await source.searchPageData!.loadPage!('hello', 1, []);
      expect(results.success, isTrue, reason: results.errorMessage);
      final comic = results.data.single;
      expect(comic.title, 'Hello Comics');

      final details = await source.loadComicInfo!(comic.id);
      expect(details.success, isTrue, reason: details.errorMessage);
      expect(details.data.chapters, isNotNull);
      final pages = await source.loadComicPages!(comic.id, 'chapter1');
      expect(pages.success, isTrue, reason: pages.errorMessage);
      expect(pages.data, [imageUrl]);
      if (verifyHttp) {
        final image = ReaderImageProvider(
          imageUrl,
          source.key,
          comic.id,
          'chapter1',
          1,
        );
        final codec = await ui.instantiateImageCodec(await image.loadOriginal());
        try {
          final frame = await codec.getNextFrame();
          try {
            expect(frame.image.width, 1);
            expect(frame.image.height, 1);
          } finally {
            frame.image.dispose();
          }
        } finally {
          codec.dispose();
        }
      }

      final folder = App.favorites.createFolder('Integration test');
      expect(
        App.favorites.addComic(
          folder,
          FavoriteItem(
            id: comic.id,
            name: comic.title,
            coverPath: comic.cover,
            author: '',
            type: ComicType.fromKey(comic.sourceKey),
            tags: comic.tags ?? [],
          ),
        ),
        isTrue,
      );
      expect(App.favorites.getComicsIn([folder]).single.id, comic.id);
    },
    skip: !const bool.fromEnvironment('XGHUB_NATIVE_COMICS_TEST'),
  );
}
