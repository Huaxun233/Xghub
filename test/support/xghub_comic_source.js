class XghubDemoComics extends ComicSource {
  name = 'Xghub Integration Demo';
  key = 'xghub_demo';
  version = '1.0.0';
  minAppVersion = '3.0.0';
  url = 'http://127.0.0.1:8319/source.js';

  summary = {
    id: 'demo',
    title: 'Hello Comics',
    cover: 'http://127.0.0.1:8319/page.png',
    tags: ['Demo'],
    description: 'A synthetic comic for the integration test.',
  };

  search = {
    load: (keyword) => ({
      comics: this.summary.title.toLowerCase().includes(keyword.toLowerCase())
        ? [this.summary]
        : [],
      maxPage: 1,
    }),
  };

  comic = {
    loadInfo: () => ({
      ...this.summary,
      tags: { Genre: ['Demo'] },
      chapters: { chapter1: 'Chapter 1' },
    }),
    loadEp: () => ({
      images: ['http://127.0.0.1:8319/page.png'],
    }),
  };
}
