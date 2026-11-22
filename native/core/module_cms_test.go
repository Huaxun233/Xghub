package core

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestParseTVBoxSites(t *testing.T) {
	raw := []byte(`{"sites":[
		{"key":"a","name":"甲站","type":1,"api":"https://a.example.com/api.php/provide/vod"},
		{"key":"b","name":"乙站","type":0,"api":"http://b.example.com/api.php/provide/vod/at/xml/"},
		{"key":"c","name":"丙站","type":3,"api":"https://c.example.com/x"},
		{"key":"d","name":"丁站","type":1,"api":"ftp://d.example.com/vod"},
		{"key":"e","name":"戊站","type":1,"api":"https://a.example.com/api.php/provide/vod"}
	]}`)
	sites := parseTVBoxSites(raw)
	if len(sites) != 5 {
		t.Fatalf("sites = %d", len(sites))
	}
	if sites[0].Format != "json" || sites[0].ID == "" || sites[0].Host != "a.example.com" {
		t.Fatalf("site a = %+v", sites[0])
	}
	if sites[1].Format != "xml" {
		t.Fatalf("site b = %+v", sites[1])
	}
	if sites[2].Reason == "" || sites[3].Reason == "" || sites[4].Reason == "" {
		t.Fatalf("expected reasons, got %+v", sites[2:])
	}
	if sites[4].ID != "" {
		t.Fatalf("duplicate api should lose its id: %+v", sites[4])
	}
}

func cmsTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/vod", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		switch {
		case query.Get("ac") == "list":
			_, _ = w.Write([]byte(`{"code":1,"class":[{"type_id":1,"type_name":"甜宠"},{"type_id":2,"type_name":"逆袭"}]}`))
		case query.Get("ids") != "":
			_, _ = w.Write([]byte(`{"code":1,"list":[{"vod_id":"9","vod_name":"示例剧","vod_pic":"https://img.example.com/9.jpg","vod_content":"<p>简介</p>","type_name":"甜宠","vod_remarks":"全30集","vod_play_url":"m3u8线路#第1集$https://cdn.example.com/1.m3u8#第2集$https://cdn.example.com/2.m3u8$$$直链#第1集$https://cdn.example.com/1.mp4"}]}`))
		default:
			if query.Get("wd") != "" {
				_, _ = w.Write([]byte(`{"code":1,"page":1,"pagecount":1,"list":[{"vod_id":"9","vod_name":"示例剧","vod_pic":"https://img.example.com/9.jpg"}]}`))
				return
			}
			_, _ = w.Write([]byte(`{"code":1,"page":1,"pagecount":3,"list":[{"vod_id":"9","vod_name":"示例剧","vod_pic":"https://img.example.com/9.jpg","vod_remarks":"全30集"}]}`))
		}
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func TestCmsModuleLifecycle(t *testing.T) {
	server := cmsTestServer(t)
	api := server.URL + "/vod"
	engine := &nativeEngine{downloader: &Downloader{cfg: Config{dataDir: t.TempDir()}, client: http.DefaultClient}, cacheDirectory: t.TempDir()}
	ctx := context.Background()

	config := `{"sites":[{"key":"demo","name":"演示站","type":1,"api":"` + api + `"}]}`
	configServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(config))
	}))
	defer configServer.Close()

	probe, err := engine.cmsProbe(ctx, configServer.URL)
	if err != nil {
		t.Fatal(err)
	}
	items := probe["items"].([]cmsSite)
	if len(items) != 1 || items[0].Format != "json" || items[0].Installed {
		t.Fatalf("probe items = %+v, %v", items, err)
	}
	id := items[0].ID

	result, err := engine.cmsInstall(ctx, configServer.URL, []string{"demo"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result["installed"].([]cmsInstallResult)) != 1 || !nativeSourceAvailable(id) {
		t.Fatalf("install = %+v, %v", result, err)
	}
	if _, err := os.Stat(filepath.Join(engine.downloader.moduleRoot(), id, moduleManifest)); err != nil {
		t.Fatalf("module files missing: %v", err)
	}

	provider, ok := engine.downloader.provider(id)
	if !ok {
		t.Fatal("provider not registered")
	}
	categories, err := provider.Categories(ctx, false)
	if err != nil || len(categories) != 2 || categories[0].Name != "甜宠" {
		t.Fatalf("categories = %+v, %v", categories, err)
	}
	dramas, more, err := provider.CatalogPage(ctx, 1, "1")
	if err != nil || len(dramas) != 1 || !more || dramas[0].Title != "示例剧" || dramas[0].SourceID != "9" {
		t.Fatalf("catalog = %+v more=%v, %v", dramas, more, err)
	}
	searcher, ok := provider.(Searcher)
	if !ok {
		t.Fatal("search capability missing")
	}
	found, _, err := searcher.Search(ctx, 1, "示例")
	if err != nil || len(found) != 1 {
		t.Fatalf("search = %+v, %v", found, err)
	}
	drama, chapters, err := provider.Detail(ctx, "9")
	if err != nil || drama.DisplayTitle() != "示例剧" || len(chapters) != 2 {
		t.Fatalf("detail = %q chapters=%d, %v", drama.DisplayTitle(), len(chapters), err)
	}
	if chapters[0].VideoURL != "https://cdn.example.com/1.m3u8" || chapters[1].VideoURL != "https://cdn.example.com/2.m3u8" {
		t.Fatalf("chapters = %+v", chapters)
	}
	media, err := provider.ResolveMedia(ctx, Task{DramaID: drama.ID, Chapter: chapters[0]})
	if err != nil || media.URL != "https://cdn.example.com/1.m3u8" {
		t.Fatalf("resolve = %+v, %v", media, err)
	}

	if _, err := engine.uninstallModule(id); err != nil || nativeSourceAvailable(id) {
		t.Fatalf("uninstall left the module registered: %v", err)
	}
}

