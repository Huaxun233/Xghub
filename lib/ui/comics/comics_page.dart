import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import 'venera_page.dart';

class ComicsPage extends StatefulWidget {
  const ComicsPage({super.key});

  @override
  State<ComicsPage> createState() => _ComicsPageState();
}

class _ComicsPageState extends State<ComicsPage> {
  bool _picking = false;

  Future<void> _openImages() async {
    setState(() => _picking = true);
    try {
      final result = await FilePicker.pickFiles(type: FileType.image);
      if (!mounted || result.isEmpty) return;
      final pages = result.where((file) => file.path != null).toList()
        ..sort((a, b) => _compareNames(a.name, b.name));
      if (pages.isEmpty) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('没有找到可读取的图片')));
        return;
      }
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => _ComicReader(pages: pages)),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('无法打开所选图片')));
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('玄果漫画'),
          Text('基于 VeneraX', style: TextStyle(fontSize: 12)),
        ],
      ),
    ),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xfff3b4cc),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.menu_book_rounded,
                    size: 64,
                    color: Color(0xff472c3b),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Text(
                      'X',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 24,
                        color: Color(0xff472c3b),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _picking ? null : _openImages,
              icon: const Icon(Icons.folder_open),
              label: const Text('打开本地漫画图片'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push<void>(
                MaterialPageRoute<void>(builder: (_) => const VeneraPage()),
              ),
              icon: const Icon(Icons.travel_explore),
              label: const Text('在线漫画与书架'),
            ),
            const SizedBox(height: 12),
            const Text('可一次选择多张图片，按文件名顺序阅读。'),
          ],
        ),
      ),
    ),
  );
}

int _compareNames(String a, String b) {
  final pattern = RegExp(r'\d+|\D+');
  final left = pattern.allMatches(a.toLowerCase()).toList();
  final right = pattern.allMatches(b.toLowerCase()).toList();
  for (var index = 0; index < left.length && index < right.length; index++) {
    final x = left[index].group(0)!;
    final y = right[index].group(0)!;
    final xNumber = BigInt.tryParse(x);
    final yNumber = BigInt.tryParse(y);
    final order = xNumber != null && yNumber != null
        ? xNumber.compareTo(yNumber)
        : x.compareTo(y);
    if (order != 0) return order;
  }
  final order = left.length.compareTo(right.length);
  return order == 0 ? a.compareTo(b) : order;
}

class _ComicReader extends StatefulWidget {
  const _ComicReader({required this.pages});

  final List<PlatformFile> pages;

  @override
  State<_ComicReader> createState() => _ComicReaderState();
}

class _ComicReaderState extends State<_ComicReader> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('第 ${_page + 1} / ${widget.pages.length} 页')),
    body: PageView.builder(
      controller: _controller,
      itemCount: widget.pages.length,
      onPageChanged: (index) => setState(() => _page = index),
      itemBuilder: (context, index) => InteractiveViewer(
        child: Image.file(
          File(widget.pages[index].path!),
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => const Center(child: Text('此页图片无法读取')),
        ),
      ),
    ),
    bottomNavigationBar: SafeArea(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            tooltip: '上一页',
            onPressed: _page == 0
                ? null
                : () => _controller.jumpToPage(_page - 1),
            icon: const Icon(Icons.chevron_left),
          ),
          IconButton(
            tooltip: '下一页',
            onPressed: _page + 1 == widget.pages.length
                ? null
                : () => _controller.jumpToPage(_page + 1),
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    ),
  );
}