func TestCmsModuleXML(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/vod", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		w.Header().Set("Content-Type", "text/xml")
		switch {
		case query.Get("ac") == "list":
			_, _ = w.Write([]byte(`<?xml version="1.0"?><rss><class><ty id="1">甜宠</ty></class></rss>`))
		case query.Get("ids") != "":
			_, _ = w.Write([]byte(`<?xml version="1.0"?><rss><list page="1" pagecount="1"><video><id>9</id><name>示例剧</name><pic>https://img.example.com/9.jpg</pic><des>简介</des><dl><dd flag="m3u8">第1集$https://cdn.example.com/1.m3u8</dd></dl></video></list></rss>`))
		default:
			_, _ = w.Write([]byte(`<?xml version="1.0"?><rss><list page="1" pagecount="2"><video><id>9</id><name>示例剧</name><pic>https://img.example.com/9.jpg</pic><dl><dd flag="m3u8">第1集$https://cdn.example.com/1.m3u8</dd></dl></video></list></rss>`))
		}
	})
	server := httptest.NewServer(mux)
	defer server.Close()
	api := server.URL + "/vod"

	config := `{"sites":[{"key":"xml","name":"XML 站","type":0,"api":"` + api + `"}]}`
	configServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(config))
	}))
	defer configServer.Close()

	engine := &nativeEngine{downloader: &Downloader{cfg: Config{dataDir: t.TempDir()}, client: http.DefaultClient}, cacheDirectory: t.TempDir()}
	ctx := context.Background()
	result, err := engine.cmsInstall(ctx, configServer.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	installed := result["installed"].([]cmsInstallResult)
	if len(installed) != 1 {
		t.Fatalf("install = %+v", result)
	}
	id := installed[0].ID
	defer engine.uninstallModule(id)
	provider, ok := engine.downloader.provider(id)
	if !ok {
		t.Fatal("xml provider not registered")
	}
	categories, err := provider.Categories(ctx, false)
	if err != nil || len(categories) != 1 || categories[0].ID != "1" || categories[0].Name != "甜宠" {
		t.Fatalf("xml categories = %+v, %v", categories, err)
	}
	dramas, more, err := provider.CatalogPage(ctx, 1, "1")
	if err != nil || len(dramas) != 1 || !more {
		t.Fatalf("xml catalog = %+v more=%v, %v", dramas, more, err)
	}
	if _, chapters, err := provider.Detail(ctx, "9"); err != nil || len(chapters) != 1 || chapters[0].VideoURL != "https://cdn.example.com/1.m3u8" {
		t.Fatalf("xml detail chapters = %+v, %v", chapters, err)
	}
}
